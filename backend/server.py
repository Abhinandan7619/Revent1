import os
import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

from database import (
    create_indexes, create_user, get_user_by_email, get_user_by_id,
    get_user_by_google_id, verify_password, update_user,
    create_session, get_session, delete_session,
    save_message, get_history,
    increment_exchange, reset_exchange_counter,
    get_coins, deduct_coins, _clean_user,
    create_character, get_characters, delete_character, update_character,
    get_user_sessions, create_chat_session, update_session_title,
    delete_chat_session, delete_sessions_for_character,
)
from graph import app_graph
from onboarding_chat import handle_onboarding_chat, get_onboarding_welcome_messages

load_dotenv()

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
APP_URL = os.environ.get("APP_URL", "")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_indexes()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[APP_URL, "http://localhost:3000", "http://127.0.0.1:3000", "http://0.0.0.0:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Auth helper ---
async def get_current_user(request: Request) -> Optional[dict]:
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        return None
    session = await get_session(token)
    if not session:
        return None
    user = await get_user_by_id(session["user_id"])
    return _clean_user(user) if user else None


def set_session_cookie(response: Response, token: str):
    response.set_cookie(
        "session_token", token,
        httponly=True, secure=True, samesite="none",
        path="/", max_age=7 * 24 * 3600,
    )


# --- Models ---
class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str = "User"


class LoginRequest(BaseModel):
    email: str
    password: str


class ChatRequest(BaseModel):
    message: str
    session_id: str
    language: str = "Hindi"
    manual_mode: str = "AUTO"
    persona_config: Dict[str, Any] = {}
    force_vault: bool = False


class RefineRequest(BaseModel):
    draft_text: str
    language: str


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    language: Optional[str] = None
    onboarding_complete: Optional[bool] = None


class CreateCharacterRequest(BaseModel):
    base_role: str = "Close Cousin"
    traits: list = []
    energy: int = 50
    quirks: list = []
    memory_hook: str = ""
    label: str = "Custom"


# ===================== AUTH ROUTES =====================

@app.post("/api/auth/register")
async def register(req: RegisterRequest, response: Response):
    if await get_user_by_email(req.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = await create_user(req.email, req.password, req.name)
    token = await create_session(user["user_id"])
    set_session_cookie(response, token)
    return user


@app.post("/api/auth/login")
async def login(req: LoginRequest, response: Response):
    user_doc = await get_user_by_email(req.email)
    if not user_doc or not await verify_password(user_doc, req.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user = _clean_user(user_doc)
    token = await create_session(user["user_id"])
    set_session_cookie(response, token)
    return user


@app.get("/api/auth/google-session")
async def google_session(session_id: str, response: Response):
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
            timeout=10,
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google session")
    data = r.json()
    email = data.get("email", "")
    google_id = data.get("id", "")
    name = data.get("name", "User")

    user_doc = await get_user_by_email(email)
    if not user_doc:
        user = await create_user(email, None, name, google_id)
    else:
        updates = {}
        if not user_doc.get("google_id"):
            updates["google_id"] = google_id
        if updates:
            user_doc = await update_user(user_doc["user_id"], updates) or user_doc
        user = _clean_user(user_doc)

    token = await create_session(user["user_id"])
    set_session_cookie(response, token)
    return {"user": user}


@app.get("/api/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@app.post("/api/auth/mark-first-login")
async def mark_first_login(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await update_user(user["user_id"], {"is_first_login": False})
    return {"ok": True}


@app.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await delete_session(token)
    response.delete_cookie("session_token", path="/", samesite="none", secure=True)
    return {"ok": True}


# ===================== USER ROUTES =====================

@app.post("/api/user/update-profile")
async def update_profile(req: UpdateProfileRequest, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    updates = {}
    if req.name is not None:
        updates["name"] = req.name
    if req.language is not None:
        updates["language"] = req.language
    if req.onboarding_complete is not None:
        updates["onboarding_complete"] = req.onboarding_complete
    updated = await update_user(user["user_id"], updates)
    return updated or user


# ===================== CHARACTER ROUTES =====================

@app.post("/api/characters")
async def api_create_character(req: CreateCharacterRequest, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    char = await create_character(user["user_id"], req.dict())
    if char is None:
        raise HTTPException(status_code=400, detail="Maximum 3 characters allowed")
    return char


@app.get("/api/characters")
async def api_get_characters(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await get_characters(user["user_id"])


@app.delete("/api/characters/{character_id}")
async def api_delete_character(character_id: str, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    deleted = await delete_character(user["user_id"], character_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Character not found")
    # Also delete all chat history for this character
    await delete_sessions_for_character(user["user_id"], character_id)
    return {"ok": True}


@app.put("/api/characters/{character_id}")
async def api_update_character(character_id: str, req: CreateCharacterRequest, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    updated = await update_character(user["user_id"], character_id, req.dict())
    if not updated:
        raise HTTPException(status_code=404, detail="Character not found")
    return updated


# ===================== CHAT ROUTE =====================

@app.post("/api/chat")
async def chat(chat_req: ChatRequest, request: Request):
    user = await get_current_user(request)
    user_id = user["user_id"] if user else "anonymous"

    # Check if this is an onboarding chat (RE default persona, not gossip/custom)
    is_default_re = not chat_req.persona_config and chat_req.manual_mode != "GOSSIP"
    onboarding_status = user.get("onboarding_chat_status", "not_started") if user else "completed"
    use_onboarding = is_default_re and user and onboarding_status != "completed"

    if use_onboarding:
        try:
            # Auto-create session for onboarding
            existing = await get_user_sessions(user["user_id"], "default")
            session_exists = any(s["session_id"] == chat_req.session_id for s in existing)
            if not session_exists:
                await create_chat_session(user["user_id"], chat_req.session_id, "default", "Getting to know you")

            response_text, updates = await handle_onboarding_chat(
                user, chat_req.message, chat_req.session_id, chat_req.language
            )
            if response_text and updates:
                await update_user(user_id, updates)
                # Save to chat history
                from database import save_message
                await save_message(chat_req.session_id, user_id, "user", chat_req.message, "AUTO", False)
                await save_message(chat_req.session_id, user_id, "ai", response_text, "AUTO", False)

                return {
                    "response": response_text,
                    "mode": "AUTO",
                    "is_vault": False,
                    "intensity_score": 0,
                    "emotional_baseline": 5,
                    "coins_remaining": user.get("coins", 0),
                    "coins_deducted": 0,
                    "is_onboarding": True,
                }
        except Exception as e:
            print(f"Onboarding chat error: {e}")
            # Fall through to regular chat if onboarding fails

    # Regular chat flow
    try:
        # Auto-create session if it doesn't exist (NOT for gossip mode)
        is_gossip = chat_req.force_vault or chat_req.manual_mode == "GOSSIP"
        if user and not is_gossip:
            vibe_id = "default"
            if chat_req.persona_config:
                chars = await get_characters(user["user_id"])
                for c in chars:
                    if c.get("base_role") == chat_req.persona_config.get("base_role"):
                        vibe_id = c["character_id"]
                        break
            existing = await get_user_sessions(user["user_id"], vibe_id)
            session_exists = any(s["session_id"] == chat_req.session_id for s in existing)
            if not session_exists and len(existing) < 2:
                title = chat_req.message[:40] if chat_req.message else "New Chat"
                await create_chat_session(user["user_id"], chat_req.session_id, vibe_id, title)

        # Include personality profile and user name in persona config for personalized responses
        persona_cfg = dict(chat_req.persona_config) if chat_req.persona_config else {}
        if user and user.get("personality_profile"):
            persona_cfg["_user_personality"] = user["personality_profile"]
        if user and user.get("name"):
            persona_cfg["_user_name"] = user["name"]

        inputs = {
            "session_id": chat_req.session_id,
            "user_id": user_id,
            "input_text": chat_req.message,
            "language": chat_req.language,
            "manual_mode": chat_req.manual_mode,
            "persona_config": persona_cfg,
            "emotional_baseline": 5,
            "force_vault": chat_req.force_vault,
            "history": [],
        }
        result = await app_graph.ainvoke(inputs)
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    coins_remaining = user.get("coins", 0) if user else 0
    coins_deducted = 0
    active_mode = result.get("active_mode", "AUTO")

    if user and active_mode != "CRISIS":
        exchange_count = await increment_exchange(chat_req.session_id, user_id)
        if exchange_count >= 10:
            deduct_amount = 8 if active_mode == "BE_REAL" else 5
            coins_remaining = await deduct_coins(user_id, deduct_amount)
            coins_deducted = deduct_amount
            await reset_exchange_counter(chat_req.session_id)

    return {
        "response": result["final_response"],
        "mode": active_mode,
        "is_vault": result.get("is_vault", False),
        "intensity_score": result.get("intensity_score", 0),
        "emotional_baseline": result.get("emotional_baseline", 5),
        "coins_remaining": coins_remaining,
        "coins_deducted": coins_deducted,
    }


@app.get("/api/chat/welcome")
async def chat_welcome(request: Request):
    """Get personalized welcome messages based on onboarding status."""
    user = await get_current_user(request)
    if not user:
        return {"messages": [{"role": "ai", "content": "Hey! 👋", "mode": "AUTO"}]}
    return {"messages": get_onboarding_welcome_messages(user)}


@app.get("/api/chat/sessions")
async def get_chat_sessions(vibe_id: str = "default", request: Request = None):
    """Get all chat sessions for a user + vibe."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    sessions = await get_user_sessions(user["user_id"], vibe_id)
    return sessions


@app.post("/api/chat/sessions")
async def create_new_chat_session(request: Request):
    """Create a new chat session. Max 2 sessions per vibe."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    session_id = body.get("session_id", f"sess_{__import__('uuid').uuid4().hex[:12]}")
    vibe_id = body.get("vibe_id", "default")
    title = body.get("title", "New Chat")
    existing = await get_user_sessions(user["user_id"], vibe_id)
    if len(existing) >= 2:
        raise HTTPException(status_code=400, detail="Session limit reached. Delete an existing session to create a new one.")
    session = await create_chat_session(user["user_id"], session_id, vibe_id, title)
    return session


@app.delete("/api/chat/sessions/{session_id}")
async def delete_chat_session_endpoint(session_id: str, request: Request):
    """Delete a chat session and all its messages."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await delete_chat_session(session_id, user["user_id"])
    return {"ok": True}


@app.patch("/api/chat/sessions/{session_id}")
async def rename_chat_session(session_id: str, request: Request):
    """Rename a chat session."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    title = body.get("title", "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title required")
    await update_session_title(session_id, title)
    return {"ok": True}


@app.get("/api/chat/history/{session_id}")
async def get_chat_history(session_id: str, request: Request):
    """Get chat history for a session."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    messages = await get_history(session_id, limit=100)
    return messages


# ===================== UTILITY ROUTES =====================

@app.post("/api/refine-backstory")
async def refine_backstory(req: RefineRequest, request: Request):
    try:
        chat = LlmChat(
            api_key=GOOGLE_API_KEY,
            session_id=f"refine_{id(req)}",
            system_message=(
                "Rewrite user stories to be short, funny, and engaging. "
                "Keep the original meaning. Max 2 sentences. "
                "Sound like a cool character description, not a formal bio."
            ),
        ).with_model("gemini", "gemini-2.5-flash")
        response = await chat.send_message(UserMessage(
            text=f"Language: English mixed with {req.language} (Roman Script).\nDraft: \"{req.draft_text}\"\nRewrite:"
        ))
        return {"refined_text": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/coins/balance")
async def coins_balance(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"coins": user.get("coins", 0)}


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "ReVent API"}
