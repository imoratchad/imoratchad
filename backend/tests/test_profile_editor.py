"""
Profile editor backend tests — PUT /api/auth/profile
Covers: name validation, picture size cap, bio truncation, role rejection,
        admin self-demotion prevention.
"""
import base64
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

ADMIN = "test_session_admin"
AGENCE = "test_session_agence"
PART = "test_session_particulier"


def _h(tok):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {tok}"}


def _b64_image(raw_bytes: int) -> str:
    return "data:image/webp;base64," + base64.b64encode(b"A" * raw_bytes).decode("ascii")


class TestProfileEditor:
    """PUT /api/auth/profile — new fields"""

    def test_full_valid_payload_ok(self):
        payload = {
            "role": "agence",
            "name": "TEST Agence Demo",
            "picture": _b64_image(2048),
            "phone": "+235 64 92 73 80",
            "whatsapp": "+235 64 92 73 80",
            "agency_name": "TEST Immobilière Sahel",
            "bio": "Agence spécialisée en immobilier à N'Djamena.",
        }
        r = requests.put(f"{BASE_URL}/api/auth/profile", headers=_h(AGENCE), json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "TEST Agence Demo"
        assert data["agency_name"] == "TEST Immobilière Sahel"
        assert data["bio"].startswith("Agence spécialisée")
        assert data["phone"] == "+235 64 92 73 80"
        assert data["picture"].startswith("data:image/webp;base64,")
        assert data["role"] == "agence"

        # GET verifies persistence
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(AGENCE))
        assert me.status_code == 200
        m = me.json()
        assert m["name"] == "TEST Agence Demo"
        assert m["bio"].startswith("Agence spécialisée")

    def test_empty_name_400(self):
        r = requests.put(
            f"{BASE_URL}/api/auth/profile",
            headers=_h(AGENCE),
            json={"role": "agence", "name": "   "},
        )
        assert r.status_code == 400
        assert "nom" in r.json().get("detail", "").lower()

    def test_name_over_80_chars_truncated(self):
        long_name = "N" * 200
        r = requests.put(
            f"{BASE_URL}/api/auth/profile",
            headers=_h(AGENCE),
            json={"role": "agence", "name": long_name, "agency_name": "TEST Sahel"},
        )
        assert r.status_code == 200
        assert len(r.json()["name"]) == 80

    def test_picture_over_1mb_413(self):
        # >1MB base64 string
        big = _b64_image(1024 * 1024)  # 1MB raw ≈ 1.37MB base64 → >1MB after prefix
        r = requests.put(
            f"{BASE_URL}/api/auth/profile",
            headers=_h(AGENCE),
            json={"role": "agence", "picture": big, "agency_name": "TEST Sahel"},
        )
        assert r.status_code == 413
        assert "Photo" in r.json().get("detail", "") or "1 MB" in r.json().get("detail", "")

    def test_bio_over_500_chars_truncated(self):
        long_bio = "b" * 800
        r = requests.put(
            f"{BASE_URL}/api/auth/profile",
            headers=_h(AGENCE),
            json={"role": "agence", "bio": long_bio, "agency_name": "TEST Sahel"},
        )
        assert r.status_code == 200
        assert len(r.json()["bio"]) == 500

    def test_role_admin_rejected_422(self):
        r = requests.put(
            f"{BASE_URL}/api/auth/profile",
            headers=_h(PART),
            json={"role": "admin", "name": "hacker"},
        )
        assert r.status_code == 422

    def test_admin_cannot_self_demote(self):
        # Admin sends role='particulier' — server must ignore
        r = requests.put(
            f"{BASE_URL}/api/auth/profile",
            headers=_h(ADMIN),
            json={"role": "particulier", "name": "IMORA Admin"},
        )
        assert r.status_code == 200
        assert r.json()["role"] == "admin"  # unchanged

    def test_unauthenticated_401(self):
        r = requests.put(
            f"{BASE_URL}/api/auth/profile",
            headers={"Content-Type": "application/json"},
            json={"role": "particulier", "name": "x"},
        )
        assert r.status_code == 401
