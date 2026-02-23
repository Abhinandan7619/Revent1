"""
Onboarding chat flow for RE — 4-question personality discovery (1 phase).
Only runs for new users chatting with RE (default persona), not gossip or custom characters.
"""

import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from database import update_user, get_history
import os
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")

onboarding_llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0.75,
    google_api_key=GOOGLE_API_KEY,
)

# ─── Onboarding Phases & Questions ────────────────────────────────────────────

PHASES = [
    {
        "name": "Welcome & Consent",
        "phase_label": "intro",
        "questions": [
            {
                "id": "welcome",
                "type": "consent",
                "prompt": "Greet the user by name. Then say (in the user's language style): 'We just met... asking you to spill everything right away would be awkward, right? 😅 That's not how it works here. If you're cool with it, I'll ask some chill questions to get to know you... so that when you want to talk, I already have an idea of what kind of person you are.' Then ask if they're ready. Keep it warm and casual.",
                "yes_tags": [],
                "no_action": "respect_decline",
            }
        ],
    },
    {
        "name": "Mood & Entertainment",
        "phase_label": "movies aur music",
        "questions": [
            {
                "id": "q1_1_movie_vibe",
                "prompt": "Ask about their movie preferences: Action where everything blows up? Slow emotional ones that lighten the heart? Or dark twisted thrillers that mess with your mind? Keep it fun with emojis.",
                "tag_map": {"thriller": "analytical_mind", "emotional": "deep_feeler", "action": "high_energy", "mixed": "flexible"},
            },
            {
                "id": "q1_2_repeat_movie",
                "prompt": "Ask: If they had to watch ONE movie on repeat for life, which one would it be? 🔁",
                "tag_map": {},
            },
            {
                "id": "q1_3_music_vibe",
                "prompt": "Ask about music taste: Heartbreak songs? Motivational? Or full volume car bangers? 🎶🚗",
                "tag_map": {},
            },
            {
                "id": "q1_4_shower_singer",
                "prompt": "Last one in this section - ask if they're a shower singer or a silent listener? 😏 After their answer, say Phase 1 done and things are about to get more interesting.",
                "tag_map": {},
            },
        ],
    },
    {
        "name": "Emotional Style",
        "phase_label": "emotions aur feelings",
        "questions": [
            {
                "id": "q2_1_upset_behavior",
                "prompt": "Start with 'Ab thoda real talk...' Ask: When they're upset, do they talk to people or go quiet?",
                "tag_map": {"quiet": "internalizer", "talk": "externalizer", "mixed": "adaptive"},
            },
            {
                "id": "q2_2_overthinking",
                "prompt": "Ask: Are they more of an overthinker or 'jo hoga dekha jayega' type?",
                "tag_map": {"overthink": "overthinker", "chill": "go_with_flow"},
            },
            {
                "id": "q2_3_anger",
                "prompt": "Ask: When anger comes, do they express it or keep it inside? After answer, say you're starting to understand them better.",
                "tag_map": {"express": "expressive_anger", "suppress": "suppressed_anger"},
            },
        ],
    },
    {
        "name": "Mindset & Energy",
        "phase_label": "personality aur energy",
        "questions": [
            {
                "id": "q3_1_morning_night",
                "prompt": "Ask: Morning person or 2 AM philosopher? 🌅🌙",
                "tag_map": {"morning": "morning_person", "night": "night_owl"},
            },
            {
                "id": "q3_2_how_others_see",
                "prompt": "Ask: How do people usually describe them? Calm? Funny? Intense? Reserved? Something else?",
                "tag_map": {},
            },
            {
                "id": "q3_3_misunderstood",
                "prompt": "Ask: One thing people get wrong about them - any misconception? Respond with empathy if they share. Then say you're getting their vibe now.",
                "tag_map": {},
            },
        ],
    },
    {
        "name": "Comfort & Safe Space",
        "phase_label": "trust aur comfort zone",
        "questions": [
            {
                "id": "q4_1_trust",
                "prompt": "Say 'going a bit deeper now, but skip is always okay 🤝'. Ask: Do they trust easily or does it take time?",
                "tag_map": {"easy": "quick_trust", "time": "slow_trust"},
            },
            {
                "id": "q4_2_passionate_topic",
                "prompt": "Ask (positive question): Any topic they could talk about for hours? Something that genuinely excites them?",
                "tag_map": {},
            },
        ],
    },
    {
        "name": "Dreams & Reality",
        "phase_label": "dreams aur decisions",
        "questions": [
            {
                "id": "q5_1_no_pressure_life",
                "prompt": "Ask: If pressure didn't exist - no family expectations, no money issues - what would they be doing in life?",
                "tag_map": {},
            },
            {
                "id": "q5_2_logic_vs_heart",
                "prompt": "Last question! Ask: Are they more logic-driven or heart-driven when making decisions?",
                "tag_map": {"logic": "logic_driven", "heart": "heart_driven", "both": "balanced_decider"},
            },
        ],
    },
]

TOTAL_PHASES = len(PHASES)

SKIP_KEYWORDS = {"skip", "next", "agle pe chalo", "chhodo", "nahi batana", "pass", "idk",
                  "don't know", "pata nahi", "kuch nahi", "whatever", "agla"}
EXIT_KEYWORDS = {"bas", "bye", "baad mein", "later", "i'll come back", "abhi nahi",
                 "goodnight", "gotta go", "chalta hoon"}


def _is_skip(text: str) -> bool:
    lower = text.lower().strip()
    return any(kw in lower for kw in SKIP_KEYWORDS)


def _is_exit(text: str) -> bool:
    lower = text.lower().strip()
    return any(kw in lower for kw in EXIT_KEYWORDS)


def _is_consent_yes(text: str) -> bool:
    lower = text.lower().strip()
    yes_words = {"haan", "sure", "okay", "chalo", "yes", "puch lo", "puchho", "yeah",
                 "ok", "ha", "theek", "thik", "acha", "achha", "ready", "go", "let's go",
                 "why not", "go ahead", "ask", "kar", "karo"}
    return any(w in lower for w in yes_words)


def _build_onboarding_system_prompt(user, phase_idx, question_idx, language):
    """Build the system prompt for the onboarding conversation."""
    nickname = user.get("name", "User")
    profile = user.get("personality_profile", {})
    answers = profile.get("answers", {})
    tags = profile.get("personality_tags", [])

    phase = PHASES[phase_idx]
    question = phase["questions"][question_idx]

    lang_instruction = f"Language: English mixed with {language} (Roman script). Sound like a real friend, not a chatbot."
    if language == "English":
        lang_instruction = "Language: Casual English. Sound like a real friend, not a chatbot."

    previous_context = ""
    if answers:
        previous_context = "What you already know about this person:\n"
        for qid, ans in answers.items():
            previous_context += f"  - {qid}: {ans}\n"
        if tags:
            previous_context += f"  - Personality traits so far: {', '.join(tags)}\n"

    return (
        f"You are RE — a warm, witty, gender-neutral conversational companion. You are NOT an AI assistant.\n"
        f"The user's name is {nickname}.\n"
        f"{lang_instruction}\n\n"
        f"You are in ONBOARDING MODE — getting to know {nickname} through casual questions.\n\n"
        f"CORE RULES:\n"
        f"1. ONE question per message. Never send multiple questions.\n"
        f"2. REACT to their answer first (short, genuine - humor/empathy/relatability) BEFORE asking the next question.\n"
        f"3. Keep reactions 1-2 sentences max. Be natural, not scripted.\n"
        f"4. If this is the first message (no prior answer to react to), just ask the question.\n"
        f"5. Never say 'your feelings are valid' or therapy-speak. Sound like a real person.\n"
        f"6. Use emojis sparingly — 1-2 max per message.\n\n"
        f"{previous_context}\n"
        f"CURRENT TASK: {question['prompt']}\n\n"
        f"IMPORTANT: Just send the conversational message. No JSON, no metadata, no system notes."
    )


def _build_closing_prompt(user, language):
    """Build the prompt for the onboarding closing message."""
    nickname = user.get("name", "User")
    profile = user.get("personality_profile", {})
    tags = profile.get("personality_tags", [])

    lang_instruction = f"Language: English mixed with {language} (Roman script)."
    if language == "English":
        lang_instruction = "Language: Casual English."

    return (
        f"You are RE. {nickname} just finished all your getting-to-know-you questions.\n"
        f"{lang_instruction}\n"
        f"Their personality tags: {', '.join(tags) if tags else 'not many collected yet'}\n\n"
        f"Now send a closing message:\n"
        f"1. Say something like 'Ok {nickname}... ab mujhe thoda idea mil raha hai tum kaun ho 😌'\n"
        f"2. Say you don't jump to conclusions but they're interesting.\n"
        f"3. Say from now on you won't give random generic advice — you'll respond based on their vibe.\n"
        f"4. End with 'Toh bolo... aaj ka mood kya hai? 😊'\n"
        f"Keep it 3-4 short messages worth of content in one message (use line breaks). Be warm and natural."
    )


async def handle_onboarding_chat(user, message_text, session_id, language):
    """
    Handle the onboarding chat flow. Returns (response_text, updated_user_fields).
    """
    user_id = user["user_id"]
    status = user.get("onboarding_chat_status", "not_started")
    phase_idx = user.get("onboarding_chat_phase", 0)
    question_idx = user.get("onboarding_chat_question", 0)
    profile = user.get("personality_profile", {})
    answers = profile.get("answers", {})
    tags = profile.get("personality_tags", [])
    skipped = profile.get("skipped", [])

    # Handle exit request
    if _is_exit(message_text):
        response = await onboarding_llm.ainvoke([
            SystemMessage(content=f"You are RE. The user wants to leave. Say something warm like 'No problem! Whenever you feel like it, I'll be here. Just say hey 😊'. Language: English mixed with {language}."),
            HumanMessage(content=message_text),
        ])
        return response.content, {
            "onboarding_chat_status": "in_progress",
            "onboarding_chat_phase": phase_idx,
            "onboarding_chat_question": question_idx,
        }

    # Phase 0 = Welcome consent
    if status == "not_started" or (phase_idx == 0 and question_idx == 0 and status != "completed"):
        if status == "not_started":
            # First time: generate the welcome + consent question
            system = _build_onboarding_system_prompt(user, 0, 0, language)
            response = await onboarding_llm.ainvoke([
                SystemMessage(content=system),
                HumanMessage(content=message_text),
            ])
            # This is the initial greeting, advance past welcome
            return response.content, {
                "onboarding_chat_status": "awaiting_consent",
                "onboarding_chat_phase": 0,
                "onboarding_chat_question": 0,
            }

    if status == "awaiting_consent":
        if _is_consent_yes(message_text):
            # User said yes — move to Phase 1, Q1
            system = _build_onboarding_system_prompt(user, 1, 0, language)
            response = await onboarding_llm.ainvoke([
                SystemMessage(content=(
                    f"You are RE. The user just agreed to your getting-to-know-you questions. "
                    f"React positively (like 'Okaaay, relax, it's not an interview... just a vibe check 😌 "
                    f"And you can skip any question, no pressure.'). Then ask the first question:\n\n"
                    f"{PHASES[1]['questions'][0]['prompt']}\n\n"
                    f"Language: English mixed with {language}. Keep it casual and warm."
                )),
                HumanMessage(content=message_text),
            ])
            return response.content, {
                "onboarding_chat_status": "in_progress",
                "onboarding_chat_phase": 1,
                "onboarding_chat_question": 0,
            }
        else:
            # User said no — respect that
            response = await onboarding_llm.ainvoke([
                SystemMessage(content=f"You are RE. The user doesn't want to do the questions right now. Say something warm like 'No worries at all! Whenever you feel like it, I'm here. Just say hey 😊'. Language: English mixed with {language}."),
                HumanMessage(content=message_text),
            ])
            return response.content, {
                "onboarding_chat_status": "not_started",
            }

    # In progress — handle the current question
    if status == "in_progress":
        phase = PHASES[phase_idx]
        question = phase["questions"][question_idx]

        # Store the answer
        is_skipped = _is_skip(message_text)
        if is_skipped:
            skipped.append(question["id"])
        else:
            answers[question["id"]] = message_text
            # Try to extract personality tags from tag_map
            tag_map = question.get("tag_map", {})
            if tag_map:
                lower = message_text.lower()
                for keyword, tag in tag_map.items():
                    if keyword in lower and tag not in tags:
                        tags.append(tag)

        # Advance to next question
        next_q = question_idx + 1
        next_p = phase_idx

        if next_q >= len(PHASES[phase_idx]["questions"]):
            # Move to next phase
            next_p = phase_idx + 1
            next_q = 0

        updated_profile = {"answers": answers, "personality_tags": tags, "skipped": skipped}

        if next_p >= TOTAL_PHASES:
            # Onboarding complete! Generate closing message
            system = _build_closing_prompt(user, language)
            history_rows = await get_history(session_id)
            history_msgs = []
            for row in history_rows[-6:]:
                if row.get("role") == "user":
                    history_msgs.append(HumanMessage(content=row["content"]))
                else:
                    history_msgs.append(AIMessage(content=row["content"]))

            response = await onboarding_llm.ainvoke(
                [SystemMessage(content=system)] + history_msgs + [HumanMessage(content=message_text)]
            )
            return response.content, {
                "onboarding_chat_status": "completed",
                "onboarding_chat_phase": next_p,
                "onboarding_chat_question": next_q,
                "personality_profile": updated_profile,
            }

        # Generate response: react to answer + ask next question
        next_phase = PHASES[next_p]
        next_question = next_phase["questions"][next_q]

        # Include phase transition message if entering a new phase
        phase_transition = ""
        if next_p != phase_idx:
            phase_transition = f"\nYou're moving to a new section. Briefly acknowledge the transition (e.g. 'Nice, now let's go a bit deeper...').\n"

        system = (
            f"You are RE — warm, witty, gender-neutral companion. User's name: {user.get('name', 'User')}.\n"
            f"Language: English mixed with {language} (Roman script). Sound like a real friend.\n\n"
        )

        if is_skipped:
            system += f"The user skipped the previous question. React gracefully (e.g. 'All good, let's move on').\n"
        else:
            system += f"The user just answered: \"{message_text}\"\nReact genuinely to their answer first (1-2 sentences, empathy/humor/relatability).\n"

        system += f"{phase_transition}\nThen ask the next question:\n{next_question['prompt']}\n\n"
        system += "RULES: One question only. React before asking. No therapy-speak. Max 3-4 sentences total."

        history_rows = await get_history(session_id)
        history_msgs = []
        for row in history_rows[-6:]:
            if row.get("role") == "user":
                history_msgs.append(HumanMessage(content=row["content"]))
            else:
                history_msgs.append(AIMessage(content=row["content"]))

        response = await onboarding_llm.ainvoke(
            [SystemMessage(content=system)] + history_msgs + [HumanMessage(content=message_text)]
        )

        return response.content, {
            "onboarding_chat_status": "in_progress",
            "onboarding_chat_phase": next_p,
            "onboarding_chat_question": next_q,
            "personality_profile": updated_profile,
        }

    # Fallback
    return None, {}


def get_onboarding_welcome_messages(user):
    """Return initial messages for a user who hasn't started onboarding chat."""
    nickname = user.get("name", "User")
    status = user.get("onboarding_chat_status", "not_started")

    if status == "completed":
        return [
            {"role": "ai", "content": f"Hey {nickname}! Aaj ka mood kya hai? 😊", "mode": "AUTO"}
        ]

    if status == "in_progress" or status == "awaiting_consent":
        return [
            {"role": "ai", "content": f"Hey {nickname}! Wapas aa gaye 😊 Chalo continue karte hain?", "mode": "AUTO"}
        ]

    return [
        {"role": "ai", "content": f"Hey {nickname}! 👋", "mode": "AUTO"},
    ]
