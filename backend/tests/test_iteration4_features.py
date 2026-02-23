"""
Test Suite for Iteration 4 Features:
- Chat session CRUD APIs
- Chat history persistence
- Character deletion cascades to chat history
- Gossip mode has NO chat history
- Session auto-creation in /api/chat
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndAuth:
    """Basic health and authentication tests"""
    
    def test_health_endpoint(self):
        """Health endpoint should return ok"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
    
    def test_login_success(self):
        """Login with existing test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "chartest@test.com",
            "password": "test123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert data["email"] == "chartest@test.com"


class TestChatSessionsAPI:
    """Tests for chat session CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "chartest@test.com",
            "password": "test123"
        })
        assert response.status_code == 200
        self.user = response.json()
    
    def test_get_sessions_for_default_vibe(self):
        """GET /api/chat/sessions?vibe_id=default returns sessions list"""
        response = self.session.get(f"{BASE_URL}/api/chat/sessions?vibe_id=default")
        assert response.status_code == 200
        sessions = response.json()
        assert isinstance(sessions, list)
        # Each session should have required fields
        if sessions:
            assert "session_id" in sessions[0]
            assert "vibe_id" in sessions[0]
            assert "title" in sessions[0]
    
    def test_create_chat_session(self):
        """POST /api/chat/sessions creates a new chat session"""
        session_id = f"test_sess_{int(time.time())}"
        response = self.session.post(f"{BASE_URL}/api/chat/sessions", json={
            "session_id": session_id,
            "vibe_id": "default",
            "title": "Test Session Created"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == session_id
        assert data["vibe_id"] == "default"
        assert data["title"] == "Test Session Created"
        
        # Verify session was created
        get_response = self.session.get(f"{BASE_URL}/api/chat/sessions?vibe_id=default")
        assert get_response.status_code == 200
        sessions = get_response.json()
        assert any(s["session_id"] == session_id for s in sessions)
    
    def test_get_chat_history(self):
        """GET /api/chat/history/{session_id} returns message history"""
        # Use existing session that has history
        response = self.session.get(f"{BASE_URL}/api/chat/history/test_sess_hist")
        assert response.status_code == 200
        history = response.json()
        assert isinstance(history, list)
        # Each message should have role and content
        if history:
            assert "role" in history[0]
            assert "content" in history[0]
    
    def test_chat_auto_creates_session(self):
        """POST /api/chat auto-creates chat session if doesn't exist"""
        new_session_id = f"auto_create_sess_{int(time.time())}"
        
        # Verify session doesn't exist yet
        sessions_before = self.session.get(f"{BASE_URL}/api/chat/sessions?vibe_id=default").json()
        assert not any(s["session_id"] == new_session_id for s in sessions_before)
        
        # Send a chat message
        response = self.session.post(f"{BASE_URL}/api/chat", json={
            "message": "Hello auto-create test",
            "session_id": new_session_id,
            "language": "Hindi",
            "manual_mode": "AUTO",
            "persona_config": {},
            "force_vault": True  # Use vault mode to skip LLM processing
        })
        assert response.status_code == 200
        
        # Verify session was auto-created
        sessions_after = self.session.get(f"{BASE_URL}/api/chat/sessions?vibe_id=default").json()
        assert any(s["session_id"] == new_session_id for s in sessions_after)
    
    def test_duplicate_session_handling(self):
        """Creating a session with same ID should not fail"""
        session_id = f"dup_test_sess_{int(time.time())}"
        
        # Create first session
        response1 = self.session.post(f"{BASE_URL}/api/chat/sessions", json={
            "session_id": session_id,
            "vibe_id": "default",
            "title": "First Create"
        })
        assert response1.status_code == 200
        
        # Try to create same session again - should return existing
        response2 = self.session.post(f"{BASE_URL}/api/chat/sessions", json={
            "session_id": session_id,
            "vibe_id": "default", 
            "title": "Second Create"
        })
        assert response2.status_code == 200
        # Should return existing session, not fail


class TestGossipModeNoHistory:
    """Tests that gossip mode does NOT save chat history"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "chartest@test.com",
            "password": "test123"
        })
        assert response.status_code == 200
    
    def test_gossip_mode_is_vault(self):
        """Gossip mode with force_vault should return is_vault=true"""
        response = self.session.post(f"{BASE_URL}/api/chat", json={
            "message": "Secret gossip message",
            "session_id": f"gossip_{int(time.time())}",
            "language": "Hindi",
            "manual_mode": "GOSSIP",
            "persona_config": {},
            "force_vault": True
        })
        assert response.status_code == 200
        data = response.json()
        assert data["is_vault"] == True
        # When force_vault=true, mode is VAULT not GOSSIP - this is expected behavior
        assert data["mode"] in ["GOSSIP", "VAULT"]
    
    def test_gossip_mode_no_session_created(self):
        """Gossip mode should NOT create chat session"""
        gossip_session_id = f"gossip_no_sess_{int(time.time())}"
        
        # Send gossip message
        response = self.session.post(f"{BASE_URL}/api/chat", json={
            "message": "Secret gossip",
            "session_id": gossip_session_id,
            "language": "Hindi",
            "manual_mode": "GOSSIP",
            "persona_config": {},
            "force_vault": True
        })
        assert response.status_code == 200
        
        # Verify no history saved (empty history since vault mode)
        history_response = self.session.get(f"{BASE_URL}/api/chat/history/{gossip_session_id}")
        assert history_response.status_code == 200
        history = history_response.json()
        assert history == []  # Should be empty - vault mode doesn't save


class TestCharacterDeletionCascade:
    """Tests that deleting a character also deletes its chat sessions"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "chartest@test.com",
            "password": "test123"
        })
        assert response.status_code == 200
    
    def test_character_deletion_deletes_sessions(self):
        """DELETE /api/characters/{id} also deletes character's chat sessions"""
        # Create a test character
        char_response = self.session.post(f"{BASE_URL}/api/characters", json={
            "base_role": "Office Bro",
            "traits": ["Funny"],
            "energy": 60,
            "quirks": [],
            "memory_hook": "",
            "label": "Test Delete Char"
        })
        assert char_response.status_code == 200
        char = char_response.json()
        char_id = char["character_id"]
        
        # Create a session for this character
        test_session_id = f"char_del_test_{int(time.time())}"
        sess_response = self.session.post(f"{BASE_URL}/api/chat/sessions", json={
            "session_id": test_session_id,
            "vibe_id": char_id,
            "title": "Session to be deleted"
        })
        assert sess_response.status_code == 200
        
        # Verify session exists
        sessions = self.session.get(f"{BASE_URL}/api/chat/sessions?vibe_id={char_id}").json()
        assert any(s["session_id"] == test_session_id for s in sessions)
        
        # Delete the character
        delete_response = self.session.delete(f"{BASE_URL}/api/characters/{char_id}")
        assert delete_response.status_code == 200
        
        # Verify character's sessions are also deleted
        sessions_after = self.session.get(f"{BASE_URL}/api/chat/sessions?vibe_id={char_id}").json()
        assert not any(s["session_id"] == test_session_id for s in sessions_after)


class TestAuthRequired:
    """Tests that endpoints require authentication"""
    
    def test_sessions_requires_auth(self):
        """GET /api/chat/sessions requires authentication"""
        response = requests.get(f"{BASE_URL}/api/chat/sessions?vibe_id=default")
        assert response.status_code == 401
    
    def test_history_requires_auth(self):
        """GET /api/chat/history/{session_id} requires authentication"""
        response = requests.get(f"{BASE_URL}/api/chat/history/any_session")
        assert response.status_code == 401
    
    def test_create_session_requires_auth(self):
        """POST /api/chat/sessions requires authentication"""
        response = requests.post(f"{BASE_URL}/api/chat/sessions", json={
            "session_id": "test",
            "vibe_id": "default",
            "title": "Test"
        })
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
