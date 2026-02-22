# ReVent — Product Requirements Document

## Original Problem Statement
Complete a 90% finished AI emotional companion app called **ReVent**. The AI companion is named **RE**. Make it fully responsive, integrate Gemini AI, implement coin economics, and match the "Gradient Glass" design system.

## User Personas
- **Primary**: Young adults (18-30) who need to vent emotionally in a private, non-judgmental space
- **Secondary**: Beta testers exploring AI companionship

## Core Requirements (from user)

### Task 1 — Responsive UI
- ✅ Full-screen layout on desktop (no mobile container)
- ✅ Desktop: sidebar (240px) + main chat (fills remaining)
- ✅ Mobile: full-screen chat interface
- ✅ Fonts: Outfit (headings) + DM Sans (body)
- ✅ Design: "Gradient Glass" — dark navy/purple with glass cards

### Task 2 — Production Readiness
- ✅ FastAPI + MongoDB backend
- ✅ Motor/pymongo version fixed (4.9.2 compatible)
- ✅ Gemini 2.5 Flash model (updated from unavailable 2.0-flash)
- ✅ LangGraph state machine for AI routing
- Pending: rate limiting, security headers audit

### Task 3 — AI Integration
- ✅ Gemini 2.5 Flash via Google Generative AI
- ✅ LangGraph state machine with emotional routing
- ✅ Modes: AUTO, HEAR_ME, BACK_ME, BE_REAL, VAULT, GOSSIP, CRISIS

### Task 4 — Coin Economics & Onboarding
- ✅ 2,000 coins on signup (beta tester)
- ✅ Beta Welcome Modal with animated coin counter
- ✅ Coin badge real-time update on messages
- ✅ Settings: coin pack recharge UI (payment deferred)

### Task 5 — UX Flow (User-Requested)
- ✅ Land directly on chat (not home screen with cards)
- ✅ Pre-generated welcome message: "Hey. You showed up — that already took something. 💜\n\nThis is your space. Say whatever. I'm not going anywhere."
- ✅ Emotion bar with 7 emojis (auto-switches modes)
- ✅ Floating GOSSIP MODE button (bottom-right)
- ✅ Character tabs in header (RE, Vibe 1, Shadow, Logic, + Create)
- ✅ Onboarding with 3D AI-generated images

## User Flow
`Auth → Splash → Onboarding (3 slides) → Name → Language → Chat (main) ↔ Gossip / Creator / Settings`

## Architecture

### Frontend
- React 18 + Vite 8 + Tailwind CSS
- Framer Motion animations
- Three.js / @react-three/fiber (3D avatar)
- All components in single App.jsx (~1578 lines)

### Backend
- FastAPI + Motor (async MongoDB)
- LangGraph state machine (graph.py)
- Google Gemini 2.5 Flash (via emergentintegrations)

### Database (MongoDB: `revent`)
- **users**: id, username, email, hashed_password, coins (default 2000), is_beta_tester, is_first_login, onboarding_complete, language, created_at
- **sessions**: Google OAuth sessions

## Key API Endpoints
- `POST /api/auth/register` — signup (awards 2000 coins)
- `POST /api/auth/login` — login
- `GET /api/auth/me` — get current user
- `POST /api/auth/logout`
- `GET /api/auth/google-session` — OAuth callback
- `POST /api/auth/mark-first-login` — clears first-login flag
- `POST /api/user/update-profile` — update name/language/onboarding
- `POST /api/chat` — send message to RE (main chat + gossip)
- `POST /api/refine-backstory` — AI backstory refinement for character creator
- `GET /api/health` — health check

## Preset Vibes (Character System)
- **RE** (default): Base RE companion
- **Vibe 1**: Close Cousin, soft/empathetic, energy 35%
- **Shadow**: Blunt Senior, sarcastic/savage, energy 80%
- **Logic**: Office Bro, wise/brutally honest, energy 55%
- **Custom**: Via character creator (saved as `myCharacter` state)

## Environment
- Frontend: `REACT_APP_BACKEND_URL`
- Backend: `MONGO_URL`, `DB_NAME`, `GOOGLE_API_KEY`
- Vite config: `allowedHosts: true`, `envPrefix: ['VITE_', 'REACT_APP_']`

## Implemented (Changelog)

### Session 1 (Feb 22, 2026)
- Cloned repo, explored codebase
- Full rewrite of frontend + backend
- Fixed startup issues (motor/pymongo, vite host, start script)
- Implemented full responsive layout with desktop sidebar
- Added welcome message, emotion bar, gossip floating button
- Added character tab strip with 4 preset vibes
- Updated onboarding with AI-generated 3D images
- Fixed Gemini model (2.0-flash → 2.5-flash, not available to new users)
- All 22 backend tests passing, all frontend flows verified

## Prioritized Backlog

### P0 (Critical — Next Session)
- Payment integration for coin packs (deferred by user)
- Rate limiting on /api/chat

### P1 (High)
- Chat history persistence (currently in-memory only — page refresh clears chat)
- Production deployment preparation
- Security headers (CORS is permissive)

### P2 (Medium)
- More character presets
- Onboarding skip → directly show character creator for power users
- Push notifications / PWA

### P3 (Low / Backlog)
- Analytics dashboard
- User-reported issues
- Multiple language prompting refinement
- Voice messages (OpenAI Whisper)
