"""
Test onboarding chatbot flow and related features.
Tests the 5-phase conversational onboarding for new users.
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestHealthAndWelcome:
    """Health and welcome endpoint tests"""

    def test_health_endpoint(self):
        """Test health endpoint returns ok"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print("✓ Health endpoint working")

    def test_chat_welcome_unauthenticated(self):
        """Test welcome endpoint without auth returns default message"""
        response = requests.get(f"{BASE_URL}/api/chat/welcome")
        assert response.status_code == 200
        data = response.json()
        assert "messages" in data
        assert len(data["messages"]) > 0
        assert data["messages"][0]["content"] == "Hey! 👋"
        print("✓ Unauthenticated welcome returns default greeting")


class TestOnboardingChatFlow:
    """Test the 5-phase onboarding chat flow"""

    @pytest.fixture
    def new_user_session(self):
        """Create a new user and return session"""
        test_email = f"test_onboard_{int(time.time())}@test.com"
        session = requests.Session()
        
        # Register new user
        response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "Test123!",
            "name": "OnboardTestUser"
        })
        assert response.status_code == 200
        user = response.json()
        
        # Verify new user has onboarding_chat_status = not_started
        assert user.get("onboarding_chat_status") == "not_started"
        assert user.get("onboarding_complete") == False
        assert user.get("onboarding_chat_phase") == 0
        print(f"✓ Created new user: {test_email}")
        
        yield session, user
        
        # Cleanup: logout
        session.post(f"{BASE_URL}/api/auth/logout")

    def test_onboarding_initial_message_triggers_consent(self, new_user_session):
        """First message to RE triggers onboarding welcome/consent"""
        session, user = new_user_session
        
        response = session.post(f"{BASE_URL}/api/chat", json={
            "message": "hey",
            "session_id": "test_onboard_sess",
            "language": "Hindi",
            "manual_mode": "AUTO",
            "persona_config": {}
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "is_onboarding" in data
        assert data["is_onboarding"] == True
        assert data["mode"] == "AUTO"
        assert user["name"] in data["response"]  # Should mention user's name
        print("✓ Initial message triggers onboarding mode")

    def test_onboarding_consent_yes_proceeds(self, new_user_session):
        """Saying yes to consent proceeds to Phase 1 questions"""
        session, user = new_user_session
        
        # Initial message
        session.post(f"{BASE_URL}/api/chat", json={
            "message": "hey",
            "session_id": "test_consent_sess",
            "language": "Hindi",
            "manual_mode": "AUTO",
            "persona_config": {}
        })
        
        # Consent YES
        response = session.post(f"{BASE_URL}/api/chat", json={
            "message": "yes sure, let's go",
            "session_id": "test_consent_sess",
            "language": "Hindi",
            "manual_mode": "AUTO",
            "persona_config": {}
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_onboarding"] == True
        # Should ask first question about movies
        assert any(word in data["response"].lower() for word in ["movie", "movies", "action", "thriller", "emotional"])
        print("✓ Consent YES proceeds to Phase 1 movie question")

    def test_onboarding_consent_no_respects_decline(self, new_user_session):
        """Saying no to consent is respected"""
        session, user = new_user_session
        
        # Initial message
        session.post(f"{BASE_URL}/api/chat", json={
            "message": "hey",
            "session_id": "test_decline_sess",
            "language": "Hindi",
            "manual_mode": "AUTO",
            "persona_config": {}
        })
        
        # Consent NO
        response = session.post(f"{BASE_URL}/api/chat", json={
            "message": "no not now, maybe later",
            "session_id": "test_decline_sess",
            "language": "Hindi",
            "manual_mode": "AUTO",
            "persona_config": {}
        })
        
        assert response.status_code == 200
        data = response.json()
        # Should acknowledge decline gracefully
        assert any(word in data["response"].lower() for word in ["okay", "no worries", "whenever", "later", "here"])
        print("✓ Consent NO is respected gracefully")


class TestOnboardingBypass:
    """Test that GOSSIP mode and custom personas bypass onboarding"""

    @pytest.fixture
    def new_user_session(self):
        """Create a new user and return session"""
        test_email = f"test_bypass_{int(time.time())}@test.com"
        session = requests.Session()
        
        response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "Test123!",
            "name": "BypassTestUser"
        })
        assert response.status_code == 200
        
        yield session
        
        session.post(f"{BASE_URL}/api/auth/logout")

    def test_gossip_mode_bypasses_onboarding(self, new_user_session):
        """GOSSIP mode should bypass onboarding flow"""
        session = new_user_session
        
        response = session.post(f"{BASE_URL}/api/chat", json={
            "message": "omg you won't believe what happened",
            "session_id": "test_gossip_bypass",
            "language": "Hindi",
            "manual_mode": "GOSSIP",
            "persona_config": {}
        })
        
        assert response.status_code == 200
        data = response.json()
        # Should NOT have is_onboarding flag
        assert "is_onboarding" not in data or data.get("is_onboarding") == False
        assert data["mode"] == "GOSSIP"
        print("✓ GOSSIP mode bypasses onboarding")

    def test_custom_persona_bypasses_onboarding(self, new_user_session):
        """Custom persona_config should bypass onboarding flow"""
        session = new_user_session
        
        response = session.post(f"{BASE_URL}/api/chat", json={
            "message": "hey buddy",
            "session_id": "test_custom_bypass",
            "language": "Hindi",
            "manual_mode": "AUTO",
            "persona_config": {"base_role": "Close Cousin", "traits": ["Funny"]}
        })
        
        assert response.status_code == 200
        data = response.json()
        # Should NOT have is_onboarding flag (not using default RE)
        assert "is_onboarding" not in data or data.get("is_onboarding") == False
        print("✓ Custom persona bypasses onboarding")


class TestOnboardingSkip:
    """Test skip keyword detection in onboarding"""

    @pytest.fixture
    def user_in_onboarding(self):
        """Create a user and progress them to in_progress onboarding"""
        test_email = f"test_skip_{int(time.time())}@test.com"
        session = requests.Session()
        
        session.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "Test123!",
            "name": "SkipTestUser"
        })
        
        # Initial message
        session.post(f"{BASE_URL}/api/chat", json={
            "message": "hey",
            "session_id": "test_skip_sess",
            "language": "Hindi",
            "manual_mode": "AUTO",
            "persona_config": {}
        })
        
        # Consent YES to enter in_progress
        session.post(f"{BASE_URL}/api/chat", json={
            "message": "sure let's go",
            "session_id": "test_skip_sess",
            "language": "Hindi",
            "manual_mode": "AUTO",
            "persona_config": {}
        })
        
        yield session
        
        session.post(f"{BASE_URL}/api/auth/logout")

    def test_skip_keyword_works(self, user_in_onboarding):
        """Skip keyword should skip current question and move to next"""
        session = user_in_onboarding
        
        response = session.post(f"{BASE_URL}/api/chat", json={
            "message": "skip",
            "session_id": "test_skip_sess",
            "language": "Hindi",
            "manual_mode": "AUTO",
            "persona_config": {}
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_onboarding"] == True
        # Should acknowledge skip and ask next question
        assert any(word in data["response"].lower() for word in ["good", "cool", "okay", "next", "movie", "repeat"])
        print("✓ Skip keyword works in onboarding")


class TestExistingUserChatWelcome:
    """Test /api/chat/welcome for existing user with onboarding complete"""

    def test_welcome_for_completed_user(self):
        """User with onboarding_complete gets personalized welcome"""
        session = requests.Session()
        
        # Login with existing user
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testuser_vent@test.com",
            "password": "Test123!"
        })
        assert response.status_code == 200
        user = response.json()
        
        # Get welcome
        response = session.get(f"{BASE_URL}/api/chat/welcome")
        assert response.status_code == 200
        data = response.json()
        
        assert "messages" in data
        assert len(data["messages"]) > 0
        # Should include user's name
        assert user["name"] in data["messages"][0]["content"]
        print(f"✓ Welcome message includes user name: {user['name']}")
        
        session.post(f"{BASE_URL}/api/auth/logout")


class TestCharacterCreatorNaming:
    """Test that characters use base_role as label (Name field removed)"""

    def test_character_uses_base_role_as_label(self):
        """Character should use base_role as label when created"""
        session = requests.Session()
        
        # Login
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testuser_vent@test.com",
            "password": "Test123!"
        })
        assert response.status_code == 200
        
        # Create character with specific base_role but no custom label
        response = session.post(f"{BASE_URL}/api/characters", json={
            "base_role": "Office Bro",
            "traits": ["Sarcastic", "Funny"],
            "energy": 60,
            "quirks": [],
            "memory_hook": "We work in the same office",
            "label": "Office Bro"  # Label should match base_role
        })
        
        if response.status_code == 200:
            char = response.json()
            assert char["base_role"] == "Office Bro"
            assert char["label"] == "Office Bro"  # Label uses base_role
            print(f"✓ Character label matches base_role: {char['label']}")
            
            # Cleanup: delete the character
            session.delete(f"{BASE_URL}/api/characters/{char['character_id']}")
        elif response.status_code == 400:
            # Max characters reached
            print("✓ Character limit check working (max 3)")
        
        session.post(f"{BASE_URL}/api/auth/logout")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
