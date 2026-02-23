"""
Test suite for ReVent Character CRUD operations and auth flows
Tests: character creation, listing, deletion, max 3 enforcement
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://re-safety-ui.preview.emergentagent.com')


class TestHealthAndAuth:
    """Health check and authentication tests"""
    
    def test_health_endpoint(self):
        """Health endpoint returns ok status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "ReVent API"
        print("✓ Health endpoint working")
    
    def test_register_new_user(self):
        """Can register a new user"""
        unique_email = f"test_char_{uuid.uuid4().hex[:8]}@test.com"
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "TestPass123!",
            "name": "CharTestUser"
        })
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert data["email"] == unique_email.lower()
        assert data["name"] == "CharTestUser"
        assert data["coins"] == 2000  # Beta coins
        print(f"✓ Registered new user: {unique_email}")
        return session, data
    
    def test_login_existing_user(self):
        """Can login with existing credentials"""
        # First register a user
        unique_email = f"test_login_{uuid.uuid4().hex[:8]}@test.com"
        session = requests.Session()
        reg_response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "TestPass123!",
            "name": "LoginTestUser"
        })
        assert reg_response.status_code == 200
        
        # Now login with the same credentials
        login_session = requests.Session()
        response = login_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": "TestPass123!"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == unique_email.lower()
        print(f"✓ Login successful for: {unique_email}")
    
    def test_login_invalid_credentials(self):
        """Login with invalid credentials returns 401"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected")


class TestCharacterCRUD:
    """Character creation, retrieval, and deletion tests"""
    
    @pytest.fixture
    def authenticated_session(self):
        """Create authenticated session with new user"""
        unique_email = f"test_crud_{uuid.uuid4().hex[:8]}@test.com"
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "TestPass123!",
            "name": "CRUDTestUser"
        })
        assert response.status_code == 200
        return session
    
    def test_get_characters_empty_initially(self, authenticated_session):
        """New user has no characters initially"""
        response = authenticated_session.get(f"{BASE_URL}/api/characters")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0
        print("✓ New user has empty character list")
    
    def test_create_character(self, authenticated_session):
        """Can create a character"""
        response = authenticated_session.post(f"{BASE_URL}/api/characters", json={
            "base_role": "Close Cousin",
            "traits": ["Funny", "Wise"],
            "energy": 60,
            "quirks": ["Always says 'Listen...'"],
            "memory_hook": "Childhood friend",
            "label": "My Cousin"
        })
        assert response.status_code == 200
        data = response.json()
        assert "character_id" in data
        assert data["base_role"] == "Close Cousin"
        assert data["traits"] == ["Funny", "Wise"]
        assert data["energy"] == 60
        assert data["label"] == "My Cousin"
        print(f"✓ Character created: {data['character_id']}")
        return data
    
    def test_character_appears_in_list(self, authenticated_session):
        """Created character appears in list"""
        # Create a character
        create_response = authenticated_session.post(f"{BASE_URL}/api/characters", json={
            "base_role": "Office Bro",
            "traits": ["Sarcastic"],
            "energy": 50,
            "label": "Work Buddy"
        })
        assert create_response.status_code == 200
        char_id = create_response.json()["character_id"]
        
        # Verify it appears in list
        list_response = authenticated_session.get(f"{BASE_URL}/api/characters")
        assert list_response.status_code == 200
        characters = list_response.json()
        assert len(characters) == 1
        assert characters[0]["character_id"] == char_id
        assert characters[0]["label"] == "Work Buddy"
        print("✓ Character appears in list after creation")
    
    def test_delete_character(self, authenticated_session):
        """Can delete a character"""
        # Create a character
        create_response = authenticated_session.post(f"{BASE_URL}/api/characters", json={
            "base_role": "Blunt Senior",
            "traits": ["Brutally Honest"],
            "energy": 70,
            "label": "The Boss"
        })
        assert create_response.status_code == 200
        char_id = create_response.json()["character_id"]
        
        # Delete the character
        delete_response = authenticated_session.delete(f"{BASE_URL}/api/characters/{char_id}")
        assert delete_response.status_code == 200
        assert delete_response.json()["ok"] == True
        
        # Verify it's gone
        list_response = authenticated_session.get(f"{BASE_URL}/api/characters")
        assert list_response.status_code == 200
        characters = list_response.json()
        assert len(characters) == 0
        print(f"✓ Character deleted: {char_id}")
    
    def test_delete_nonexistent_character(self, authenticated_session):
        """Deleting nonexistent character returns 404"""
        response = authenticated_session.delete(f"{BASE_URL}/api/characters/char_nonexistent123")
        assert response.status_code == 404
        print("✓ Delete nonexistent character returns 404")


class TestMaxCharacterLimit:
    """Test max 3 character enforcement"""
    
    @pytest.fixture
    def authenticated_session(self):
        """Create authenticated session with new user"""
        unique_email = f"test_max_{uuid.uuid4().hex[:8]}@test.com"
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "TestPass123!",
            "name": "MaxLimitUser"
        })
        assert response.status_code == 200
        return session
    
    def test_can_create_three_characters(self, authenticated_session):
        """Can create exactly 3 characters"""
        roles = ["Close Cousin", "Office Bro", "Blunt Senior"]
        created_ids = []
        
        for i, role in enumerate(roles):
            response = authenticated_session.post(f"{BASE_URL}/api/characters", json={
                "base_role": role,
                "traits": ["Funny"],
                "energy": 50 + i*10,
                "label": f"Char {i+1}"
            })
            assert response.status_code == 200, f"Failed to create character {i+1}"
            created_ids.append(response.json()["character_id"])
        
        # Verify all 3 exist
        list_response = authenticated_session.get(f"{BASE_URL}/api/characters")
        assert list_response.status_code == 200
        characters = list_response.json()
        assert len(characters) == 3
        print("✓ Created 3 characters successfully")
        return created_ids
    
    def test_fourth_character_rejected(self, authenticated_session):
        """Fourth character creation fails with 400"""
        # Create 3 characters first
        for i in range(3):
            response = authenticated_session.post(f"{BASE_URL}/api/characters", json={
                "base_role": "Close Cousin",
                "traits": [],
                "energy": 50,
                "label": f"Char {i+1}"
            })
            assert response.status_code == 200
        
        # Try to create 4th - should fail
        response = authenticated_session.post(f"{BASE_URL}/api/characters", json={
            "base_role": "Office Bro",
            "traits": [],
            "energy": 50,
            "label": "Char 4"
        })
        assert response.status_code == 400
        assert "Maximum 3 characters allowed" in response.json()["detail"]
        print("✓ Fourth character correctly rejected with 400")
    
    def test_can_create_after_delete(self, authenticated_session):
        """Can create new character after deleting one"""
        # Create 3 characters
        created_ids = []
        for i in range(3):
            response = authenticated_session.post(f"{BASE_URL}/api/characters", json={
                "base_role": "Close Cousin",
                "traits": [],
                "energy": 50,
                "label": f"Char {i+1}"
            })
            assert response.status_code == 200
            created_ids.append(response.json()["character_id"])
        
        # Delete one
        delete_response = authenticated_session.delete(f"{BASE_URL}/api/characters/{created_ids[0]}")
        assert delete_response.status_code == 200
        
        # Now can create another
        response = authenticated_session.post(f"{BASE_URL}/api/characters", json={
            "base_role": "Protective Sister",
            "traits": ["Protective"],
            "energy": 80,
            "label": "New Char"
        })
        assert response.status_code == 200
        print("✓ Can create character after deletion (slot freed)")


class TestAuthRequired:
    """Test authentication is required for character APIs"""
    
    def test_get_characters_requires_auth(self):
        """GET /api/characters requires authentication"""
        response = requests.get(f"{BASE_URL}/api/characters")
        assert response.status_code == 401
        print("✓ GET characters requires auth")
    
    def test_create_character_requires_auth(self):
        """POST /api/characters requires authentication"""
        response = requests.post(f"{BASE_URL}/api/characters", json={
            "base_role": "Close Cousin",
            "traits": [],
            "energy": 50,
            "label": "Test"
        })
        assert response.status_code == 401
        print("✓ POST characters requires auth")
    
    def test_delete_character_requires_auth(self):
        """DELETE /api/characters/{id} requires authentication"""
        response = requests.delete(f"{BASE_URL}/api/characters/char_test123")
        assert response.status_code == 401
        print("✓ DELETE characters requires auth")


class TestLogout:
    """Test logout functionality"""
    
    def test_logout_clears_session(self):
        """Logout clears session and prevents access"""
        # Register and get session
        unique_email = f"test_logout_{uuid.uuid4().hex[:8]}@test.com"
        session = requests.Session()
        reg_response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "TestPass123!",
            "name": "LogoutUser"
        })
        assert reg_response.status_code == 200
        
        # Verify authenticated
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        
        # Logout
        logout_response = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_response.status_code == 200
        assert logout_response.json()["ok"] == True
        
        # Verify no longer authenticated
        me_response_after = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response_after.status_code == 401
        print("✓ Logout clears session successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
