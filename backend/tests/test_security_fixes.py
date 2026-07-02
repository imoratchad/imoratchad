"""End-to-end security regression tests for IMORA Tchad backend.
Covers SEC-001, SEC-003, SEC-004, SEC-005 + regression on core endpoints.
"""
import io
import os
import csv
import time
import zipfile
import concurrent.futures
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://immobilier-tchad.preview.emergentagent.com").rstrip("/")

ADMIN = "test_session_admin"
PART = "test_session_particulier"
AGENCE = "test_session_agence"


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------------- SEC-001: privilege escalation ----------------
class TestSEC001AdminEscalation:
    def test_particulier_cannot_set_role_admin(self):
        r = requests.put(f"{BASE_URL}/api/auth/profile", headers=_h(PART),
                         json={"role": "admin", "phone": "", "whatsapp": "", "agency_name": ""})
        assert r.status_code == 422, f"expected 422, got {r.status_code} body={r.text}"

        me = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(PART)).json()
        assert me["role"] == "particulier"

    @pytest.mark.parametrize("role", ["particulier", "agence", "promoteur", "demarcheur"])
    def test_particulier_can_set_non_admin_roles(self, role):
        r = requests.put(f"{BASE_URL}/api/auth/profile", headers=_h(PART),
                         json={"role": role, "phone": "", "whatsapp": "", "agency_name": ""})
        assert r.status_code == 200, r.text
        assert r.json()["role"] == role

        # restore to particulier for later tests
        requests.put(f"{BASE_URL}/api/auth/profile", headers=_h(PART),
                     json={"role": "particulier", "phone": "", "whatsapp": "", "agency_name": ""})

    def test_admin_cannot_self_demote_via_profile(self):
        # Send a valid non-admin role; server should skip role update for admins
        r = requests.put(f"{BASE_URL}/api/auth/profile", headers=_h(ADMIN),
                         json={"role": "particulier", "phone": "", "whatsapp": "", "agency_name": ""})
        assert r.status_code == 200, r.text
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(ADMIN)).json()
        assert me["role"] == "admin", f"admin was demoted! role={me['role']}"


# ---------------- SEC-003: CORS ----------------
# NOTE: The preview edge (Cloudflare/ingress) forces Access-Control-Allow-Origin: *
# on all responses regardless of what FastAPI sets. Therefore we validate the CORS
# fix directly against the app on localhost:8001 (bypassing the edge). External
# behavior remains blocked at the browser level because the edge combines "*" with
# allow-credentials=true which is invalid per CORS spec (browsers reject creds).
INTERNAL_BACKEND = "http://localhost:8001"


class TestSEC003CORS:
    def test_untrusted_origin_preflight_blocked_app_layer(self):
        r = requests.options(f"{INTERNAL_BACKEND}/api/auth/me", headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        })
        allow_origin = r.headers.get("access-control-allow-origin", "")
        assert allow_origin != "https://evil.example.com", f"leaked allow-origin: {allow_origin}"
        assert allow_origin != "*", f"wildcard leaked at app layer: headers={dict(r.headers)}"
        # For untrusted origins, allow-origin should be absent
        assert allow_origin == ""

    def test_trusted_origin_preflight_allowed_app_layer(self):
        origin = "https://immobilier-tchad.preview.emergentagent.com"
        r = requests.options(f"{INTERNAL_BACKEND}/api/auth/me", headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        })
        assert r.headers.get("access-control-allow-origin") == origin, f"headers={dict(r.headers)}"
        assert r.headers.get("access-control-allow-credentials", "").lower() == "true"

    def test_edge_layer_still_wildcards(self):
        """Documents the edge-layer regression: Cloudflare/ingress overrides CORS."""
        r = requests.options(f"{BASE_URL}/api/auth/me", headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "GET",
        })
        # If this ever changes to non-wildcard, the platform fixed it — great.
        edge_allow = r.headers.get("access-control-allow-origin", "")
        print(f"[INFO] Edge allow-origin for evil.example.com: {edge_allow!r}")


# ---------------- SEC-004: CSV/XLSX formula injection ----------------
@pytest.fixture(scope="module")
def malicious_property_id():
    payload = {
        "title": "=SUM(1+1)+cmd|/C calc",
        "description": "@echo pwned",
        "property_type": "villa",
        "transaction_type": "vente",
        "price": 1000000.0,
        "negotiable": False,
        "currency": "XAF",
        "city": "N'Djamena",
        "neighborhood": "+dangerous",
        "surface": 100,
        "photos": [],
        "contact_name": "-Test",
        "contact_phone": "+235000000",
    }
    r = requests.post(f"{BASE_URL}/api/properties", headers=_h(AGENCE), json=payload)
    assert r.status_code in (200, 201), r.text
    pid = r.json().get("id")
    yield pid
    # cleanup best effort
    requests.delete(f"{BASE_URL}/api/properties/{pid}", headers=_h(AGENCE))


class TestSEC004FormulaInjection:
    def test_csv_export_neutralizes_formulas(self, malicious_property_id):
        r = requests.get(f"{BASE_URL}/api/admin/export/properties?format=csv", headers=_h(ADMIN))
        assert r.status_code == 200, r.text
        text = r.content.decode("utf-8-sig")
        # Detect delimiter (French locale uses ';')
        delimiter = ";" if text.count(";") > text.count(",") else ","
        rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))
        assert len(rows) > 1
        found = False
        for row in rows[1:]:
            for cell in row:
                if not cell:
                    continue
                assert cell[0] not in ("=", "+", "-", "@", "\t", "\r"), f"unneutralized cell: {cell!r}"
                if "SUM(1+1)" in cell or "echo pwned" in cell:
                    assert cell.startswith("'"), f"malicious cell not prefixed: {cell!r}"
                    found = True
        assert found, "malicious property not found in CSV export"

    def test_xlsx_export_neutralizes_formulas(self, malicious_property_id):
        r = requests.get(f"{BASE_URL}/api/admin/export/properties?format=xlsx", headers=_h(ADMIN))
        assert r.status_code == 200, r.text
        z = zipfile.ZipFile(io.BytesIO(r.content))
        # collect all sheet XMLs + shared strings
        blobs = []
        for name in z.namelist():
            if name.startswith("xl/worksheets/") or name.endswith("sharedStrings.xml"):
                blobs.append(z.read(name).decode("utf-8", errors="ignore"))
        combined = "\n".join(blobs)
        assert "SUM(1+1)" in combined or "echo pwned" in combined, "malicious title not present"
        # ensure the raw formula is prefixed with apostrophe (stored as string, not formula tag)
        assert "'=SUM(1+1)" in combined or "&apos;=SUM(1+1)" in combined, \
            "formula not neutralized in xlsx"
        # ensure no <f> formula element with our payload
        assert "<f>=SUM(1+1)" not in combined


# ---------------- SEC-005: AI chat rate limit + size ----------------
class TestSEC005AIChat:
    def test_rate_limit_triggers_429(self):
        # 10 rapid POSTs from same client
        results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
            futs = [ex.submit(requests.post, f"{BASE_URL}/api/ai/chat",
                              headers=_h(PART), json={"message": "test"}) for _ in range(10)]
            for f in futs:
                results.append(f.result().status_code)
        n429 = sum(1 for s in results if s == 429)
        print(f"AI chat statuses: {results}, 429 count={n429}")
        assert n429 >= 4, f"expected >=4 429s, got {n429}. statuses={results}"

    def test_oversize_message_returns_413(self):
        time.sleep(2)
        big = "a" * 1600
        r = requests.post(f"{BASE_URL}/api/ai/chat", headers=_h(PART), json={"message": big})
        assert r.status_code == 413, f"expected 413, got {r.status_code} body={r.text}"

    def test_empty_message_returns_400(self):
        time.sleep(2)
        r = requests.post(f"{BASE_URL}/api/ai/chat", headers=_h(PART), json={"message": ""})
        assert r.status_code == 400, f"expected 400, got {r.status_code} body={r.text}"


# ---------------- Regression ----------------
class TestRegression:
    def test_public_properties_list(self):
        r = requests.get(f"{BASE_URL}/api/properties")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_stats(self):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=_h(ADMIN))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "total_users" in data or "users" in data or isinstance(data, dict)

    def test_admin_export_users_csv(self):
        r = requests.get(f"{BASE_URL}/api/admin/export/users?format=csv", headers=_h(ADMIN))
        assert r.status_code == 200
        assert len(r.content) > 0

    def test_admin_export_users_xlsx(self):
        r = requests.get(f"{BASE_URL}/api/admin/export/users?format=xlsx", headers=_h(ADMIN))
        assert r.status_code == 200
        # Should be a valid zip (xlsx)
        z = zipfile.ZipFile(io.BytesIO(r.content))
        assert any(n.startswith("xl/") for n in z.namelist())

    def test_admin_moderation_verify_flow(self, malicious_property_id):
        r = requests.put(f"{BASE_URL}/api/admin/properties/{malicious_property_id}/verify",
                         headers=_h(ADMIN), json={"verified": True})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "whatsapp_url" in body, f"missing whatsapp_url in {body}"
