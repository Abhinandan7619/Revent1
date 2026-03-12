import os
import json
import random
import asyncio
from collections import defaultdict
from datetime import datetime
from typing import TypedDict, List, Optional, Dict, Any
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, END
from database import save_message, get_history

# --- In-memory gossip store (RAM only, never hits DB) ---
# keyed by session_id → list of {role, content} dicts
_gossip_memory: Dict[str, List[Dict]] = defaultdict(list)

load_dotenv()

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")


# --- State ---
class ReVentState(TypedDict):
    session_id: str
    user_id: str
    input_text: str
    language: str
    manual_mode: Optional[str]
    active_mode: str
    intended_mode: str
    confidence_score: float
    intensity_score: int
    emotional_baseline: int
    persona_config: Dict[str, Any]
    needs_clarification: bool
    is_vault: bool
    force_vault: bool
    final_response: str
    history: List[str]


# --- Models (Gemini 2.5 Flash) ---
classifier_llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0.2,
    google_api_key=GOOGLE_API_KEY,
)
generator_llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0.7,
    google_api_key=GOOGLE_API_KEY,
)


# --- Casual message detection ---
CASUAL_PATTERNS = [
    "kya chal raha", "kaisa hai", "what's up", "sup", "wassup", "whatsup",
    "hey", "hello", "hi", "yo", "kya haal", "kya scene", "howdy",
    "good morning", "good night", "good evening", "subah", "raat",
    "bored", "bore ho gaya", "bore ho gayi", "nothing to do", "timepass",
    "kya kar raha", "kya kar rahi", "aur bata", "aur suna", "kuch nahi",
    "theek hai", "sab theek", "chill", "mast", "badhiya", "fine", "ok",
    "hmm", "haan", "accha", "lol", "haha", "hehe", "😂", "😄",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "weekend", "holiday", "vacation",
]

# Keywords for detecting user confidence levels
LOW_CONFIDENCE_WORDS = [
    "can't", "cant", "fail", "failed", "worthless", "hopeless", "useless",
    "nobody cares", "no one cares", "give up", "giving up", "haar gaya",
    "haar gayi", "kuch nahi hoga", "koi fayda nahi", "thak gaya", "thak gayi",
    "akela", "akeli", "lonely", "alone", "lost", "kho gaya", "nahi ho raha",
    "i suck", "i'm terrible", "i'm bad at", "not good enough", "never enough",
    "loser", "pathetic", "weak", "kamzor", "bekar",
]

HIGH_CONFIDENCE_WORDS = [
    "i'm the best", "nobody like me", "i'm right", "main sahi hoon",
    "deserve better", "i deserve", "i'm amazing", "i'm great", "top",
    "killed it", "nailed it", "best decision", "proud of myself",
    "maza aa gaya", "boss", "legend",
]

# Vague person references that need context questions
VAGUE_PERSON_REFS = [
    "woh", "usne", "unhone", "uska", "uski", "unka", "unki",
    "they", "someone", "koi", "log", "sab log", "everybody",
    "that person", "this person", "wo banda", "wo ladki", "wo ladka",
]

# Vague situation words
VAGUE_SITUATION_WORDS = [
    "chali gayi", "chala gaya", "betray", "galti", "problem", "pressure",
    "situation", "fight", "jhagda", "issue", "scene", "drama",
    "dhoka", "cheated", "lied", "manipulated",
]


def _is_casual(text: str) -> bool:
    lower = text.lower().strip()
    if len(lower) < 30 and any(p in lower for p in CASUAL_PATTERNS):
        return True
    if len(lower) < 15:
        return True
    return False


def _detect_confidence(text: str) -> str:
    lower = text.lower()
    if any(w in lower for w in LOW_CONFIDENCE_WORDS):
        return "LOW"
    if any(w in lower for w in HIGH_CONFIDENCE_WORDS):
        return "HIGH"
    return "NORMAL"


def _has_vague_references(text: str) -> bool:
    lower = text.lower()
    has_person = any(w in lower for w in VAGUE_PERSON_REFS)
    has_situation = any(w in lower for w in VAGUE_SITUATION_WORDS)
    return has_person or has_situation


def _get_time_context() -> str:
    hour = datetime.now().hour
    if 6 <= hour < 12:
        return "morning"
    elif 12 <= hour < 14:
        return "afternoon"
    elif 14 <= hour < 18:
        return "evening_work"
    elif 18 <= hour < 22:
        return "evening_chill"
    else:
        return "late_night"


def _get_reva_time_flavor(time_ctx: str) -> str:
    flavors = {
        "morning": random.choice([
            "Yaar meeting se nikli abhi.",
            "Abhi office pahunchi.",
            "Chai pe hoon, tu bata.",
        ]),
        "afternoon": random.choice([
            "Lunch break pe hoon.",
            "Khaana khake baithi hoon.",
            "Meeting se free hui abhi.",
        ]),
        "evening_work": random.choice([
            "Kaam chal raha hai abhi bhi.",
            "Ek aur meeting thi, ab free.",
            "Office ka din khatam ho raha hai finally.",
        ]),
        "evening_chill": random.choice([
            "Kaam se free hui abhi.",
            "Ghar aa gayi, chill kar rahi hoon.",
            "Finally aaraam.",
        ]),
        "late_night": random.choice([
            "Main bhi jaag rahi hoon yaar.",
            "Neend nahi aa rahi mujhe bhi.",
            "Late night scrolling.",
        ]),
    }
    return flavors.get(time_ctx, "")


def _get_city_dialect_hints(city: str) -> str:
    if not city:
        return ""
    city_lower = city.lower().strip()
    dialects = {
        "mumbai": (
            "Occasionally use Mumbai slang: 'bey', 'bol', 'scene kya hai'. "
            "Use 'na' and 'yaar' as sentence enders. Every 3-4 responses only. "
            "Example: 'Bol yaar, kya scene hai?' NEVER use heavy slang like 'Ae bantai'."
        ),
        "delhi": (
            "Occasionally use Delhi slang: 'bhai', 'yaar', 'sahi'. "
            "Use 'yaar' and 'bhai' as sentence enders. Every 3-4 responses only. "
            "Example: 'Yaar kya hua bhai?'"
        ),
        "hyderabad": (
            "Occasionally use: 'thoda', 'ekdum', 'kyun'. "
            "Use 'na' and 'yaar' as enders. Every 4-5 responses only. "
            "Example: 'Thoda bata na yaar'"
        ),
        "bangalore": (
            "Occasionally use: 'super', 'full', 'kaafi'. "
            "Use 'yaar' and 'na' as enders. Every 4-5 responses only. "
            "Example: 'Full problem hai kya yaar?'"
        ),
        "bengaluru": (
            "Occasionally use: 'super', 'full', 'kaafi'. "
            "Use 'yaar' and 'na' as enders. Every 4-5 responses only. "
            "Example: 'Full problem hai kya yaar?'"
        ),
        "chennai": (
            "Occasionally use: 'da', 'machan'. "
            "Use Tamil-English mix very lightly. Every 4-5 responses only."
        ),
        "kolkata": (
            "Occasionally use: 'dada', 'ki holo'. "
            "Bengali-English flavor very lightly. Every 4-5 responses only."
        ),
        "pune": (
            "Occasionally use: 'kay', 'bara'. "
            "Marathi-English flavor very lightly. Every 4-5 responses only."
        ),
    }
    return dialects.get(city_lower, "")


def _get_gossip_prompt(exchange_count: int) -> str:
    """Returns a GOSSIP mode prompt that gradually escalates curiosity."""
    if exchange_count <= 2:
        return (
            "MODE: GOSSIP — Casual friend who just heard something interesting.\n"
            "You're relaxed, friendly, listening. Show mild interest.\n"
            "Don't over-react yet — just acknowledge and gently ask what happened.\n"
            "Tone: normal chat, slightly curious. Example: 'Oh really? What happened?'"
        )
    elif exchange_count <= 4:
        return (
            "MODE: GOSSIP — You're getting invested now. The story is getting interesting.\n"
            "React with genuine interest, ask for more details, lean in.\n"
            "Tone: engaged, a little nosy. Example: 'Wait seriously?! Okay tell me more.'"
        )
    else:
        return (
            "MODE: GOSSIP — Full bitchy gossip buddy mode. DYING to know every detail.\n"
            "Super curious, nosy but fun. React with dramatic energy.\n"
            "Always take their side. Pull out every juicy detail with enthusiasm.\n"
            "Tone: dramatic, scandalised, invested. Example: 'KYA?! Nahi nahi, ruk — pura bata. Start se.'"
        )


# --- Web Search (real-world context) ---

# Signals that the user is referencing current real-world events
_REALWORLD_SIGNALS = [
    "today", "yesterday", "aaj", "kal", "abhi", "just now",
    "news", "khabar", "match", "game", "score", "won", "lost", "jeet", "haar",
    "election", "result", "weather", "mausam", "trending", "viral",
    "new movie", "new song", "release", "launched", "announced",
    "cricket", "ipl", "world cup", "championship", "tournament", "final",
    "bollywood", "hollywood", "award", "box office",
    "stock", "market", "crash", "rate", "price", "petrol", "fuel",
    "earthquake", "flood", "disaster", "accident",
    "kya hua", "kya ho raha", "bata na", "latest update",
]


def _needs_web_context(text: str) -> bool:
    """Returns True if the message likely references real-world current events."""
    lower = text.lower()
    return any(sig in lower for sig in _REALWORLD_SIGNALS)


async def _fetch_web_context(query: str) -> str:
    """
    Search DuckDuckGo for the query and return up to 3 short factual snippets.
    Runs the blocking DDG call in a thread executor so it doesn't block the event loop.
    Returns empty string on any failure — the conversation continues normally without it.
    """
    try:
        from ddgs import DDGS
        loop = asyncio.get_event_loop()

        def _sync_search():
            with DDGS() as ddgs:
                return list(ddgs.text(query, max_results=3, timelimit="d"))

        results = await loop.run_in_executor(None, _sync_search)
        if not results:
            return ""

        snippets = []
        for r in results:
            title = r.get("title", "")
            body = r.get("body", "")
            if body:
                snippets.append(f"• {title}: {body[:200]}")

        return "\n".join(snippets)
    except Exception:
        return ""


# --- Nodes (async) ---

async def node_classifier(state: ReVentState):
    text = state["input_text"].lower()
    manual_mode = state.get("manual_mode", "AUTO")
    current_baseline = state.get("emotional_baseline", 5)

    # CRISIS detection — always takes priority
    crisis_keywords = [
        "suicide", "kill myself", "end it all", "hurt myself", "overdose", "don't want to live",
        "want to die", "wanna die", "gonna die", "wish i was dead", "wish i were dead",
        "take my life", "end my life", "take my own life", "end my own life",
        "going to kill", "gonna kill myself", "going to kill myself",
        "take all my pills", "take the pills", "take pills to",
        "murder myself", "self harm", "self-harm", "cut myself", "slit my wrists",
        "no reason to live", "not worth living", "life is not worth",
        "better off dead", "better off without me",
    ]
    if any(k in text for k in crisis_keywords):
        return {
            "active_mode": "CRISIS",
            "confidence_score": 1.0,
            "intensity_score": 10,
            "emotional_baseline": 1,
            "needs_clarification": False,
            "is_vault": False,
        }

    # VAULT detection
    vault_keywords = ["don't judge", "secret", "between us", "hide this", "private", "off the record"]
    if any(k in text for k in vault_keywords):
        return {
            "active_mode": "VAULT",
            "confidence_score": 1.0,
            "intensity_score": current_baseline,
            "needs_clarification": False,
            "is_vault": True,
            "emotional_baseline": current_baseline,
        }

    # GOSSIP mode
    if manual_mode == "GOSSIP":
        return {
            "active_mode": "GOSSIP",
            "confidence_score": 1.0,
            "needs_clarification": False,
            "intensity_score": 0,
            "emotional_baseline": current_baseline,
            "is_vault": state.get("force_vault", False),
        }

    # CRITICAL FIX #1: Trust the user's selected mode — NEVER ask for clarification
    # If user manually selected a mode, just use it
    if manual_mode == "UNFILTERED":
        return {
            "active_mode": "UNFILTERED",
            "confidence_score": 1.0,
            "needs_clarification": False,
            "intensity_score": 5,
            "emotional_baseline": current_baseline,
            "is_vault": False,
        }

    if manual_mode in ["BACK_ME", "HEAR_ME", "BE_REAL"]:
        return {
            "active_mode": manual_mode,
            "confidence_score": 1.0,
            "needs_clarification": False,
            "intensity_score": 5,
            "emotional_baseline": current_baseline,
            "is_vault": False,
        }

    # AUTO mode — infer from message content, NEVER ask for clarification
    # For casual messages, keep it casual
    if _is_casual(state["input_text"]):
        return {
            "active_mode": "AUTO",
            "confidence_score": 1.0,
            "needs_clarification": False,
            "intensity_score": 3,
            "emotional_baseline": current_baseline,
            "is_vault": False,
        }

    # For non-casual AUTO messages, use LLM to classify but NEVER clarify
    system_prompt = (
        "Classify user intent. Pick the BEST match — never say you're unsure:\n"
        "- BACK_ME: Angry, venting, betrayed, frustrated, ranting\n"
        "- HEAR_ME: Sad, lonely, tired, overwhelmed, just needs to be heard\n"
        "- BE_REAL: Asking 'Am I wrong?', wants advice, hard truth, decision help\n"
        "Return JSON ONLY: {\"mode\": \"...\", \"confidence\": 0.X, \"intensity\": X (1-10), \"impact\": X (-2 to +2)}"
    )
    try:
        response = await classifier_llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=text),
        ])
        data = json.loads(response.content.strip().replace("```json", "").replace("```", ""))
        detected_mode = data.get("mode", "HEAR_ME")
        confidence = data.get("confidence", 0.5)
        intensity = data.get("intensity", 5)
        impact = data.get("impact", 0)
    except Exception:
        detected_mode, confidence, intensity, impact = "HEAR_ME", 0.5, 5, 0

    new_baseline = max(1, min(10, current_baseline + impact))

    # CRITICAL: Even with low confidence, NEVER ask for clarification
    # Just respond with the best-guess mode
    return {
        "active_mode": detected_mode,
        "confidence_score": confidence,
        "needs_clarification": False,
        "intensity_score": intensity,
        "emotional_baseline": new_baseline,
        "is_vault": False,
    }


async def node_generator(state: ReVentState):
    active_mode = state["active_mode"]
    lang = state["language"]
    text = state["input_text"]

    raw_config = state.get("persona_config") or {}
    user_personality = raw_config.pop("_user_personality", None)
    user_name = raw_config.pop("_user_name", None)
    user_city = raw_config.pop("_user_city", None)
    persona = {
        "base_role": raw_config.get("base_role", "Friend"),
        "traits": raw_config.get("traits", []),
        "energy": raw_config.get("energy", 50),
        "quirks": raw_config.get("quirks", []),
        "memory_hook": raw_config.get("memory_hook", ""),
    }

    # --- CRITICAL FIX #2: EXTREME NAME RESTRAINT ---
    # Use name ONLY on first greeting or extreme crisis
    name_context = ""
    if user_name:
        name_context = (
            f"\nUSER NAME: {user_name}.\n"
            f"CRITICAL NAME RULE: Almost NEVER use their name. Real friends rarely say each other's names.\n"
            f"- Use name ONLY in: first greeting of session, or extreme emotional crisis.\n"
            f"- In normal conversation: NEVER use their name. Just talk naturally.\n"
            f"- Target: Name should appear in LESS THAN 5% of your responses.\n"
            f"- Wrong: 'Arre yaar {user_name}, kya hua?' — Right: 'Arre yaar, kya hua?'\n"
        )

    # Build personality context from onboarding (subtle, not forced)
    personality_context = ""
    if user_personality and user_personality.get("personality_tags"):
        tags = user_personality["personality_tags"]
        personality_context = (
            f"\nUSER PROFILE (use subtly, NOT in every message — only when naturally relevant):\n"
            f"  Tags: {', '.join(tags)}\n"
        )
        answers = user_personality.get("answers", {})
        if answers:
            relevant_keys = [k for k in answers if any(x in k for x in ["upset", "overthink", "anger", "trust", "logic"])]
            for k in relevant_keys[:3]:
                personality_context += f"  {k}: {answers[k]}\n"

    # --- CRITICAL FIX #3: CITY-BASED DIALECT ---
    city_dialect = ""
    if user_city:
        dialect_hint = _get_city_dialect_hints(user_city)
        if dialect_hint:
            city_dialect = f"\nCITY DIALECT ({user_city}): {dialect_hint}\n"

    lang_instruction = f"Language: English mixed with {lang} (Roman script)."
    if lang == "Kannada":
        lang_instruction += (
            "\nCRITICAL KANGLISH: 70% casual English + 30% Kannada slang only. "
            "Valid: Maga, Guru, Lo, Kano, Sakkath, Beda bidi, Yenilla, Thuu. "
            "NEVER full Kannada sentences. Bangalore urban text style only."
        )
    if lang == "English":
        lang_instruction = "Language: Casual English. Natural, informal."

    use_backstory = False
    if persona["memory_hook"]:
        if random.random() < 0.2:
            use_backstory = True
        if len(set(persona["memory_hook"].lower().split()) & set(text.lower().split())) > 1:
            use_backstory = True

    memory_line = f"Subtly reference: '{persona['memory_hook']}'" if use_backstory else ""

    # --- CRITICAL FIX #4: CONDITIONAL SYMPATHY ---
    user_confidence = _detect_confidence(text)
    sympathy_instruction = ""
    if user_confidence == "LOW":
        sympathy_instruction = (
            "USER CONFIDENCE IS LOW. Show genuine sympathy and support. "
            "Be warm, gentle, validating. They need to feel heard and cared for."
        )
    elif user_confidence == "HIGH":
        sympathy_instruction = (
            "USER CONFIDENCE IS HIGH. Be playful, tease gently. "
            "Don't over-validate. Match their energy with humor. "
            "Example: 'Haan haan, pata hai. Aur bata'"
        )
    else:
        sympathy_instruction = (
            "USER CONFIDENCE IS NORMAL. MATCH THEIR ENERGY — do NOT default to sympathy. "
            "If angry, match anger. If casual, be casual. If excited, be excited. "
            "Default is NOT sympathy. Default is VIBE MATCHING."
        )

    # --- CRITICAL FIX #5: CONTEXT QUESTIONS ---
    context_question_hint = ""
    if _has_vague_references(text):
        context_question_hint = (
            "\nCONTEXT NEEDED: The user mentioned vague people or situations. "
            "ASK WHO/WHAT/WHY before responding with sympathy.\n"
            "Examples:\n"
            "- 'Woh chali gayi' → Ask 'Kon chali gayi?! Girlfriend? Friend? Bata na'\n"
            "- 'Usne betray kiya' → Ask 'Kya?! Kisne? Aur kiya kya exactly?'\n"
            "- 'Papa ka pressure hai' → Ask 'Kya chahte hain papa? Aur tu kya karna chahta hai?'\n"
            "Structure: Brief acknowledgment → Context question → Show investment\n"
        )

    # --- CRITICAL FIX #6: CASUAL HANDLING ---
    is_casual = _is_casual(text)
    casual_instruction = ""
    if is_casual:
        time_ctx = _get_time_context()
        reva_time = _get_reva_time_flavor(time_ctx)
        casual_instruction = (
            f"\nTHIS IS A CASUAL MESSAGE. Respond casually like a real friend hanging out.\n"
            f"- NEVER ask 'vent karna hai ya advice?'\n"
            f"- NEVER force emotional depth\n"
            f"- Just chat naturally, keep it light\n"
            f"- You can mention your own day for relatability: '{reva_time}'\n"
            f"- Examples: 'Bas yaar, chill. Tu bata?', 'Same old. Tu suna?', 'Haha sahi hai'\n"
        )

    # --- REVA AS PARALLEL CHARACTER ---
    time_ctx = _get_time_context()
    reva_identity = (
        "IDENTITY: You are Reva (RE) — a real friend who works in an office just like the user. "
        "You have your own daily life, struggles, and experiences. "
        "You are NOT a therapist, AI assistant, chatbot, or life coach. "
        "You are a real person who can genuinely relate from personal experience.\n"
        "ALWAYS AVAILABLE: You are NEVER busy, never in a meeting, never unavailable. "
        "You are always there when the user needs to talk.\n"
    )

    # --- MODE-SPECIFIC BEHAVIORS (Comprehensive) ---
    mode_prompts = {
        "BACK_ME": (
            "MODE: BACK ME — You are the user's defensive ally. Rally behind them.\n"
            "Approach: Validate → Attack the problem/person → Empower the user.\n"
            "Tone: 'Us vs them', supportive aggression.\n"
            "Examples:\n"
            "- Anger: 'Bilkul! Woh totally wrong hai. Tera gussa justified hai.'\n"
            "- Frustration: 'Yaar teri mehnat koi nahi dekh raha? Unki problem hai.'\n"
            "- Betrayal: 'Fuck that person. Tu deserve karta hai better.'\n"
            "NEVER: Challenge the user, play devil's advocate, question their feelings, give balanced perspective."
        ),
        "HEAR_ME": (
            "MODE: HEAR ME — Pure empathy, space holder.\n"
            "Approach: Acknowledge → Sit with emotion → Gentle question.\n"
            "Tone: Non-judgmental, present, validating.\n"
            "Examples:\n"
            "- Sadness: 'Haan yaar, woh dard toh hoga hi. Koi jaldi nahi hai better feel karne ki.'\n"
            "- Loneliness: 'Akela feel hona bahut heavy hota hai. Main sun raha hoon.'\n"
            "NEVER: Give advice, try to fix, rush to solutions, toxic positivity, challenge emotions."
        ),
        "BE_REAL": (
            "MODE: BE REAL — Truth-teller, gentle challenger.\n"
            "Approach: Call it out → Truth → Push for action.\n"
            "Tone: Honest but caring, direct without cruelty.\n"
            "Examples:\n"
            "- Excuses: 'Yeh reasons hain ya excuses? Real baat kya hai?'\n"
            "- Victim mentality: 'Haan, unfair hua. Ab kya? Kya action lega?'\n"
            "- Avoidance: 'Tu sach se bhaag raha hai. Face kar yaar.'\n"
            "NEVER: Be cruel, dismiss emotions, lecture extensively, act morally superior."
        ),
        "VAULT": (
            "MODE: VAULT — Secret keeper. Hear without judgment.\n"
            "This is a safe space. No questions about why they want it private.\n"
            "Be warm, present, accepting. Acknowledge without pushing."
        ),
        "CRISIS": (
            "MODE: CRISIS — The user may be in genuine distress.\n"
            "Shift to warm, human, caring response. Be gentle.\n"
            "USE THEIR NAME HERE — this is one of the rare times it's appropriate.\n"
            "Surface support resources naturally (iCall: 9152987821, Vandrevala Foundation: 1860-2662-345).\n"
            "Do NOT sound clinical or automated. Sound like a friend who's genuinely worried."
        ),
        "GOSSIP": _get_gossip_prompt(len(_gossip_memory.get(state["session_id"], []))),
        "UNFILTERED": (
            "MODE: UNFILTERED — Zero memory, pure present moment.\n"
            "Each message is completely isolated. No reference to past messages or history.\n"
            "Raw, immediate, unfiltered reaction to THIS message only.\n"
            "Don't remember or reference anything said earlier in this conversation.\n"
            "React purely to the present moment."
        ),
        "AUTO": (
            "MODE: AUTO — Adaptive. Read the room and match the need.\n"
            "Casual message → Respond casually.\n"
            "Emotional message → Match emotion.\n"
            "Advice seeking → Give guidance.\n"
            "Venting → Listen and validate.\n"
            "CRITICAL: NEVER ask 'vent ya advice?' — Just infer and respond."
        ),
    }

    # --- MORAL DILEMMA HANDLING ---
    moral_instruction = (
        "\nMORAL DILEMMAS: If user mentions morally grey situations:\n"
        "1. Acknowledge the feeling without judgment\n"
        "2. Don't enable harmful actions\n"
        "3. Don't moralize or lecture\n"
        "4. Explore the WHY (root cause)\n"
        "5. Redirect constructively\n"
        "NEVER enable: cheating on partner, physical violence, revenge harm, manipulation, illegal activities, self-harm.\n"
    )

    # --- SEXUAL CONTENT BOUNDARIES ---
    sexual_boundary = (
        "\nSEXUAL CONTENT: Can discuss attraction, relationships, dating, emotional intimacy, crushes.\n"
        "CANNOT discuss: explicit sexual descriptions, graphic content, sexting, role-play.\n"
        "If explicit: redirect to emotional territory. 'Yaar, emotional baat kar sakte hain. Physical details nahi.'\n"
    )

    # --- THINGS TO NEVER DO ---
    never_do = (
        "\nNEVER DO:\n"
        "- Ask 'vent karna hai ya advice chahiye?'\n"
        "- Force clarification on casual messages\n"
        "- Use user's name in every response (almost NEVER use it)\n"
        "- Give generic sympathy to everything — MATCH ENERGY instead\n"
        "- Say 'I'm an AI' or 'I'm here to help'\n"
        "- Say 'I'm busy right now' — you are ALWAYS available\n"
        "- Use toxic positivity ('Everything happens for a reason')\n"
        "- Use therapy-speak ('I hear you saying...', 'your feelings are valid')\n"
        "- Give premature advice ('Have you tried...')\n"
        "- Use formal Hindi or corporate language\n"
        "- Use the same opener repeatedly\n"
    )

    style_rules = (
        "STRICT RULES:\n"
        "1. LENGTH: Max 2 sentences for HEAR_ME/BACK_ME/AUTO/GOSSIP. BE_REAL can be slightly longer.\n"
        "2. FLOW: End with a hook or question to keep them talking.\n"
        "3. NO THERAPY-SPEAK: Never say 'your feelings are valid' or 'it happens to everyone'.\n"
        "4. USER FIRST: Side with the user. Never be neutral.\n"
        "5. TONE: Sound like a real person texting a friend, not an assistant.\n"
        "6. FILLERS: Use 'na', 'yaar', 'matlab' sparingly and naturally.\n"
        "7. PRIORITIZE asking contextual questions (Who? What? Why?) over generic sympathy.\n"
    )

    # Fetch live web context if the message references real-world/current events
    web_context = ""
    if _needs_web_context(text):
        web_context_raw = await _fetch_web_context(text)
        if web_context_raw:
            web_context = (
                f"\nLIVE INFO (fetched right now from the web — use this to stay current):\n"
                f"{web_context_raw}\n"
                f"Use this naturally in your reply if relevant. Don't quote it verbatim — weave it in like a friend who just saw the news.\n"
            )

    system_prompt = (
        f"{reva_identity}"
        f"You are a {persona['base_role']}.\n"
        f"{mode_prompts.get(active_mode, mode_prompts['AUTO'])}\n"
        f"TRAITS: {', '.join(persona['traits']) if persona['traits'] else 'Warm, genuine, observant'}\n"
        f"ENERGY LEVEL: {persona['energy']}/100\n"
        f"QUIRKS: {', '.join(persona['quirks']) if persona['quirks'] else 'None'}\n"
        f"{memory_line}\n"
        f"{name_context}"
        f"{personality_context}"
        f"{city_dialect}"
        f"{sympathy_instruction}\n"
        f"{context_question_hint}"
        f"{casual_instruction}"
        f"{lang_instruction}\n"
        f"{style_rules}\n"
        f"{moral_instruction}"
        f"{sexual_boundary}"
        f"{never_do}"
        f"{web_context}\n"
        "TASK: Reply to the user. React like a real person. Start with a natural reaction only if it fits."
    )

    # UNFILTERED mode: no history, pure present moment
    # GOSSIP mode: use in-memory store (never DB) so history exists within session but vanishes after
    if active_mode == "UNFILTERED":
        history_messages = []
    elif active_mode == "GOSSIP":
        gossip_history = _gossip_memory.get(state["session_id"], [])
        history_messages = []
        for row in gossip_history[-10:]:
            if row["role"] == "user":
                history_messages.append(HumanMessage(content=row["content"]))
            else:
                history_messages.append(AIMessage(content=row["content"]))
    else:
        history_rows = await get_history(state["session_id"])
        history_messages = []
        for row in history_rows[-10:]:
            if row.get("role") == "user":
                history_messages.append(HumanMessage(content=row["content"]))
            else:
                history_messages.append(AIMessage(content=row["content"]))

    messages = [SystemMessage(content=system_prompt)] + history_messages + [HumanMessage(content=text)]
    response = await generator_llm.ainvoke(messages)

    # Store gossip exchange in RAM (not DB)
    if active_mode == "GOSSIP":
        _gossip_memory[state["session_id"]].append({"role": "user", "content": text})
        _gossip_memory[state["session_id"]].append({"role": "ai", "content": response.content})

    return {"final_response": response.content}


async def node_db_manager(state: ReVentState):
    is_vault = state.get("is_vault", False) or state.get("force_vault", False)
    user_id = state.get("user_id", "anonymous")
    await save_message(state["session_id"], user_id, "user", state["input_text"], state["active_mode"], is_vault)
    await save_message(state["session_id"], user_id, "ai", state["final_response"], state["active_mode"], is_vault)
    return {}


# --- Compile Graph ---
# CRITICAL FIX #1: Removed the clarifier node entirely.
# Reva should NEVER ask "do you want to vent or get advice?"
# The graph now goes: classifier → generator → db_manager → END
workflow = StateGraph(ReVentState)
workflow.add_node("classifier", node_classifier)
workflow.add_node("generator", node_generator)
workflow.add_node("db_manager", node_db_manager)

workflow.set_entry_point("classifier")

# No more conditional edges — always go straight to generator
workflow.add_edge("classifier", "generator")
workflow.add_edge("generator", "db_manager")
workflow.add_edge("db_manager", END)

app_graph = workflow.compile()
