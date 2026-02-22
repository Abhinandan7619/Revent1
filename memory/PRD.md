# ReVent — Product Requirements Document

## Original Problem Statement
Complete a 90% finished AI emotional companion app called **ReVent**. The AI companion is named **RE**. Make it fully responsive, integrate Gemini AI, implement coin economics, and match the "Gradient Glass" design system.

## User Personas
- **Primary**: Young adults (18-30) who need to vent emotionally in a private, non-judgmental space
- **Secondary**: Beta testers exploring AI companionship

## Core Requirements (from user)

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
- Coin badge real-time update on messages

### Task 5 — UX Flow
- Flow: Splash → Auth → Onboarding (3 slides) → Name → Language → Chat
- Pre-generated welcome message
- Emotion bar with 7 emojis (auto-switches modes)
- Floating GOSSIP MODE button
- Onboarding text-only (no images until user provides custom assets)

### Task 6 — Character System (NEW)
- RE is the default companion (always present)
- Users can create up to 3 custom personas via Character Creator
- Each persona has: base role, traits (up to 4), energy level, quirks, backstory, label
- Characters persist in database (MongoDB `characters` collection)
- Characters appear in sidebar (desktop) and tab strip (mobile)
- Delete button on each character in sidebar
- Create Persona button hidden when 3 characters exist
- Onboarding slide 3 explains the character creation system

## User Flow
`Splash → Auth → Onboarding (3 slides) → Name → Language → Chat (main) ↔ Gossip / Creator / Settings`

## Architecture

### Frontend
- React 18 + Vite + Tailwind CSS
- Framer Motion animations
- Three.js / @react-three/fiber (3D avatar in Character Creator)
- All components in single App.jsx

### Backend
- FastAPI + Motor (async MongoDB)
- LangGraph state machine (graph.py)
- Google Gemini 2.5 Flash (via emergentintegrations)

### Database (MongoDB: `revent`)
- **users**: user_id, email, password_hash, name, language, coins, is_first_login, onboarding_complete, google_id, created_at
- **characters**: character_id, user_id, base_role, traits, energy, quirks, memory_hook, label, created_at
- **user_sessions**: session_token, user_id, expires_at, created_at
- **chat_history**: session_id, user_id, role, content, mode, timestamp
- **exchange_counters**: session_id, user_id, count, created_at

## Key API Endpoints
- `POST /api/auth/register` — signup (awards 2000 coins)
- `POST /api/auth/login` — login
- `GET /api/auth/me` — get current user
- `POST /api/auth/logout`
- `GET /api/auth/google-session` — OAuth callback
- `POST /api/auth/mark-first-login` — clears first-login flag
- `POST /api/user/update-profile` — update name/language/onboarding
- `POST /api/chat` — send message to RE (main chat + gossip)
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
- Chat history persistence (currently in-memory only — page refresh clears chat)
- Test all AI emotional modes (Back Me, Be Real, Hear Me, Gossip)
- Safety-net logic for distressed users
- Production deployment preparation

### P2 (Medium)
- Payment integration for coin packs
- Push notifications / PWA
- Component file splitting (App.jsx is 1500+ lines)

### P3 (Low / Backlog)
- Analytics dashboard
- Multiple language prompting refinement
- Voice messages (OpenAI Whisper)
