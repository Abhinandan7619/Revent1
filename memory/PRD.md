# ReVent — Product Requirements Document

## Original Problem Statement
Complete a 90% finished AI emotional companion app called **ReVent**. The AI companion is named **RE**. Fully responsive, Gemini AI, coin economics, "Gradient Glass" design.

## User Flow
`Splash (unauthenticated only) → Auth → Onboarding (3 slides) → Name → Language → Chat (auto-triggers onboarding chatbot for new RE users) → Regular Chat`

## Architecture
- **Frontend**: React 18 + Vite + Tailwind + Framer Motion + Three.js
- **Backend**: FastAPI + Motor (MongoDB) + LangGraph + Google Gemini 2.5 Flash
- **Database**: MongoDB (`revent`)
- **Environment**: Kubernetes with NGINX Ingress (requires special handling for HMR/WebSocket)

## Key Collections
- **users**: user_id, email, name, language, coins, onboarding_complete, onboarding_chat_status/phase/question, personality_profile
- **characters**: character_id, user_id, base_role, traits, energy, quirks, memory_hook, label
- **chat_sessions**: session_id, user_id, vibe_id, title, created_at, updated_at
- **chat_history**: session_id, user_id, role, content, mode, timestamp
- **user_sessions**: session_token, user_id, expires_at
- **exchange_counters**: session_id, user_id, count

## Key API Endpoints
- Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- Chat: `POST /api/chat`, `GET /api/chat/welcome`, `GET /api/chat/sessions`, `POST /api/chat/sessions`, `GET /api/chat/history/{session_id}`, `DELETE /api/chat/sessions/{session_id}`, `PATCH /api/chat/sessions/{session_id}`
- Characters: `POST /api/characters`, `GET /api/characters`, `DELETE /api/characters/{id}`
- User: `POST /api/user/update-profile`

## What's Implemented
- Full responsive UI with Gradient Glass design (sidebar desktop, full-screen mobile)
- Auth (email/password + Google OAuth ready)
- Gemini 2.5 Flash integration with LangGraph emotional routing
- 5-phase onboarding chatbot (personality discovery, auto-triggered)
- Coin system (2000 on signup, deduction after 10 exchanges)
- **Clan system** (renamed from "Persona" — max 3 custom clans, 5-step wizard creator, delete from sidebar)
- Chat history persistence (RE mode + character mode, loaded from DB on mount)
- Session management (New Chat in RE mode, 2-session limit per vibe, rename/delete sessions)
- Gossip mode (no history, no logs)
- SessionStorage persistence (survives page reloads, no splash redirect for auth users)
- Personality profile used subtly in AI responses

## Recent Changes (Feb 24, 2026)

### "Clan Creator" Overhaul
- **Renamed "Persona" to "Clan"** throughout the application
- Updated sidebar section header from "Companions" to "Clans"
- Updated "Create Persona" button to "Create Clan"
- Updated onboarding slide 3 to say "Create your own clans" and "3 custom clans"
- Updated all Clan Creator wizard text to use "clan" terminology
- No backend changes required (API still uses `characters` collection internally)

## Bug Fixes Log (Feb 2026)

### Fixed: Layout Shifting / Content Cut Off (Feb 23, 2026)
- **Problem**: App content was shifted up by ~135px, causing headers to be cut off at the top and empty space at the bottom
- **Root Cause**: `scrollIntoView()` calls in chat scroll effects were scrolling the parent `#app-root` container instead of just the message area
- **Solution**: 
  1. Changed from `scrollRef.current?.scrollIntoView()` to manually setting `parent.scrollTop = parent.scrollHeight`
  2. This ensures only the messages container scrolls, not the app root
- **Files**: `/app/frontend/src/App.jsx` (lines ~1211-1224)

### Fixed: Auto-Reload Issue
- **Problem**: Page auto-reloaded every 1-2 minutes due to Vite HMR WebSocket timing out in K8s ingress
- **Solution**: 
  1. Disabled HMR in vite.config.js (`hmr: false, watch: { ignored: ['**/*'] }`)
  2. Added WebSocket error suppression in index.html
- **Files**: `/app/frontend/vite.config.js`, `/app/frontend/index.html`

### Fixed: Empty Chat After Login
- **Problem**: Returning users saw empty chat screen after login
- **Solution**: `handleAuth()` in App.jsx loads chat sessions and welcome messages for users with `onboarding_complete: true`
- **File**: `/app/frontend/src/App.jsx` (handleAuth function)

## Prioritized Backlog

### P0 (Critical — Next)
- Onboarding content finalization (waiting for user's custom Stitch assets)
- Production readiness audit: rate limiting, security headers, CORS

### P1 (High)
- Test all AI emotional modes end-to-end (Back Me, Be Real, Hear Me, Gossip)
- Safety-net logic for distressed users
- Payment integration for purchasing more coins

### P2 (Medium)
- PWA / push notifications
- Component file splitting (App.jsx ~1500 lines for better maintainability)
- Full production deployment preparation

### P3 (Backlog)
- Analytics dashboard
- Multi-language prompting refinement
- Voice messages

## Test Credentials
- **Returning user**: `returning@test.com` / `test123` (onboarding_complete=true)
- **New user**: Register with any email/password
