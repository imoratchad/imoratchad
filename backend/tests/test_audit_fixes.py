"""
Post-audit fix regression tests for IMORA Tchad backend.
Covers:
  SEC-001 CORS: FastAPI must not reflect untrusted origins; trusted origins allowed.
  SEC-002 Media caps: 413 on create AND update for too many/too large photos/videos/documents.
  SEC-003 Legacy auth: /api/auth/session returns 410 by default.
  Hardening: report rate-limit (6/min), email_verified default (code-level check via file grep).
  Regression: property CRUD, admin exports (formula neutral), moderation, AI chat, SEC-001 admin escalation, X-Total-Count.
"""
import base64
import concurrent.futures
import io
import os
import time
import zipfile

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
INTERNAL = "http://localhost:8001"

ADMIN = "test_session_admin"
PART = "test_session_particulier"
AGENCE = "test_session_agence"


def _h(tok=None):
    h = {"Content-Type": "application/json"}
    if tok:
        h["Authorization"] = f"Bearer {tok}"
    return h


def _b64_of_size(n_bytes: int, prefix: str = "data:image/jpeg;base64,") -> str:
    # Produce a base64 string whose total length is approximately n_bytes (raw payload after prefix).
    raw = b"A" * n_bytes
    return prefix + base64.b64encode(raw).decode("ascii")


def _min_property_payload(**overrides):
    payload = {
        "title": "TEST_audit_prop",
        "description": "audit test",
        "property_type": "villa",
        "transaction_type": "vente",
        "price": 5000000,
        "negotiable": False,
        "currency": "XAF",
        "city": "N'Djamena",
        "neighborhood": "TEST_audit",
        "surface": 100,
        "photos": [],
        "contact_name": "Tester",
        "contact_phone": "+235000000000",
    }
    payload.update(overrides)
    return payload


# ============================================================
# SEC-001: CORS
# ============================================================
class TestSEC001CORS:
    def test_untrusted_origin_not_reflected_by_fastapi(self):
        """Direct hit to FastAPI (bypasses Cloudflare edge) — evil origin must NOT be reflected."""
        r = requests.options(
            f"{INTERNAL}/api/properties",
            headers={
                "Origin": "https://evil.example.com",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
            timeout=5,
        )
        allow = r.headers.get("access-control-allow-origin", "")
        assert allow != "https://evil.example.com", f"leaked untrusted origin: {allow!r}"
        assert allow != "*", f"wildcard leaked at app layer: {allow!r}"
        assert allow == "", f"unexpected allow-origin: {allow!r}"

    def test_trusted_prod_origin_allowed(self):
        origin = "https://imoratchad.com"
        r = requests.options(
            f"{INTERNAL}/api/properties",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "authorization",
            },
            timeout=5,
        )
        assert r.headers.get("access-control-allow-origin") == origin, dict(r.headers)
        assert r.headers.get("access-control-allow-credentials", "").lower() == "true"

    def test_trusted_preview_origin_allowed(self):
        origin = "https://immobilier-tchad.preview.emergentagent.com"
        r = requests.options(
            f"{INTERNAL}/api/properties",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "authorization",
            },
            timeout=5,
        )
        assert r.headers.get("access-control-allow-origin") == origin, dict(r.headers)

    def test_arbitrary_preview_subdomain_no_longer_trusted(self):
        """Previously regex accepted any *.preview.emergentagent.com — must be closed."""
        r = requests.options(
            f"{INTERNAL}/api/properties",
            headers={
                "Origin": "https://attacker.preview.emergentagent.com",
                "Access-Control-Request-Method": "GET",
            },
            timeout=5,
        )
        allow = r.headers.get("access-control-allow-origin", "")
        assert allow != "https://attacker.preview.emergentagent.com", f"leaked: {allow!r}"


# ============================================================
# SEC-002: Media caps on create AND update
# ============================================================
@pytest.fixture(scope="module")
def owned_property_id():
    """Create a property owned by AGENCE for update tests. Cleaned up at end."""
    r = requests.post(f"{BASE_URL}/api/properties", headers=_h(AGENCE),
                      json=_min_property_payload(title="TEST_audit_owned"))
    assert r.status_code in (200, 201), r.text
    pid = r.json()["id"]
    yield pid
    requests.delete(f"{BASE_URL}/api/properties/{pid}", headers=_h(AGENCE))


class TestSEC002MediaCapsCreate:
    def test_too_many_photos_413(self):
        payload = _min_property_payload(photos=[_b64_of_size(1000) for _ in range(11)])
        r = requests.post(f"{BASE_URL}/api/properties", headers=_h(AGENCE), json=payload)
        assert r.status_code == 413, r.text
        assert "photo" in r.text.lower()

    def test_photo_too_large_413(self):
        # 6 MB raw → base64 > 5MB*1.4 threshold
        big = _b64_of_size(6 * 1024 * 1024)
        payload = _min_property_payload(photos=[big])
        r = requests.post(f"{BASE_URL}/api/properties", headers=_h(AGENCE), json=payload)
        assert r.status_code == 413, r.text
        assert "photo" in r.text.lower()

    def test_too_many_videos_413(self):
        payload = _min_property_payload(videos=[_b64_of_size(1000, "data:video/mp4;base64,") for _ in range(3)])
        r = requests.post(f"{BASE_URL}/api/properties", headers=_h(AGENCE), json=payload)
        assert r.status_code == 413, r.text
        assert "vid" in r.text.lower()

    def test_video_too_large_413(self):
        # Hit localhost:8001 to bypass Cloudflare edge body-size caps and reach FastAPI.
        big = _b64_of_size(30 * 1024 * 1024, "data:video/mp4;base64,")
        payload = _min_property_payload(videos=[big])
        # Requires an internal-auth path; localhost path uses same auth header.
        r = requests.post(f"{INTERNAL}/api/properties", headers=_h(AGENCE), json=payload, timeout=30)
        assert r.status_code == 413, f"got {r.status_code} body={r.text[:200]}"
        assert "vid" in r.text.lower() or "25" in r.text

    def test_too_many_documents_413(self):
        doc = {"type": "application/pdf", "name": "f.pdf", "data": _b64_of_size(500, "data:application/pdf;base64,")}
        payload = _min_property_payload(documents=[doc for _ in range(6)])
        r = requests.post(f"{BASE_URL}/api/properties", headers=_h(AGENCE), json=payload)
        assert r.status_code == 413, r.text
        assert "document" in r.text.lower()

    def test_document_too_large_413(self):
        # 9 MB raw → base64 ~ 12.6 MB > 8MB * 1.4 cap. Must trigger 413.
        big_data = _b64_of_size(9 * 1024 * 1024, "data:application/pdf;base64,")
        doc = {"type": "application/pdf", "name": "big.pdf", "data": big_data}
        payload = _min_property_payload(documents=[doc])
        r = requests.post(f"{INTERNAL}/api/properties", headers=_h(AGENCE), json=payload, timeout=30)
        assert r.status_code == 413, r.text
        assert "document" in r.text.lower(), r.text

    def test_document_under_cap_ok(self):
        # 2 MB raw → base64 ~ 2.8 MB. Under 8MB*1.4 cap. Must NOT trigger 413.
        data = _b64_of_size(2 * 1024 * 1024, "data:application/pdf;base64,")
        doc = {"type": "application/pdf", "name": "small.pdf", "data": data}
        payload = _min_property_payload(title="TEST_doc_under_cap", documents=[doc])
        r = requests.post(f"{INTERNAL}/api/properties", headers=_h(AGENCE), json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        pid = r.json().get("id")
        if pid:
            requests.delete(f"{BASE_URL}/api/properties/{pid}", headers=_h(AGENCE))


class TestSEC002MediaCapsUpdate:
    def test_update_too_many_photos_413(self, owned_property_id):
        payload = _min_property_payload(photos=[_b64_of_size(1000) for _ in range(11)])
        r = requests.put(f"{BASE_URL}/api/properties/{owned_property_id}",
                         headers=_h(AGENCE), json=payload)
        assert r.status_code == 413, r.text

    def test_update_video_too_large_413(self, owned_property_id):
        big = _b64_of_size(30 * 1024 * 1024, "data:video/mp4;base64,")
        payload = _min_property_payload(videos=[big])
        # Bypass Cloudflare edge body caps.
        r = requests.put(f"{INTERNAL}/api/properties/{owned_property_id}",
                         headers=_h(AGENCE), json=payload, timeout=30)
        assert r.status_code == 413, r.text

    def test_update_document_too_many_413(self, owned_property_id):
        doc = {"type": "application/pdf", "name": "f.pdf", "data": _b64_of_size(500, "data:application/pdf;base64,")}
        payload = _min_property_payload(documents=[doc for _ in range(6)])
        r = requests.put(f"{BASE_URL}/api/properties/{owned_property_id}",
                         headers=_h(AGENCE), json=payload)
        assert r.status_code == 413, r.text

    def test_update_document_too_large_413(self, owned_property_id):
        big_data = _b64_of_size(9 * 1024 * 1024, "data:application/pdf;base64,")
        doc = {"type": "application/pdf", "name": "big.pdf", "data": big_data}
        payload = _min_property_payload(documents=[doc])
        r = requests.put(f"{INTERNAL}/api/properties/{owned_property_id}",
                         headers=_h(AGENCE), json=payload, timeout=30)
        assert r.status_code == 413, r.text
        assert "document" in r.text.lower(), r.text

    def test_update_valid_media_ok(self, owned_property_id):
        payload = _min_property_payload(photos=[_b64_of_size(1000) for _ in range(3)])
        r = requests.put(f"{BASE_URL}/api/properties/{owned_property_id}",
                         headers=_h(AGENCE), json=payload)
        assert r.status_code == 200, r.text


# ============================================================
# SEC-003: Legacy /api/auth/session gated
# ============================================================
class TestSEC003LegacyAuth:
    def test_session_endpoint_returns_410(self):
        r = requests.post(f"{BASE_URL}/api/auth/session", json={"session_id": "anything"})
        assert r.status_code == 410, r.text
        body = r.json()
        assert "detail" in body
        assert "retiré" in body["detail"].lower() or "google" in body["detail"].lower()

    def test_google_endpoint_still_reachable(self):
        # With empty GOOGLE_CLIENT_SECRET, endpoint should reject with 500 "non configuré"
        r = requests.post(f"{BASE_URL}/api/auth/google",
                          json={"code": "fake", "redirect_uri": "https://x/y"})
        assert r.status_code in (500, 401), r.text
        # If 500, message must mention config
        if r.status_code == 500:
            assert "config" in r.text.lower() or "google" in r.text.lower()

    def test_auth_me_still_works(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(ADMIN))
        assert r.status_code == 200, r.text
        assert r.json().get("role") == "admin"


# ============================================================
# Hardening: report rate limit (6/min)
# ============================================================
@pytest.fixture(scope="module")
def any_property_id():
    r = requests.get(f"{BASE_URL}/api/properties?limit=1")
    assert r.status_code == 200
    lst = r.json()
    if lst:
        return lst[0]["id"]
    # Fallback: create one
    r = requests.post(f"{BASE_URL}/api/properties", headers=_h(AGENCE),
                      json=_min_property_payload(title="TEST_report_target"))
    assert r.status_code in (200, 201)
    return r.json()["id"]


class TestReportRateLimit:
    def test_report_rate_limit_kicks_in_per_xff(self, any_property_id):
        """15 concurrent anon reports with same X-Forwarded-For → ~6 OK, ~9 429 (per-IP window of 6/min).
        Hits INTERNAL to preserve our XFF header untouched by Cloudflare."""
        time.sleep(3)
        url = f"{INTERNAL}/api/properties/{any_property_id}/report"
        xff = f"203.0.113.{int(time.time()) % 250 + 1}"  # unique-ish IP per run
        headers = {"Content-Type": "application/json", "X-Forwarded-For": xff}
        body = {"reason": "TEST_rate", "details": "burst"}
        with concurrent.futures.ThreadPoolExecutor(max_workers=15) as ex:
            futs = [ex.submit(requests.post, url, json=body, headers=headers, timeout=10) for _ in range(15)]
            statuses = [f.result().status_code for f in futs]
        n200 = sum(1 for s in statuses if s == 200)
        n429 = sum(1 for s in statuses if s == 429)
        print(f"[report xff burst xff={xff}] statuses={statuses} n200={n200} n429={n429}")
        # With real per-XFF isolation, we should now see exactly 6 accepted / 9 rejected.
        assert n200 <= 6, f"expected ≤6 accepted (per-IP cap), got {n200}. statuses={statuses}"
        assert n429 >= 9, f"expected ≥9 429s, got {n429}. statuses={statuses}"

    def test_report_rate_limit_fresh_budget_per_xff(self, any_property_id):
        """A DIFFERENT X-Forwarded-For gets a fresh 6/min budget — verifies real client IP is used
        for rate-key derivation (not the ingress hop IP)."""
        time.sleep(2)
        url = f"{INTERNAL}/api/properties/{any_property_id}/report"
        xff = f"198.51.100.{int(time.time()) % 250 + 1}"  # different subnet, unique-ish
        headers = {"Content-Type": "application/json", "X-Forwarded-For": xff}
        body = {"reason": "TEST_rate_fresh"}
        statuses = []
        for _ in range(8):
            statuses.append(requests.post(url, json=body, headers=headers, timeout=10).status_code)
        n200 = sum(1 for s in statuses if s == 200)
        n429 = sum(1 for s in statuses if s == 429)
        print(f"[report xff fresh xff={xff}] statuses={statuses} n200={n200} n429={n429}")
        # Fresh window → first 6 accepted, remaining 2 rejected.
        assert n200 == 6, f"expected exactly 6 accepted for fresh XFF, got {n200}. statuses={statuses}"
        assert n429 == 2, f"expected exactly 2 429s, got {n429}. statuses={statuses}"

    def test_report_client_ip_fallback_to_request_client_host(self, any_property_id):
        """Without XFF and without CF-Connecting-IP, _client_ip must fall back to request.client.host.
        We hit INTERNAL (localhost) so request.client.host = 127.0.0.1. Two requests from same host
        share a budget; not testing the exact cap here — just verifying the endpoint still works
        (no 500) with the fallback path."""
        time.sleep(65)  # let previous window for 127.0.0.1 expire
        url = f"{INTERNAL}/api/properties/{any_property_id}/report"
        r = requests.post(url, json={"reason": "TEST_fallback"}, timeout=10)
        assert r.status_code in (200, 429), r.text  # 200 if window fresh; 429 if collisions

    def test_report_authenticated_rate_limit_per_user(self, any_property_id):
        time.sleep(65)  # ensure window cleared
        url = f"{BASE_URL}/api/properties/{any_property_id}/report"
        body = {"reason": "TEST_auth_rate"}
        statuses = []
        for _ in range(10):
            statuses.append(requests.post(url, headers=_h(PART), json=body, timeout=10).status_code)
        n429 = sum(1 for s in statuses if s == 429)
        n200 = sum(1 for s in statuses if s == 200)
        print(f"[report auth burst] statuses={statuses}")
        assert n200 <= 7, f"expected ≤7 accepted, got {n200}"
        assert n429 >= 2, f"expected ≥2 429s, got {n429}"


# ============================================================
# email_verified default = False (code-level check)
# ============================================================
class TestEmailVerifiedDefault:
    def test_google_callback_rejects_unverified_email(self):
        """Static code check: /auth/google must treat missing email_verified as False."""
        with open("/app/backend/server.py", "r") as f:
            src = f.read()
        # Check the guard exists
        assert 'info.get("email_verified", False)' in src, \
            "email_verified default must be False in /auth/google handler"
        # Check the model default for User
        # (Only fail if a True default is present)
        assert "email_verified: bool = True" not in src, \
            "User model should not default email_verified=True"


# ============================================================
# Regression
# ============================================================
class TestRegression:
    def test_properties_list_has_x_total_count(self):
        r = requests.get(f"{BASE_URL}/api/properties?limit=3")
        assert r.status_code == 200
        assert "x-total-count" in {k.lower() for k in r.headers.keys()}, dict(r.headers)

    def test_property_crud_flow(self):
        # CREATE
        r = requests.post(f"{BASE_URL}/api/properties", headers=_h(AGENCE),
                          json=_min_property_payload(title="TEST_crud_flow"))
        assert r.status_code in (200, 201), r.text
        pid = r.json()["id"]
        # GET
        r = requests.get(f"{BASE_URL}/api/properties/{pid}")
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_crud_flow"
        # PUT
        r = requests.put(f"{BASE_URL}/api/properties/{pid}", headers=_h(AGENCE),
                         json=_min_property_payload(title="TEST_crud_flow_updated"))
        assert r.status_code == 200, r.text
        # DELETE
        r = requests.delete(f"{BASE_URL}/api/properties/{pid}", headers=_h(AGENCE))
        assert r.status_code == 200
        r = requests.get(f"{BASE_URL}/api/properties/{pid}")
        assert r.status_code == 404

    def test_admin_export_csv_formula_neutralized(self):
        r = requests.get(f"{BASE_URL}/api/admin/export/properties?format=csv",
                         headers=_h(ADMIN))
        assert r.status_code == 200
        text = r.content.decode("utf-8-sig", errors="ignore")
        # No unquoted formula starts
        for line in text.splitlines()[1:]:
            for cell in line.split(";" if ";" in line else ","):
                cell = cell.strip('"')
                if cell:
                    assert cell[0] not in ("=", "+", "@", "\t", "\r"), f"unneutralized: {cell!r}"

    def test_admin_export_xlsx_ok(self):
        r = requests.get(f"{BASE_URL}/api/admin/export/properties?format=xlsx",
                         headers=_h(ADMIN))
        assert r.status_code == 200
        zipfile.ZipFile(io.BytesIO(r.content))  # must be valid xlsx

    def test_admin_moderation_still_works(self, owned_property_id):
        r = requests.put(f"{BASE_URL}/api/admin/properties/{owned_property_id}/verify",
                         headers=_h(ADMIN), json={"verified": True})
        assert r.status_code == 200
        assert "whatsapp_url" in r.json()

    def test_sec001_admin_escalation_still_blocked(self):
        r = requests.put(f"{BASE_URL}/api/auth/profile", headers=_h(PART),
                         json={"role": "admin", "phone": "", "whatsapp": "", "agency_name": ""})
        assert r.status_code == 422, r.text

    def test_ai_chat_413_oversize(self):
        time.sleep(2)
        r = requests.post(f"{BASE_URL}/api/ai/chat", headers=_h(PART),
                          json={"message": "a" * 1600})
        assert r.status_code == 413, r.text

    def test_favorites_endpoint(self, owned_property_id):
        # Add fav
        r = requests.post(f"{BASE_URL}/api/favorites/{owned_property_id}", headers=_h(PART))
        assert r.status_code in (200, 201), r.text
        # List
        r = requests.get(f"{BASE_URL}/api/favorites", headers=_h(PART))
        assert r.status_code == 200
        assert any(p.get("id") == owned_property_id for p in r.json())
        # Remove
        r = requests.delete(f"{BASE_URL}/api/favorites/{owned_property_id}", headers=_h(PART))
        assert r.status_code == 200
