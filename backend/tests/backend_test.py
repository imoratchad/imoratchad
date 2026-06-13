"""
IMORA Tchad - Backend pytest suite
Tests against the public REACT_APP_BACKEND_URL using test session tokens.
"""
import os
import uuid
import pytest
import requests

BASE_URL = "https://immobilier-tchad.preview.emergentagent.com"

ADMIN_TOKEN = "test_session_admin"
PART_TOKEN = "test_session_particulier"
AGENCE_TOKEN = "test_session_agence"

ADMIN_USER_ID = "test-user-admin"
PART_USER_ID = "test-user-particulier"
AGENCE_USER_ID = "test-user-agence"


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# -------- Health --------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        d = r.json()
        assert d.get("status") == "ok"
        assert "IMORA" in d.get("app", "")


# -------- Auth --------
class TestAuth:
    def test_me_admin(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(ADMIN_TOKEN))
        assert r.status_code == 200
        u = r.json()
        assert u["user_id"] == ADMIN_USER_ID
        assert u["role"] == "admin"

    def test_me_no_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_bad_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_h("nope_token_xxx"))
        assert r.status_code == 401

    def test_update_profile(self):
        payload = {"role": "particulier", "phone": "+23566001122", "whatsapp": "+23566001122"}
        r = requests.put(f"{BASE_URL}/api/auth/profile", headers=_h(PART_TOKEN), json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["phone"] == "+23566001122"

    def test_non_admin_forbidden_on_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=_h(PART_TOKEN))
        assert r.status_code == 403


# -------- Properties --------
class TestProperties:
    created_id = None

    def test_list_default(self):
        r = requests.get(f"{BASE_URL}/api/properties")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_with_filters(self):
        params = {
            "city": "N'Djamena",
            "transaction_type": "vente",
            "min_price": 0,
            "max_price": 999999999,
            "q": "test",
        }
        r = requests.get(f"{BASE_URL}/api/properties", params=params)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_featured(self):
        r = requests.get(f"{BASE_URL}/api/properties/featured")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/properties", json={
            "title": "x", "description": "x", "property_type": "villa",
            "transaction_type": "vente", "price": 1, "city": "x",
            "neighborhood": "x", "contact_name": "x", "contact_phone": "x"
        })
        assert r.status_code == 401

    def test_create_property(self):
        payload = {
            "title": "TEST_Villa Moderne Klemat",
            "description": "Belle villa de test 4 chambres avec piscine",
            "property_type": "villa",
            "transaction_type": "vente",
            "price": 75000000,
            "negotiable": True,
            "city": "N'Djamena",
            "neighborhood": "Klemat",
            "arrondissement": "5e",
            "rooms": 4,
            "bathrooms": 3,
            "living_area": 250,
            "land_area": 400,
            "lat": 12.1348,
            "lng": 15.0557,
            "photos": [],
            "contact_name": "Test Agent",
            "contact_phone": "+235640000000",
            "contact_whatsapp": "+235640000000",
        }
        r = requests.post(f"{BASE_URL}/api/properties", headers=_h(AGENCE_TOKEN), json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["title"] == payload["title"]
        assert d["user_id"] == AGENCE_USER_ID
        assert d["status"] == "active"
        TestProperties.created_id = d["id"]

    def test_get_property_increments_views(self):
        assert TestProperties.created_id
        pid = TestProperties.created_id
        r1 = requests.get(f"{BASE_URL}/api/properties/{pid}")
        assert r1.status_code == 200
        v1 = r1.json()["views"]
        r2 = requests.get(f"{BASE_URL}/api/properties/{pid}")
        v2 = r2.json()["views"]
        assert v2 == v1 + 1
        assert "owner" in r2.json()

    def test_contact_increment(self):
        assert TestProperties.created_id
        pid = TestProperties.created_id
        before = requests.get(f"{BASE_URL}/api/properties/{pid}").json()["contact_count"]
        r = requests.post(f"{BASE_URL}/api/properties/{pid}/contact")
        assert r.status_code == 200
        after = requests.get(f"{BASE_URL}/api/properties/{pid}").json()["contact_count"]
        assert after == before + 1

    def test_update_owner_only(self):
        assert TestProperties.created_id
        pid = TestProperties.created_id
        payload = {
            "title": "TEST_Villa Modifiee",
            "description": "Updated",
            "property_type": "villa",
            "transaction_type": "vente",
            "price": 80000000,
            "city": "N'Djamena",
            "neighborhood": "Klemat",
            "contact_name": "Test Agent",
            "contact_phone": "+235640000000",
        }
        # particulier cannot update someone else's prop
        r_forbid = requests.put(f"{BASE_URL}/api/properties/{pid}", headers=_h(PART_TOKEN), json=payload)
        assert r_forbid.status_code == 403
        # owner agence can update
        r_ok = requests.put(f"{BASE_URL}/api/properties/{pid}", headers=_h(AGENCE_TOKEN), json=payload)
        assert r_ok.status_code == 200
        assert r_ok.json()["title"] == "TEST_Villa Modifiee"

    def test_delete_owner_only(self):
        assert TestProperties.created_id
        pid = TestProperties.created_id
        r_forbid = requests.delete(f"{BASE_URL}/api/properties/{pid}", headers=_h(PART_TOKEN))
        assert r_forbid.status_code == 403
        r_ok = requests.delete(f"{BASE_URL}/api/properties/{pid}", headers=_h(AGENCE_TOKEN))
        assert r_ok.status_code == 200
        # verify deleted
        r_get = requests.get(f"{BASE_URL}/api/properties/{pid}")
        assert r_get.status_code == 404


# -------- Favorites --------
class TestFavorites:
    @pytest.fixture(scope="class")
    def prop_id(self):
        # create a prop with agence
        payload = {
            "title": "TEST_Fav prop",
            "description": "for favs",
            "property_type": "appartement",
            "transaction_type": "location_mensuelle",
            "price": 200000,
            "city": "N'Djamena",
            "neighborhood": "Chagoua",
            "contact_name": "X", "contact_phone": "+235640000001"
        }
        r = requests.post(f"{BASE_URL}/api/properties", headers=_h(AGENCE_TOKEN), json=payload)
        assert r.status_code == 200
        pid = r.json()["id"]
        yield pid
        # cleanup
        requests.delete(f"{BASE_URL}/api/properties/{pid}", headers=_h(AGENCE_TOKEN))

    def test_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/favorites")
        assert r.status_code == 401

    def test_add_list_remove(self, prop_id):
        r_add = requests.post(f"{BASE_URL}/api/favorites/{prop_id}", headers=_h(PART_TOKEN))
        assert r_add.status_code == 200
        r_list = requests.get(f"{BASE_URL}/api/favorites", headers=_h(PART_TOKEN))
        assert r_list.status_code == 200
        ids = [p["id"] for p in r_list.json()]
        assert prop_id in ids
        r_del = requests.delete(f"{BASE_URL}/api/favorites/{prop_id}", headers=_h(PART_TOKEN))
        assert r_del.status_code == 200
        r_list2 = requests.get(f"{BASE_URL}/api/favorites", headers=_h(PART_TOKEN))
        ids2 = [p["id"] for p in r_list2.json()]
        assert prop_id not in ids2


# -------- Messages --------
class TestMessages:
    def test_send_and_list(self):
        payload = {"to_user_id": AGENCE_USER_ID, "content": "TEST_Bonjour, ce bien est-il disponible?"}
        r = requests.post(f"{BASE_URL}/api/messages", headers=_h(PART_TOKEN), json=payload)
        assert r.status_code == 200
        msg = r.json()
        assert msg["from_user_id"] == PART_USER_ID
        assert msg["content"] == payload["content"]
        # list for sender
        r_list = requests.get(f"{BASE_URL}/api/messages", headers=_h(PART_TOKEN))
        assert r_list.status_code == 200
        assert any(m["id"] == msg["id"] for m in r_list.json())
        # list for receiver (agence)
        r_list2 = requests.get(f"{BASE_URL}/api/messages", headers=_h(AGENCE_TOKEN))
        assert any(m["id"] == msg["id"] for m in r_list2.json())


# -------- Payments --------
class TestPayments:
    pay_id = None

    def test_create(self):
        payload = {
            "type": "premium",
            "amount": 5000,
            "method": "airtel",
            "transaction_id": f"TEST_TX_{uuid.uuid4().hex[:8]}",
            "payer_phone": "+23566992738",
            "note": "TEST payment",
        }
        r = requests.post(f"{BASE_URL}/api/payments", headers=_h(PART_TOKEN), json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "pending"
        assert d["amount"] == 5000
        TestPayments.pay_id = d["id"]

    def test_mine(self):
        r = requests.get(f"{BASE_URL}/api/payments/mine", headers=_h(PART_TOKEN))
        assert r.status_code == 200
        assert any(p["id"] == TestPayments.pay_id for p in r.json())


# -------- Feedback --------
class TestFeedback:
    def test_create_no_auth(self):
        r = requests.post(f"{BASE_URL}/api/feedback", json={
            "name": "TEST anon", "rating": 4, "type": "suggestion", "message": "Ajoutez plus d'images"
        })
        assert r.status_code == 200
        assert r.json()["user_id"] is None

    def test_create_with_auth(self):
        r = requests.post(f"{BASE_URL}/api/feedback", headers=_h(PART_TOKEN), json={
            "name": "TEST user", "rating": 5, "type": "feature", "message": "Top app"
        })
        assert r.status_code == 200
        assert r.json()["user_id"] == PART_USER_ID


# -------- Admin --------
class TestAdmin:
    def test_stats(self):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=_h(ADMIN_TOKEN))
        assert r.status_code == 200
        d = r.json()
        for k in ["total_users", "total_properties", "revenue", "active_sessions"]:
            assert k in d

    def test_users_list(self):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=_h(ADMIN_TOKEN))
        assert r.status_code == 200
        emails = [u["email"] for u in r.json()]
        assert "imoratchad@gmail.com" in emails

    def test_update_user(self):
        r = requests.put(
            f"{BASE_URL}/api/admin/users/{AGENCE_USER_ID}",
            headers=_h(ADMIN_TOKEN),
            json={"verified_agency": True}
        )
        assert r.status_code == 200
        assert r.json()["verified_agency"] is True
        # revert
        requests.put(
            f"{BASE_URL}/api/admin/users/{AGENCE_USER_ID}",
            headers=_h(ADMIN_TOKEN),
            json={"verified_agency": False}
        )

    def test_verify_property(self):
        # create property to verify
        payload = {
            "title": "TEST_Admin verify",
            "description": "to be verified",
            "property_type": "terrain_residentiel",
            "transaction_type": "vente",
            "price": 10000000,
            "city": "N'Djamena",
            "neighborhood": "Diguel",
            "contact_name": "X", "contact_phone": "+235640000002"
        }
        r0 = requests.post(f"{BASE_URL}/api/properties", headers=_h(AGENCE_TOKEN), json=payload)
        pid = r0.json()["id"]
        try:
            r = requests.put(
                f"{BASE_URL}/api/admin/properties/{pid}/verify",
                headers=_h(ADMIN_TOKEN),
                json={"verified": True, "featured": True, "status": "active"}
            )
            assert r.status_code == 200
            d = r.json()
            assert d["verified"] is True
            assert d["featured"] is True
        finally:
            requests.delete(f"{BASE_URL}/api/properties/{pid}", headers=_h(AGENCE_TOKEN))

    def test_admin_payments_and_update(self):
        # create one
        pay = requests.post(f"{BASE_URL}/api/payments", headers=_h(PART_TOKEN), json={
            "type": "boost", "amount": 1000, "method": "moov",
            "transaction_id": f"TEST_TX_{uuid.uuid4().hex[:8]}"
        }).json()
        pid = pay["id"]
        r_list = requests.get(f"{BASE_URL}/api/admin/payments", headers=_h(ADMIN_TOKEN))
        assert r_list.status_code == 200
        assert any(p["id"] == pid for p in r_list.json())
        r_upd = requests.put(
            f"{BASE_URL}/api/admin/payments/{pid}",
            headers=_h(ADMIN_TOKEN),
            json={"status": "confirmed"}
        )
        assert r_upd.status_code == 200
        assert r_upd.json()["status"] == "confirmed"

    def test_admin_feedback(self):
        r = requests.get(f"{BASE_URL}/api/admin/feedback", headers=_h(ADMIN_TOKEN))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# -------- AI Chat --------
class TestAI:
    def test_chat(self):
        r = requests.post(
            f"{BASE_URL}/api/ai/chat",
            headers=_h(PART_TOKEN),
            json={"message": "Bonjour, je cherche une villa a N'Djamena"},
            timeout=60
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "session_id" in d
        assert "reply" in d
        assert isinstance(d["reply"], str)
        assert len(d["reply"]) > 5

    def test_chat_continues_session(self):
        r1 = requests.post(
            f"{BASE_URL}/api/ai/chat",
            json={"message": "Quels quartiers recommandes-tu ?"},
            timeout=60
        )
        assert r1.status_code == 200
        sid = r1.json()["session_id"]
        r2 = requests.post(
            f"{BASE_URL}/api/ai/chat",
            json={"message": "Et pour la location ?", "session_id": sid},
            timeout=60
        )
        assert r2.status_code == 200
        assert r2.json()["session_id"] == sid
