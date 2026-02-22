# ReVent — Product Requirements Document

## Original Problem Statement
Complete a 90% finished AI emotional companion app called **ReVent**. The AI companion is named **RE**. Make it fully responsive, integrate Gemini AI, implement coin economics, and match the "Gradient Glass" design system.

## User Personas
- **Primary**: Young adults (18-30) who need to vent emotionally in a private, non-judgmental space
- **Secondary**: Beta testers exploring AI companionship

## Core Requirements

### Task 1 — Responsive UI
- Full-screen layout on desktop (no mobile container)
- Desktop: sidebar (240px) + main chat (fills remaining)
- Mobile: full-screen chat interface
- Fonts: Outfit (headings) + DM Sans (body)
- Design: "Gradient Glass" — dark navy/purple with glass cards

### Task 2 — Production Readiness
- FastAPI + MongoDB backend
- Gemini 2.5 Flash model
- LangGraph state machine for AI routing
- Pending: rate limiting, security headers audit

### Task 3 — AI Integration
- Gemini 2.5 Flash via Google Generative AI
- LangGraph state machine with emotional routing
- Modes: AUTO, HEAR_ME, BACK_ME, BE_REAL, VAULT, GOSSIP, CRISIS

### Task 4 — Coin Economics & Onboarding
- 2,000 coins on signup (beta tester)
- Beta Welcome Modal with animated coin counter
- Coin deduction after 10 exchanges

### Task 5 — UX Flow
- Flow: Splash (unauthenticated) → Auth → Onboarding (3 slides) → Name → Language → Chat
- Authenticated users skip splash, go directly to chat
- Loading screen while auth check in progress

### Task 6 — Character System
- RE is the default companion (always present)
- Max 3 user-created custom personas via Character Creator
- Each persona: base role, traits (up to 4), energy level, quirks, backstory
- Characters persist in MongoDB, appear in sidebar/tab strip
- Delete button on each character, Create button hidden at max 3

### Task 7 — Onboarding Chatbot Flow (NEW)
- 5-phase conversational personality discovery for new users in RE mode only
- NOT for gossip mode or custom characters
- Phases: Welcome/Consent → Movies/Music → Emotional Style → Mindset/Energy → Trust/Safe Space → Dreams/Reality
- One question at a time, react before asking next
- Skip/exit handling, session persistence (resume from where user left off)
- Personality tags extracted from answers (e.g. analytical_mind, overthinker, etc.)
- Profile saved in user document, used subtly in future AI responses (not every message)

## User Flow
`Splash → Auth → Onboarding slides → Name → Language → Chat (onboarding chatbot for new RE users) → Regular Chat`

## Architecture

### Frontend
- React 18 + Vite + Tailwind CSS
- Framer Motion animations
- Three.js / @react-three/fiber (3D avatar in Character Creator)

### Backend
- FastAPI + Motor (async MongoDB)
- LangGraph state machine (graph.py)
- Google Gemini 2.5 Flash
- Onboarding chat flow (onboarding_chat.py)

### Database (MongoDB: `revent`)
- **users**: user_id, email, password_hash, name, language, coins, is_first_login, onboarding_complete, onboarding_chat_status, onboarding_chat_phase, onboarding_chat_question, personality_profile, google_id, created_at
- **characters**: character_id, user_id, base_role, traits, energy, quirks, memory_hook, label, created_at
- **user_sessions**: session_token, user_id, expires_at, created_at
- **chat_history**: session_id, user_id, role, content, mode, timestamp
- **exchange_counters**: session_id, user_id, count, created_at

## Key API Endpoints
- `POST /api/auth/register` — signup (awards 2000 coins)
- `POST /api/auth/login` — login
- `GET /api/auth/me` — get current user (includes personality_profile)
- `POST /api/auth/logout`
- `GET /api/auth/google-session` — OAuth callback
- `POST /api/auth/mark-first-login` — clears first-login flag
- `POST /api/user/update-profile` — update name/language/onboarding
- `POST /api/chat` — send message (auto-detects onboarding mode for new RE users)
- `GET /api/chat/welcome` — personalized welcome messages based on onboarding status
- `POST /api/refine-backstory` — AI backstory refinement
- `POST /api/characters` — create character (max 3)
- `GET /api/characters` — list user's characters
- `DELETE /api/characters/{character_id}` — delete character
- `GET /api/health` — health check

## Environment
- Frontend: `REACT_APP_BACKEND_URL`
- Backend: `MONGO_URL`, `DB_NAME`, `GOOGLE_API_KEY`

## Prioritized Backlog

### P0 (Critical — Next)
- Onboarding content finalization (waiting for user's custom assets/HTML from Stitch)
- Production readiness audit: rate limiting, security headers, CORS tightening

### P1 (High)
- Chat history persistence (page refresh clears chat)
- Test all AI emotional modes end-to-end
- Safety-net logic for distressed users

### P2 (Medium)
- Payment integration for coin packs
- Push notifications / PWA
- Component file splitting (App.jsx is 1400+ lines)

### P3 (Low / Backlog)
- Analytics dashboard
- Multiple language prompting refinement
- Voice messages
