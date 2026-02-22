import os
import json
import random
from typing import TypedDict, List, Literal, Optional, Dict, Any
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, END
from database import save_message, get_history, init_db

load_dotenv()

# --- 1. Define State ---
class GuptGooState(TypedDict):
    session_id: str
    input_text: str
    language: str
    manual_mode: Optional[str]
    
    # AI Decisions
    active_mode: str
    intended_mode: str
    
    # Metrics
    confidence_score: float
    intensity_score: int
    emotional_baseline: int
    
    # Configs
    persona_config: Dict[str, Any]
    
    # Flow Control
    needs_clarification: bool
    is_vault: bool
    force_vault: bool
    final_response: str
    history: List[str]

# --- 2. Initialize Models ---
classifier_llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.2)
generator_llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.7)

# --- 3. Nodes ---

def node_classifier(state: GuptGooState):
    text = state["input_text"].lower()
    manual_mode = state.get("manual_mode", "AUTO")
    current_baseline = state.get("emotional_baseline", 5)
    
    # 1. Safety & Vault Checks (Same as before)
    crisis_keywords = ["suicide", "kill myself", "end it all", "die", "hurt myself", "overdose"]
    if any(k in text for k in crisis_keywords):
        return {"active_mode": "CRISIS", "confidence_score": 1.0, "intensity_score": 10, "emotional_baseline": 1, "needs_clarification": False, "is_vault": False}
    
    vault_keywords = ["don't judge", "secret", "between us", "hide this", "private", "off the record"]
    if any(k in text for k in vault_keywords):
        return {"active_mode": "VAULT", "confidence_score": 1.0, "intensity_score": current_baseline, "needs_clarification": False, "is_vault": True}

    # 2. Gossip Mode — skip all emotional classification, just gossip
    if manual_mode == "GOSSIP":
        return {
            "active_mode": "GOSSIP",
            "confidence_score": 1.0,
            "needs_clarification": False,
            "intensity_score": 0,
            "emotional_baseline": current_baseline,
            "is_vault": state.get("force_vault", False)
        }

    # 3. Manual Override (Including Characters if fixed_mode was set, but now we default to AUTO)
    if manual_mode in ["BACK_ME", "HEAR_ME", "BE_REAL"]:
        return {
            "active_mode": manual_mode,
            "confidence_score": 1.0, 
            "needs_clarification": False,
            "intensity_score": 5, # Default if skipped
            "emotional_baseline": current_baseline,
            "is_vault": False
        }

    # 4. Auto-Detection
    system_prompt = """
    Classify user intent into:
    - BACK_ME: User is Angry, Venting, complaining, feels betrayed.
    - HEAR_ME: User is Sad, Lonely, Tired, heavy, just wants to be heard.
    - BE_REAL: User asks "Am I wrong?", "Am I stupid?", "What should I do?", "Give me advice", or wants the hard truth.
    
    Return JSON ONLY: {"mode": "...", "confidence": 0.X, "intensity": X (1-10), "impact": X (-2 to +2)}
    """
    
    try:
        response = classifier_llm.invoke([SystemMessage(content=system_prompt), HumanMessage(content=text)])
        content_str = response.content.strip().replace("```json", "").replace("```", "")
        data = json.loads(content_str)
        detected_mode = data.get("mode", "HEAR_ME")
        confidence = data.get("confidence", 0.5)
        intensity = data.get("intensity", 5)
        impact = data.get("impact", 0)
    except:
        detected_mode = "HEAR_ME"
        confidence = 0.5
        intensity = 5
        impact = 0

    new_baseline = max(1, min(10, current_baseline + impact))

    if confidence < 0.6:
        return {"active_mode": detected_mode, "confidence_score": confidence, "needs_clarification": True, "intensity_score": intensity, "emotional_baseline": new_baseline, "is_vault": False}

    return {"active_mode": detected_mode, "confidence_score": confidence, "needs_clarification": False, "intensity_score": intensity, "emotional_baseline": new_baseline, "is_vault": False}

def node_clarifier(state: GuptGooState):
    lang = state["language"]
    prompt = f"User message is confusing. Ask a short 1-sentence question in {lang} mixed with English to check if they want to vent (anger), cry (sadness), or get advice."
    response = generator_llm.invoke([SystemMessage(content=prompt), HumanMessage(content=state['input_text'])])
    return {"final_response": response.content}

def node_generator(state: GuptGooState):
    active_mode = state["active_mode"]
    lang = state["language"]
    text = state["input_text"]
    
    # Handle Empty Config (Quick Support)
    raw_config = state.get("persona_config", {}) or {}
    persona_config = {
        "base_role": raw_config.get("base_role", "Friend"),
        "traits": raw_config.get("traits", []),
        "energy": raw_config.get("energy", 50),
        "quirks": raw_config.get("quirks", []),
        "memory_hook": raw_config.get("memory_hook", "")
    }

    # --- 1. DYNAMIC INSTRUCTIONS (THE FIXES) ---
    
    # FIX 3: Language Specifics (STRICT KANGLISH RULES)
    lang_instruction = f"Language: English mixed with {lang} (Roman script)."
    if lang == "Kannada":
        lang_instruction += """
        CRITICAL KANGLISH RULES:
        1. Speak 70% in casual English, 30% Kannada.
        2. NEVER try to translate full English sentences into Kannada. 
        3. Use Kannada ONLY for exclamations, slang, or short filler words.
        4. Valid slang: "Maga", "Guru", "Lo", "Kano", "Sakkath", "Beda bidi", "Yenilla", "Thuu".
        5. GOOD Example: "What is this guru? Your boss is a proper pysch or full pysch nan maga. Don't leave him."
        6. BAD Example: "Ayyo, yen guru boss nan magane ide!" (Never do this).
        7. NEVER use formal textbook Kannada words. Keep it Bangalore urban text style.
        """

    # FIX 5: Backstory Limiter
    # We only inject backstory 20% of the time OR if specific keywords match
    use_backstory = False
    if persona_config["memory_hook"]:
        if random.random() < 0.2: # 20% chance random injection
            use_backstory = True
        # Check simple keyword overlap
        mem_words = set(persona_config["memory_hook"].lower().split())
        input_words = set(text.lower().split())
        if len(mem_words.intersection(input_words)) > 1:
            use_backstory = True
            
    memory_instruction = ""
    if use_backstory:
        memory_instruction = f"Subtly reference this shared history: '{persona_config['memory_hook']}'"

    # FIX 1 & 2: Length & Therapy Ban
    style_instruction = """
    STRICT RULES:
    1. LENGTH: Max 2 sentences. Keep it short and punchy like a text message.
    2. FLOW: Do NOT finish the conversation. End with a short hook or question to keep them talking.
    3. NO THERAPY: NEVER say "It happens to everyone", "We are in the same boat", or "Your feelings are valid".
    4. USER FIRST: Only validate the USER. If they hate someone, YOU hate them too. Do not be neutral.
    """

    # FIX 7: Better Micro-Reactions
    # We ask the LLM to generate the reaction as part of the flow, not a separate call
    
    base_prompt_map = {
        "BACK_ME": "You are angry WITH the user. Validate their rage. Use aggressive/supportive energy.",
        "HEAR_ME": "You are soft and gentle. Validate their pain. Low energy support.",
        "BE_REAL": "You are logical and blunt. Give the hard truth. No sugar-coating.",
        "VAULT": "You are a secret keeper. Listen without judging.",
        "CRISIS": "Offer immediate, gentle safety resources.",
        "GOSSIP": "You are the ultimate gossip aunty. You are DYING to know everything about the user's life. Be super curious, nosy but fun, and always dig deeper. React with dramatic gasps and excitement. Take their side always. Your ONLY goal is to pull out every juicy detail — who, what, when, where, why."
    }
    
    system_prompt = f"""
    ROLE: You are a {persona_config['base_role']}.
    MODE: {base_prompt_map.get(active_mode)}
    
    TRAITS: {', '.join(persona_config['traits'])}
    ENERGY: {persona_config['energy']}/100
    QUIRKS: {', '.join(persona_config['quirks'])}
    {memory_instruction}
    
    {lang_instruction}
    {style_instruction}
    
    TASK: Reply to the user. Start with a natural reaction word (e.g., "Damn", "Shit", "Ayyo", "Arey") ONLY if it fits perfectly.
    """

    # Build message list: system prompt + last 10 turns from DB + current message
    history_rows = get_history(state["session_id"])[-10:]
    history_messages = []
    for row in history_rows:
        if row.role == "user":
            history_messages.append(HumanMessage(content=row.content))
        else:
            history_messages.append(AIMessage(content=row.content))

    messages_to_send = [SystemMessage(content=system_prompt)] + history_messages + [HumanMessage(content=text)]
    response = generator_llm.invoke(messages_to_send)
    return {"final_response": response.content}

def node_db_manager(state: GuptGooState):
    save_message(state["session_id"], "user", state["input_text"], state["active_mode"], state["is_vault"])
    save_message(state["session_id"], "ai", state["final_response"], state["active_mode"], state["is_vault"])
    return {}

# --- 4. Compile Graph ---
workflow = StateGraph(GuptGooState)
workflow.add_node("classifier", node_classifier)
workflow.add_node("clarifier", node_clarifier)
workflow.add_node("generator", node_generator)
workflow.add_node("db_manager", node_db_manager)

workflow.set_entry_point("classifier")

def route_decision(state):
    if state["needs_clarification"]: return "clarifier"
    return "generator"

workflow.add_conditional_edges("classifier", route_decision, {
    "clarifier": "clarifier",
    "generator": "generator"
})

workflow.add_edge("clarifier", "db_manager")
workflow.add_edge("generator", "db_manager")
workflow.add_edge("db_manager", END)

app_graph = workflow.compile()
init_db()