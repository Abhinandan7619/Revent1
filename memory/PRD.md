# ReVent — Product Requirements Document

## Original Problem Statement
Complete a 90% finished AI emotional companion app called **ReVent**. The AI companion is named **RE**. Fully responsive, Gemini AI, coin economics, "Gradient Glass" design.

## User Flow
`Splash (unauthenticated only) → Auth → Onboarding (3 slides) → Name → Language → Chat (auto-triggers onboarding chatbot for new RE users) → Regular Chat`

## Architecture
- **Frontend**: React 18 + Vite + Tailwind + Framer Motion + Three.js
- **Backend**: FastAPI + Motor (MongoDB) + LangGraph + Google Gemini 2.5 Flash
- **Database**: MongoDB (`revent`)

## Key Collections
- **users**: user_id, email, name, language, coins, onboarding_complete, onboarding_chat_status/phase/question, personality_profile
- **characters**: character_id, user_id, base_role, traits, energy, quirks, memory_hook, label
- **chat_sessions**: session_id, user_id, vibe_id, title, created_at, updated_at
- **chat_history**: session_id, user_id, role, content, mode, timestamp
- **user_sessions**: session_token, user_id, expires_at
- **exchange_counters**: session_id, user_id, count

## Key API Endpoints
- Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- Chat: `POST /api/chat`, `GET /api/chat/welcome`, `GET /api/chat/sessions`, `POST /api/chat/sessions`, `GET /api/chat/history/{session_id}`
- Characters: `POST /api/characters`, `GET /api/characters`, `DELETE /api/characters/{id}`
- User: `POST /api/user/update-profile`

## What's Implemented
- Full responsive UI with Gradient Glass design (sidebar desktop, full-screen mobile)
- Auth (email/password + Google OAuth ready)
- Gemini 2.5 Flash integration with LangGraph emotional routing
- 5-phase onboarding chatbot (personality discovery, auto-triggered)
- Coin system (2000 on signup, deduction after 10 exchanges)
- Character system (max 3 custom personas, CRUD with DB persistence)
- Chat history persistence (RE mode + character mode, loaded from DB on mount)
- Session management (New Chat in RE mode, single session in character mode)
- Gossip mode (no history, no logs)
- SessionStorage persistence (survives page reloads, no splash redirect for auth users)
- Personality profile used subtly in AI responses

## Prioritized Backlog

### P0 (Critical — Next)
- Onboarding content finalization (waiting for user's custom Stitch assets)
- Production readiness audit: rate limiting, security headers, CORS

### P1 (High)
- Test all AI emotional modes end-to-end
- Safety-net logic for distressed users

### P2 (Medium)
- Payment integration for coin packs
- PWA / push notifications
- Component file splitting (App.jsx ~1500 lines)

### P3 (Backlog)
- Analytics dashboard
- Multi-language prompting refinement
- Voice messages
