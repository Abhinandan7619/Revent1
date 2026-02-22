import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from passlib.context import CryptContext
from pymongo import ReturnDocument
import motor.motor_asyncio
from dotenv import load_dotenv

load_dotenv()

_client = motor.motor_asyncio.AsyncIOMotorClient(os.environ["MONGO_URL"])
db = _client[os.environ["DB_NAME"]]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("google_id", sparse=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.chat_history.create_index("session_id")
    await db.chat_history.create_index([("session_id", 1), ("timestamp", 1)])
    await db.exchange_counters.create_index("session_id", unique=True)
    await db.characters.create_index("user_id")
    await db.characters.create_index("character_id", unique=True)


def _clean_user(doc: dict) -> dict:
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


async def create_user(email: str, password: Optional[str], name: str = "User", google_id: Optional[str] = None) -> dict:
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id,
        "email": email.lower(),
        "password_hash": pwd_context.hash(password) if password else None,
        "name": name,
        "language": "Hindi",
        "coins": 2000,
        "is_first_login": True,
        "onboarding_complete": False,
        "onboarding_chat_status": "not_started",
        "onboarding_chat_phase": 0,
        "onboarding_chat_question": 0,
        "personality_profile": {},
        "google_id": google_id,
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(doc)
    return _clean_user({k: v for k, v in doc.items()})


async def get_user_by_email(email: str) -> Optional[dict]:
    doc = await db.users.find_one({"email": email.lower()}, {"_id": 0})
    return doc


async def get_user_by_id(user_id: str) -> Optional[dict]:
    doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return doc


async def get_user_by_google_id(google_id: str) -> Optional[dict]:
    doc = await db.users.find_one({"google_id": google_id}, {"_id": 0})
    return doc


async def update_user(user_id: str, updates: dict) -> Optional[dict]:
    await db.users.update_one({"user_id": user_id}, {"$set": updates})
    doc = await get_user_by_id(user_id)
    return _clean_user(doc) if doc else None


async def verify_password(user: dict, password: str) -> bool:
    pw_hash = user.get("password_hash")
    if not pw_hash:
        return False
    try:
        return pwd_context.verify(password, pw_hash)
    except Exception:
        return False


async def create_session(user_id: str) -> str:
    token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })
    return token


async def get_session(token: str) -> Optional[dict]:
    doc = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not doc:
        return None
    exp = doc["expires_at"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        await db.user_sessions.delete_one({"session_token": token})
        return None
    return doc


async def delete_session(token: str):
    await db.user_sessions.delete_one({"session_token": token})


async def save_message(session_id: str, user_id: str, role: str, content: str, mode: str, is_vault: bool):
    if is_vault:
        return
    await db.chat_history.insert_one({
        "session_id": session_id,
        "user_id": user_id,
        "role": role,
        "content": content,
        "mode": mode,
        "timestamp": datetime.now(timezone.utc),
    })


async def get_history(session_id: str, limit: int = 20) -> list:
    cursor = db.chat_history.find(
        {"session_id": session_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return list(reversed(docs))


async def get_user_sessions(user_id: str, vibe_id: str = "default") -> list:
    """Get chat sessions for a user + vibe. Returns most recent first."""
    cursor = db.chat_sessions.find(
        {"user_id": user_id, "vibe_id": vibe_id},
        {"_id": 0}
    ).sort("updated_at", -1).limit(20)
    return await cursor.to_list(length=20)


async def create_chat_session(user_id: str, session_id: str, vibe_id: str = "default", title: str = "New Chat") -> dict:
    doc = {
        "session_id": session_id,
        "user_id": user_id,
        "vibe_id": vibe_id,
        "title": title,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.chat_sessions.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def update_session_title(session_id: str, title: str):
    await db.chat_sessions.update_one(
        {"session_id": session_id},
        {"$set": {"title": title, "updated_at": datetime.now(timezone.utc)}}
    )


async def delete_sessions_for_character(user_id: str, vibe_id: str):
    """Delete all chat sessions and messages for a character."""
    sessions = await db.chat_sessions.find({"user_id": user_id, "vibe_id": vibe_id}, {"session_id": 1, "_id": 0}).to_list(length=100)
    session_ids = [s["session_id"] for s in sessions]
    if session_ids:
        await db.chat_history.delete_many({"session_id": {"$in": session_ids}})
        await db.exchange_counters.delete_many({"session_id": {"$in": session_ids}})
    await db.chat_sessions.delete_many({"user_id": user_id, "vibe_id": vibe_id})




async def increment_exchange(session_id: str, user_id: str) -> int:
    result = await db.exchange_counters.find_one_and_update(
        {"session_id": session_id},
        {
            "$inc": {"count": 1},
            "$setOnInsert": {
                "user_id": user_id,
                "created_at": datetime.now(timezone.utc),
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )
    return result.get("count", 1) if result else 1


async def reset_exchange_counter(session_id: str):
    await db.exchange_counters.update_one(
        {"session_id": session_id},
        {"$set": {"count": 0}},
    )


async def get_coins(user_id: str) -> int:
    doc = await get_user_by_id(user_id)
    return doc.get("coins", 0) if doc else 0


async def deduct_coins(user_id: str, amount: int) -> int:
    doc = await get_user_by_id(user_id)
    if not doc:
        return 0
    new_coins = max(0, doc.get("coins", 0) - amount)
    await db.users.update_one({"user_id": user_id}, {"$set": {"coins": new_coins}})


# ─── Character CRUD ─────────────────────────────────────────────────────────

MAX_CHARACTERS = 3


async def create_character(user_id: str, config: dict) -> dict:
    count = await db.characters.count_documents({"user_id": user_id})
    if count >= MAX_CHARACTERS:
        return None
    character_id = f"char_{uuid.uuid4().hex[:12]}"
    doc = {
        "character_id": character_id,
        "user_id": user_id,
        "base_role": config.get("base_role", "Close Cousin"),
        "traits": config.get("traits", []),
        "energy": config.get("energy", 50),
        "quirks": config.get("quirks", []),
        "memory_hook": config.get("memory_hook", ""),
        "label": config.get("label", "Custom"),
        "created_at": datetime.now(timezone.utc),
    }
    await db.characters.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def get_characters(user_id: str) -> list:
    cursor = db.characters.find({"user_id": user_id}, {"_id": 0}).sort("created_at", 1)
    return await cursor.to_list(length=MAX_CHARACTERS)


async def delete_character(user_id: str, character_id: str) -> bool:
    result = await db.characters.delete_one({"user_id": user_id, "character_id": character_id})
    return result.deleted_count > 0

    return new_coins
