"""
ReVent Backend Tests
Tests: health, auth (register/login/me/logout), chat, profile update, coins
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

TEST_EMAIL = f"TEST_revent_{uuid.uuid4().hex[:6]}@test.com"
TEST_PASSWORD = "Test123!"
TEST_NAME = "TestUser"

EXISTING_EMAIL = "testuser_vent@test.com"
EXISTING_PASSWORD = "Test123!"


@pytest.fixture(scope="module")
def session():
    """Shared session with cookies"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_session(session):
    """Session authenticated via login with existing user"""
    res = session.post(f"{BASE_URL}/api/auth/login", json={"email": EXISTING_EMAIL, "password": EXISTING_PASSWORD})
    if res.status_code != 200:
        pytest.skip(f"Login failed: {res.status_code} - {res.text}")
    return session


# ─── Health ─────────────────────────────────────────────────────────────────

class TestHealth:
    """Health check tests"""

    def test_health_endpoint(self):
        res = requests.get(f"{BASE_URL}/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert "service" in data
        print(f"Health check passed: {data}")


# ─── Auth - Registration ──────────────────────────────────────────────────────

class TestAuthRegister:
    """Registration tests"""

    def test_register_new_user(self, session):
        res = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD, "name": TEST_NAME
        })
        assert res.status_code == 200, f"Register failed: {res.status_code} {res.text}"
        data = res.json()
        assert "user_id" in data
        assert data["email"] == TEST_EMAIL.lower()
        assert data["name"] == TEST_NAME
        assert "coins" in data
        assert data["coins"] == 2000
        assert data["is_first_login"] is True
        assert data["onboarding_complete"] is False
        print(f"Register success: user_id={data['user_id']}, coins={data['coins']}")

    def test_register_duplicate_email(self, session):
        # Try registering same email again
        res = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD, "name": TEST_NAME
        })
        assert res.status_code == 400
        data = res.json()
        assert "detail" in data
        print(f"Duplicate email properly rejected: {data['detail']}")


# ─── Auth - Login ─────────────────────────────────────────────────────────────

class TestAuthLogin:
    """Login tests"""

    def test_login_valid_credentials(self, session):
        res = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_EMAIL, "password": EXISTING_PASSWORD
        })
        assert res.status_code == 200, f"Login failed: {res.status_code} {res.text}"
        data = res.json()
        assert "user_id" in data
        assert "email" in data
        assert "coins" in data
        print(f"Login success: user_id={data['user_id']}, onboarding={data.get('onboarding_complete')}")

    def test_login_invalid_password(self, session):
        res = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_EMAIL, "password": "WrongPassword"
        })
        assert res.status_code == 401
        data = res.json()
        assert "detail" in data
        print(f"Invalid login properly rejected: {data['detail']}")

    def test_login_nonexistent_email(self, session):
        res = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com", "password": "Test123!"
        })
        assert res.status_code == 401
        print("Non-existent email properly rejected")

    def test_login_missing_fields(self, session):
        res = session.post(f"{BASE_URL}/api/auth/login", json={"email": EXISTING_EMAIL})
        assert res.status_code == 422
        print("Missing fields properly rejected")


# ─── Auth - Me ────────────────────────────────────────────────────────────────

class TestAuthMe:
    """Auth me endpoint tests"""

    def test_get_me_authenticated(self, auth_session):
        res = auth_session.get(f"{BASE_URL}/api/auth/me")
        assert res.status_code == 200, f"Get me failed: {res.status_code} {res.text}"
        data = res.json()
        assert "user_id" in data
        assert "email" in data
        assert data["email"] == EXISTING_EMAIL.lower()
        assert "coins" in data
        assert "onboarding_complete" in data
        print(f"Auth me success: {data['email']}, coins={data['coins']}")

    def test_get_me_unauthenticated(self):
        fresh_session = requests.Session()
        res = fresh_session.get(f"{BASE_URL}/api/auth/me")
        assert res.status_code == 401
        print("Unauthenticated me properly rejected")


# ─── Chat ─────────────────────────────────────────────────────────────────────

class TestChat:
    """Chat endpoint tests"""

    def test_chat_basic_message(self, auth_session):
        session_id = f"sess_test_{uuid.uuid4().hex[:8]}"
        res = auth_session.post(f"{BASE_URL}/api/chat", json={
            "message": "I had a really bad day",
            "session_id": session_id,
            "language": "English",
            "manual_mode": "AUTO",
            "persona_config": {},
            "force_vault": False,
        })
        assert res.status_code == 200, f"Chat failed: {res.status_code} {res.text}"
        data = res.json()
        assert "response" in data
        assert isinstance(data["response"], str)
        assert len(data["response"]) > 0
        assert "mode" in data
        assert "coins_remaining" in data
        assert "intensity_score" in data
        print(f"Chat success: mode={data['mode']}, response_len={len(data['response'])}, coins={data['coins_remaining']}")

    def test_chat_gossip_mode(self, auth_session):
        session_id = f"sess_gossip_{uuid.uuid4().hex[:8]}"
        res = auth_session.post(f"{BASE_URL}/api/chat", json={
            "message": "You won't believe what my friend did",
            "session_id": session_id,
            "language": "English",
            "manual_mode": "GOSSIP",
            "persona_config": {},
            "force_vault": True,
        })
        assert res.status_code == 200, f"Gossip chat failed: {res.status_code} {res.text}"
        data = res.json()
        assert "response" in data
        assert len(data["response"]) > 0
        assert data["mode"] == "GOSSIP"
        assert data["is_vault"] is True
        print(f"Gossip chat success: mode={data['mode']}, is_vault={data['is_vault']}")

    def test_chat_hear_me_mode(self, auth_session):
        session_id = f"sess_hearm_{uuid.uuid4().hex[:8]}"
        res = auth_session.post(f"{BASE_URL}/api/chat", json={
            "message": "I'm feeling really lonely",
            "session_id": session_id,
            "language": "English",
            "manual_mode": "HEAR_ME",
            "persona_config": {},
            "force_vault": False,
        })
        assert res.status_code == 200, f"HEAR_ME chat failed: {res.status_code} {res.text}"
        data = res.json()
        assert data["mode"] == "HEAR_ME"
        print(f"HEAR_ME mode success: response_len={len(data['response'])}")

    def test_chat_back_me_mode(self, auth_session):
        session_id = f"sess_backm_{uuid.uuid4().hex[:8]}"
        res = auth_session.post(f"{BASE_URL}/api/chat", json={
            "message": "My boss is being totally unfair!",
            "session_id": session_id,
            "language": "English",
            "manual_mode": "BACK_ME",
            "persona_config": {},
            "force_vault": False,
        })
        assert res.status_code == 200, f"BACK_ME chat failed: {res.status_code} {res.text}"
        data = res.json()
        assert data["mode"] == "BACK_ME"
        print(f"BACK_ME mode success: response_len={len(data['response'])}")

    def test_chat_anonymous_user(self):
        # Chat works without authentication (anonymous mode)
        fresh_session = requests.Session()
        session_id = f"sess_anon_{uuid.uuid4().hex[:8]}"
        res = fresh_session.post(f"{BASE_URL}/api/chat", json={
            "message": "Test message",
            "session_id": session_id,
            "language": "English",
            "manual_mode": "AUTO",
            "persona_config": {},
            "force_vault": False,
        })
        assert res.status_code == 200, f"Anonymous chat failed: {res.status_code} {res.text}"
        data = res.json()
        assert "response" in data
        print(f"Anonymous chat success: mode={data['mode']}")


# ─── User Profile ─────────────────────────────────────────────────────────────

class TestUserProfile:
    """User profile update tests"""

    def test_update_profile_language(self, auth_session):
        res = auth_session.post(f"{BASE_URL}/api/user/update-profile", json={
            "language": "English"
        })
        assert res.status_code == 200, f"Profile update failed: {res.status_code} {res.text}"
        data = res.json()
        assert "user_id" in data
        print(f"Profile update success: language={data.get('language')}")

    def test_update_profile_onboarding(self, auth_session):
        res = auth_session.post(f"{BASE_URL}/api/user/update-profile", json={
            "onboarding_complete": True
        })
        assert res.status_code == 200, f"Onboarding update failed: {res.status_code} {res.text}"
        data = res.json()
        assert data.get("onboarding_complete") is True
        print(f"Onboarding update success: onboarding_complete={data['onboarding_complete']}")

    def test_update_profile_unauthenticated(self):
        fresh_session = requests.Session()
        res = fresh_session.post(f"{BASE_URL}/api/user/update-profile", json={"language": "English"})
        assert res.status_code == 401
        print("Unauthenticated profile update properly rejected")


# ─── Coins Balance ────────────────────────────────────────────────────────────

class TestCoins:
    """Coins balance tests"""

    def test_get_coins_balance(self, auth_session):
        res = auth_session.get(f"{BASE_URL}/api/coins/balance")
        assert res.status_code == 200, f"Coins balance failed: {res.status_code} {res.text}"
        data = res.json()
        assert "coins" in data
        assert isinstance(data["coins"], int)
        print(f"Coins balance success: coins={data['coins']}")

    def test_get_coins_unauthenticated(self):
        fresh_session = requests.Session()
        res = fresh_session.get(f"{BASE_URL}/api/coins/balance")
        assert res.status_code == 401
        print("Unauthenticated coins request properly rejected")


# ─── Mark First Login ─────────────────────────────────────────────────────────

class TestMarkFirstLogin:
    """Mark first login endpoint tests"""

    def test_mark_first_login_authenticated(self, auth_session):
        res = auth_session.post(f"{BASE_URL}/api/auth/mark-first-login")
        assert res.status_code == 200, f"Mark first login failed: {res.status_code} {res.text}"
        data = res.json()
        assert data.get("ok") is True
        print("Mark first login success")

    def test_mark_first_login_unauthenticated(self):
        fresh_session = requests.Session()
        res = fresh_session.post(f"{BASE_URL}/api/auth/mark-first-login")
        assert res.status_code == 401
        print("Unauthenticated mark first login properly rejected")


# ─── Logout ───────────────────────────────────────────────────────────────────

class TestLogout:
    """Logout tests - run last to preserve auth for other tests"""

    def test_logout(self, auth_session):
        # Create a separate session for logout to not break other tests
        logout_session = requests.Session()
        # Login first
        login_res = logout_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_EMAIL, "password": EXISTING_PASSWORD
        })
        assert login_res.status_code == 200

        # Then logout
        res = logout_session.post(f"{BASE_URL}/api/auth/logout")
        assert res.status_code == 200
        data = res.json()
        assert data.get("ok") is True
        print("Logout success")

        # Verify subsequent auth/me call fails
        me_res = logout_session.get(f"{BASE_URL}/api/auth/me")
        assert me_res.status_code == 401
        print("Post-logout auth check correctly fails with 401")
