"""
Pre-Play-Store hardening regression tests (8 tasks).
Covers: report system, pagination + X-Total-Count, GZip, Security headers,
and regression for admin moderation (whatsapp_url) + AI chat rate limit + SEC-001.
"""
import io
import os
import gzip
import json
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://immobilier-tchad.preview.emergentagent.com").rstrip("/")
ADMIN = "test_session_admin"
PART = "test_session_particulier"
AGENCE = "test_session_agence"


def _h(tok=None, extra=None):
    h = {"Content-Type": "application/json"}
    if tok:
        h["Authorization"] = f"Bearer {tok}"
    if extra:
        h.update(extra)
    return h


# ---------- Helpers ----------
@pytest.fixture(scope="module")
def property_id():
    """Get any existing active property id, or create one."""
    r = requests.get(f"{BASE_URL}/api/properties?limit=1")
    assert r.status_code == 200
    lst = r.json()
    if lst:
        return lst[0]["id"]
    payload = {
        "title": "TEST_hardening_prop",
        "description": "Property for hardening tests",
        "property_type": "villa",
        "transaction_type": "vente",
        "price": 5000000,
        "city": "N'Djamena",
        "neighborhood": "TEST_neigh",
        "photos": [],
        "contact_name": "Tester",
        "contact_phone": "+23500000000",
    }
    r = requests.post(f"{BASE_URL}/api/properties", headers=_h(AGENCE), json=payload)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


# ---------- TASK 2: Report system ----------
class TestReports:
    def test_report_anonymous_ok(self, property_id):
        r = requests.post(
            f"{BASE_URL}/api/properties/{property_id}/report",
            json={"reason": "Arnaque suspectée", "details": "TEST anon"},
        )
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["ok"] is True
        assert "id" in b

    def test_report_authenticated_ok(self, property_id):
        r = requests.post(
            f"{BASE_URL}/api/properties/{property_id}/report",
            headers=_h(PART),
            json={
                "reason": "Faux/frauduleux",
                "details": "TEST auth report",
                "reporter_name": "TEST Reporter",
                "reporter_phone": "+235123",
                "reporter_email": "t@e.com",
            },
        )
        assert r.status_code == 200, r.text

    def test_report_missing_reason_400(self, property_id):
        r = requests.post(
            f"{BASE_URL}/api/properties/{property_id}/report",
            json={"reason": "", "details": "x"},
        )
        assert r.status_code == 400, r.text

    def test_report_bad_property_404(self):
        r = requests.post(
            f"{BASE_URL}/api/properties/nonexistent-id/report",
            json={"reason": "Test"},
        )
        assert r.status_code == 404

    def test_admin_list_reports(self):
        r = requests.get(f"{BASE_URL}/api/admin/reports", headers=_h(ADMIN))
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 1
        first = items[0]
        for k in ("id", "property_id", "reason", "status", "created_at"):
            assert k in first
        # ObjectId not leaked
        assert "_id" not in first

    def test_admin_list_reports_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/reports", headers=_h(PART))
        assert r.status_code == 403

    def test_admin_update_report_status(self):
        lst = requests.get(f"{BASE_URL}/api/admin/reports", headers=_h(ADMIN)).json()
        assert lst, "need at least one report"
        rid = lst[0]["id"]
        r = requests.put(
            f"{BASE_URL}/api/admin/reports/{rid}",
            headers=_h(ADMIN),
            json={"status": "reviewed"},
        )
        assert r.status_code == 200, r.text
        # Verify persisted
        lst2 = requests.get(f"{BASE_URL}/api/admin/reports", headers=_h(ADMIN)).json()
        match = [x for x in lst2 if x["id"] == rid]
        assert match and match[0]["status"] == "reviewed"

    def test_admin_update_report_invalid_status(self):
        lst = requests.get(f"{BASE_URL}/api/admin/reports", headers=_h(ADMIN)).json()
        rid = lst[0]["id"]
        r = requests.put(
            f"{BASE_URL}/api/admin/reports/{rid}",
            headers=_h(ADMIN),
            json={"status": "bogus"},
        )
        assert r.status_code == 400


# ---------- TASK 6: Pagination + X-Total-Count ----------
class TestPagination:
    def test_limit_and_total_header(self):
        r = requests.get(f"{BASE_URL}/api/properties?limit=5&skip=0")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) <= 5
        assert "x-total-count" in {k.lower() for k in r.headers.keys()}, dict(r.headers)
        total = int(r.headers["x-total-count"])
        assert total >= len(items)

    def test_expose_headers(self):
        r = requests.get(f"{BASE_URL}/api/properties?limit=1")
        expose = r.headers.get("access-control-expose-headers", "").lower()
        assert "x-total-count" in expose

    def test_pagination_skip(self):
        r1 = requests.get(f"{BASE_URL}/api/properties?limit=2&skip=0")
        r2 = requests.get(f"{BASE_URL}/api/properties?limit=2&skip=2")
        assert r1.status_code == r2.status_code == 200
        ids1 = [p["id"] for p in r1.json()]
        ids2 = [p["id"] for p in r2.json()]
        # No overlap
        assert not (set(ids1) & set(ids2)) or len(ids1) < 2


# ---------- TASK 7: GZip compression ----------
class TestGzip:
    def test_gzip_encoding_applied(self):
        r = requests.get(
            f"{BASE_URL}/api/properties?limit=20",
            headers={"Accept-Encoding": "gzip"},
        )
        assert r.status_code == 200
        enc = r.headers.get("content-encoding", "").lower()
        assert "gzip" in enc, f"expected gzip, got {enc!r}. headers={dict(r.headers)}"

    def test_gzip_reduces_size(self):
        # raw response size vs decoded
        s = requests.Session()
        r = s.get(
            f"{BASE_URL}/api/properties?limit=20",
            headers={"Accept-Encoding": "gzip"},
            stream=True,
        )
        raw = r.raw.read()
        # If it is gzip, raw compressed size should be less than decoded json length
        if r.headers.get("content-encoding", "").lower() == "gzip":
            decoded = gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw
            # Only assert compression benefit when payload is decently sized
            if len(decoded) > 500:
                assert len(raw) < len(decoded), f"raw={len(raw)} decoded={len(decoded)}"


# ---------- TASK 8: Security headers ----------
class TestSecurityHeaders:
    @pytest.fixture(scope="class")
    def resp(self):
        return requests.get(f"{BASE_URL}/api/")

    def test_hsts(self, resp):
        v = resp.headers.get("strict-transport-security", "")
        assert "max-age=31536000" in v
        assert "includeSubDomains" in v
        assert "preload" in v

    def test_x_content_type_options(self, resp):
        assert resp.headers.get("x-content-type-options", "").lower() == "nosniff"

    def test_x_frame_options(self, resp):
        assert resp.headers.get("x-frame-options", "").upper() == "SAMEORIGIN"

    def test_referrer_policy(self, resp):
        assert resp.headers.get("referrer-policy", "") == "strict-origin-when-cross-origin"

    def test_permissions_policy(self, resp):
        pp = resp.headers.get("permissions-policy", "").lower()
        assert pp, "permissions-policy header missing"
        # should mention camera + geolocation restrictions
        assert "camera" in pp or "geolocation" in pp


# ---------- Regression: admin moderation whatsapp_url still there ----------
class TestRegression:
    def test_admin_verify_property_whatsapp(self, property_id):
        r = requests.put(
            f"{BASE_URL}/api/admin/properties/{property_id}/verify",
            headers=_h(ADMIN),
            json={"verified": True},
        )
        assert r.status_code == 200, r.text
        b = r.json()
        assert "whatsapp_url" in b

    def test_sec001_blocks_admin_escalation(self):
        r = requests.put(
            f"{BASE_URL}/api/auth/profile",
            headers=_h(PART),
            json={"role": "admin", "phone": "", "whatsapp": "", "agency_name": ""},
        )
        assert r.status_code == 422

    def test_ai_chat_413_oversize(self):
        time.sleep(2)
        big = "a" * 1600
        r = requests.post(
            f"{BASE_URL}/api/ai/chat", headers=_h(PART), json={"message": big}
        )
        assert r.status_code == 413

    def test_public_list_no_objectid(self):
        r = requests.get(f"{BASE_URL}/api/properties?limit=3")
        for p in r.json():
            assert "_id" not in p
