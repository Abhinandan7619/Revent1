import os
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from graph import app_graph
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from dotenv import load_dotenv
import redis
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

load_dotenv()

# --- Redis client for distributed session state ---
# Replaces the in-memory dict so state persists across multiple server instances
redis_client = redis.from_url(
    os.getenv("REDIS_URL", "redis://localhost:6379"),
    decode_responses=True
)

# --- Rate limiter (slowapi) ---
limiter = Limiter(key_func=get_remote_address)

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper LLM for the "Write with AI" feature
helper_llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.7)

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

@app.post("/chat")
@limiter.limit("30/minute")
async def chat(request: Request, chat_request: ChatRequest):
    try:
        baseline_key = f"baseline:{chat_request.session_id}"
        raw = redis_client.get(baseline_key)
        current_baseline = int(raw) if raw else 5

        inputs = {
            "session_id": chat_request.session_id,
            "input_text": chat_request.message,
            "language": chat_request.language,
            "manual_mode": chat_request.manual_mode,
            "persona_config": chat_request.persona_config,
            "emotional_baseline": current_baseline,
            "force_vault": chat_request.force_vault,
            "history": []
        }
        result = app_graph.invoke(inputs)
        new_baseline = result.get("emotional_baseline", 5)

        # Store baseline in Redis with 24-hour TTL (auto-expires stale sessions)
        redis_client.setex(baseline_key, 86400, new_baseline)

        return {
            "response": result["final_response"],
            "mode": result["active_mode"],
            "is_vault": result["is_vault"],
            "intensity_score": result.get("intensity_score", 0),
            "emotional_baseline": new_baseline
        }
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- NEW ENDPOINT FOR FIX 6 ---
@app.post("/refine-backstory")
@limiter.limit("10/minute")
async def refine_backstory(request: Request, backstory_request: RefineRequest):
    try:
        prompt = f"""
        Rewrite the following user story to be short, funny, and engaging.
        Keep the original meaning but make it sound like a cool character description.
        Language: English mixed with {backstory_request.language} (Roman Script).
        Max 2 sentences.

        User Draft: "{backstory_request.draft_text}"
        """
        response = helper_llm.invoke([HumanMessage(content=prompt)])
        return {"refined_text": response.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
