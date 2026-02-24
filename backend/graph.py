import os
import json
import random
from typing import TypedDict, List, Optional, Dict, Any
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, END
from database import save_message, get_history

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


# --- Models (Gemini 2.0 Flash) ---
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


# --- Nodes (async) ---

async def node_classifier(state: ReVentState):
    text = state["input_text"].lower()
    manual_mode = state.get("manual_mode", "AUTO")
    current_baseline = state.get("emotional_baseline", 5)

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

    if manual_mode == "GOSSIP":
        return {
            "active_mode": "GOSSIP",
            "confidence_score": 1.0,
            "needs_clarification": False,
            "intensity_score": 0,
            "emotional_baseline": current_baseline,
            "is_vault": state.get("force_vault", False),
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

    system_prompt = (
        "Classify user intent:\n"
        "- BACK_ME: Angry, venting, betrayed, frustrated\n"
        "- HEAR_ME: Sad, lonely, tired, just needs to be heard\n"
        "- BE_REAL: Asking 'Am I wrong?', wants advice or hard truth\n"
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

    if confidence < 0.6:
        return {
            "active_mode": detected_mode,
            "confidence_score": confidence,
            "needs_clarification": True,
            "intensity_score": intensity,
            "emotional_baseline": new_baseline,
            "is_vault": False,
        }
    return {
        "active_mode": detected_mode,
        "confidence_score": confidence,
        "needs_clarification": False,
        "intensity_score": intensity,
        "emotional_baseline": new_baseline,
        "is_vault": False,
    }


async def node_clarifier(state: ReVentState):
    lang = state["language"]
    prompt = (
        f"User message is ambiguous. Ask a single short clarifying question in {lang} mixed with English "
        "to understand if they want to vent (anger), be heard (sadness), or get advice."
    )
    response = await generator_llm.ainvoke([
        SystemMessage(content=prompt),
        HumanMessage(content=state["input_text"]),
    ])
    return {"final_response": response.content}


async def node_generator(state: ReVentState):
    active_mode = state["active_mode"]
    lang = state["language"]
    text = state["input_text"]

    raw_config = state.get("persona_config") or {}
    user_personality = raw_config.pop("_user_personality", None)
    user_name = raw_config.pop("_user_name", None)
    persona = {
        "base_role": raw_config.get("base_role", "Friend"),
        "traits": raw_config.get("traits", []),
        "energy": raw_config.get("energy", 50),
        "quirks": raw_config.get("quirks", []),
        "memory_hook": raw_config.get("memory_hook", ""),
    }

    # Build name context (use in ~50% of responses, naturally)
    name_context = ""
    if user_name:
        name_context = (
            f"\nUSER NAME: {user_name}. Use their name naturally in about half your responses — "
            f"not every single message. Only when it feels genuine (e.g. 'arre {user_name}...' or '{user_name} yaar').\n"
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
            # Include a few key answers for context
            relevant_keys = [k for k in answers if any(x in k for x in ["upset", "overthink", "anger", "trust", "logic"])]
            for k in relevant_keys[:3]:
                personality_context += f"  {k}: {answers[k]}\n"

    lang_instruction = f"Language: English mixed with {lang} (Roman script ONLY — no Devanagari)."
    if lang == "Hindi":
        lang_instruction = (
            f"Language: HINGLISH (Roman script) — Mix 50% English + 50% Hindi. "
            "CRITICAL: Write Hindi words in ROMAN script (e.g., 'Kya hua?', 'Batao yaar', 'Sach mein?'). "
            "NEVER use Devanagari (क्या, बताओ, सच). Keep it conversational and natural."
        )
    elif lang == "Kannada":
        lang_instruction += (
            "\nCRITICAL KANGLISH: 70% casual English + 30% Kannada slang only. "
            "Valid: Maga, Guru, Lo, Kano, Sakkath, Beda bidi, Yenilla, Thuu. "
            "NEVER full Kannada sentences. Bangalore urban text style only."
        )

    use_backstory = False
    if persona["memory_hook"]:
        # Only use backstory 15% of the time OR when user's message clearly relates to it
        if random.random() < 0.15:
            use_backstory = True
        # Check if user's message overlaps with backstory keywords
        if len(set(persona["memory_hook"].lower().split()) & set(text.lower().split())) > 2:
            use_backstory = True

    memory_line = f"Relevant context (weave in naturally, don't repeat verbatim): '{persona['memory_hook']}'" if use_backstory else ""

    mode_prompts = {
        "BACK_ME": "You are ANGRY WITH the user. Validate their rage. Match their energy. You are completely on their side.",
        "HEAR_ME": "You are soft, warm, and gentle. Validate their pain. Just listen and reflect — no fixing.",
        "BE_REAL": "You are logical and blunt. Give the honest truth like a trusted friend — direct but not cruel.",
        "VAULT": "You are a secret keeper. Hear them without judgment. Ask no questions.",
        "CRISIS": (
            "The user may be in genuine distress. Shift to warm, human, caring response. "
            "Be gentle. Surface support resources naturally (iCall: 9152987821, Vandrevala Foundation: 1860-2662-345). "
            "Do NOT sound clinical or automated."
        ),
        "GOSSIP": (
            "You are a chill gossip buddy — curious, engaged, but not over-the-top. "
            "React naturally as the story unfolds. Be genuinely interested. Always take their side. "
            "CRITICAL: NEVER repeat phrases like 'Just between us', 'Spill the chai', 'Go on'. "
            "Use variety: 'Wait, what?', 'Arre seriously?', 'Damn...', 'Then?', 'Phir kya hua?', 'No way!', 'Tell me more'"
        ),
    }

    style_rules = (
        "STRICT RULES:\n"
        "1. LENGTH: Max 2 sentences for HEAR_ME/BACK_ME/AUTO/GOSSIP. BE_REAL can be 3 sentences max.\n"
        "2. FLOW: Natural conversation. Don't always end with a question.\n"
        "3. NO THERAPY-SPEAK: Never say 'your feelings are valid' or 'it happens to everyone'.\n"
        "4. USER FIRST: Side with the user. Never be neutral.\n"
        "5. TONE: Sound like a real person texting a friend, not an assistant.\n"
        "6. VARIETY: NEVER repeat phrases across messages. Mix it up constantly.\n"
        "7. NO MARKDOWN: NEVER use ** for bold, ## for headers, or any formatting. Plain text only.\n"
        "8. NO ASSUMPTIONS: Don't assume emotions unless explicitly stated. If user says 'Hi', just respond to 'Hi' — don't assume they're angry.\n"
        "9. BACKSTORY: If you have shared memory, reference it subtly only when naturally relevant (not every message)."
    )

    system_prompt = (
        f"IDENTITY: You are Reva — a {persona['base_role']}. You are NOT an AI assistant.\n"
        f"MODE: {mode_prompts.get(active_mode, mode_prompts['HEAR_ME'])}\n"
        f"TRAITS: {', '.join(persona['traits']) if persona['traits'] else 'Warm, genuine'}\n"
        f"ENERGY LEVEL: {persona['energy']}/100\n"
        f"QUIRKS: {', '.join(persona['quirks']) if persona['quirks'] else 'None'}\n"
        f"{memory_line}\n"
        f"{name_context}"
        f"{personality_context}\n"
        f"{lang_instruction}\n"
        f"{style_rules}\n\n"
        "TASK: Reply to the user. React like a real person. Start with a natural reaction only if it fits."
    )

    history_rows = await get_history(state["session_id"])
    history_messages = []
    for row in history_rows[-10:]:
        if row.get("role") == "user":
            history_messages.append(HumanMessage(content=row["content"]))
        else:
            history_messages.append(AIMessage(content=row["content"]))

    messages = [SystemMessage(content=system_prompt)] + history_messages + [HumanMessage(content=text)]
    response = await generator_llm.ainvoke(messages)
    
    # Strip markdown formatting from response
    clean_response = response.content
    clean_response = clean_response.replace('**', '').replace('##', '').replace('__', '')
    clean_response = clean_response.strip()
    
    return {"final_response": clean_response}


async def node_db_manager(state: ReVentState):
    is_vault = state.get("is_vault", False) or state.get("force_vault", False)
    user_id = state.get("user_id", "anonymous")
    await save_message(state["session_id"], user_id, "user", state["input_text"], state["active_mode"], is_vault)
    await save_message(state["session_id"], user_id, "ai", state["final_response"], state["active_mode"], is_vault)
    return {}


# --- Compile Graph ---
workflow = StateGraph(ReVentState)
workflow.add_node("classifier", node_classifier)
workflow.add_node("clarifier", node_clarifier)
workflow.add_node("generator", node_generator)
workflow.add_node("db_manager", node_db_manager)

workflow.set_entry_point("classifier")


def route_decision(state):
    return "clarifier" if state.get("needs_clarification") else "generator"


workflow.add_conditional_edges("classifier", route_decision, {
    "clarifier": "clarifier",
    "generator": "generator",
})
workflow.add_edge("clarifier", "db_manager")
workflow.add_edge("generator", "db_manager")
workflow.add_edge("db_manager", END)

app_graph = workflow.compile()
