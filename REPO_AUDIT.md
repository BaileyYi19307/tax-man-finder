# Tax Man Finder — Repository Audit

**Date:** 2026-07-14  
**Scope:** Full read-only audit of `/Users/byi/tax-man-finder`  
**Method:** Code inspection, config verification, migration status, local run attempts, and cross-check of frontend ↔ backend routes. No application code was changed.

---

## Concise summary of current state

**Tax Man Finder** is a marketplace for finding and offering accounting services. The **backend is substantially further along than the frontend**: Django + DRF + JWT auth, services CRUD, inquiry-based messaging (HTTP + WebSockets), bookings, and accountant profiles exist. The **frontend is an early CRA prototype** with real pages for login/signup, services, chat, bookings, and dashboards — but several API calls do not match the backend, URLs are hardcoded to `127.0.0.1:8000`, and there is no solid auth/routing shell.

**Right now the project does not run reliably out of the box.** `backend/.env` sets `ENV=production` with a broken Postgres host (`DB_HOST=db#change to db`), so normal `manage.py` DB commands fail. With `ENV` unset/development, SQLite works and migrations appear applied. Redis is available locally (needed for chat). Docker Compose is incomplete/broken. Docs under `docs/` are early planning notes and partly outdated.

**Bottom line:** Treat this as a promising mid-stage backend with a fragile local setup and a mismatched prototype UI. Stabilize run/config and fix backend correctness bugs before investing heavily in frontend polish.

---

## 1. What the application is intended to do

Confirmed from `README.md`, `docs/user-flows.md`, `docs/roadmap.md`, and implemented models/routes:

- Clients browse accountant **services**, message accountants via **inquiries/chat**, and request **bookings**.
- Accountants sign up with a profile, list services, respond to inquiries, and manage bookings.
- Auth is email/password with **email verification** and **JWT** tokens.
- Later roadmap (not built): payments (Stripe), reviews/ratings, admin moderation, rich chat features (read receipts beyond basic unread, online status, media, E2E encryption).

---

## 2. Current architecture and major technologies

```
Browser (React CRA :3000)
    │  HTTP REST (axios/fetch) + WebSocket
    ▼
Django / Daphne ASGI (:8000)
    ├── DRF + SimpleJWT
    ├── Apps: users, accountants, services, bookings, inquiries, chats
    ├── Channels → Redis channel layer
    └── DB: SQLite (non-production) OR Postgres (ENV=production)
```

| Layer | Technology | Evidence |
|-------|------------|----------|
| Backend framework | Django 4.2.28 | `backend/requirements.txt` |
| API | Django REST Framework 3.16 | `config/settings.py`, app views |
| Auth | SimpleJWT | `REST_FRAMEWORK`, `users/views.py` Login |
| Realtime | Django Channels + Redis + Daphne | `CHANNEL_LAYERS`, `chats/consumers.py` |
| Frontend | Create React App (react-scripts 5), React 18, react-router-dom 6 | `frontend/taxmanfinder/package.json` |
| HTTP client | axios + fetch (mixed) | frontend pages |
| Local DB | SQLite `backend/db.sqlite3` when `ENV != production` | `config/settings.py` |
| Prod DB (intended) | PostgreSQL | `settings.py` + `compose.yaml` (broken) |
| Email | SMTP (Gmail defaults) | `settings.py`, `users/utils.py` |

---

## 3. Purpose of major directories, services, and important files

| Path | Purpose |
|------|---------|
| `backend/` | Django project root |
| `backend/config/` | Settings, root URLs, ASGI/WSGI |
| `backend/users/` | Custom User model, signup/login/verify, JWT, dashboards |
| `backend/accountants/` | `AccountantProfile` + profile completeness checks |
| `backend/services/` | Service listings (CRUD ViewSet) |
| `backend/bookings/` | Booking model + ViewSet (partially correct) |
| `backend/inquiries/` | Inquiry + unread/read-state; HTTP message send |
| `backend/chats/` | `Message` model + WebSocket consumer (HTTP urls empty) |
| `backend/api/` | Placeholder “Hello world” index only |
| `backend/listings/` | Abandoned scaffold — **not** in `INSTALLED_APPS` |
| `backend/manage.py` | Django CLI entry |
| `backend/requirements.txt` | Python dependencies |
| `backend/Dockerfile` | Backend image (dev `runserver`, not production-grade) |
| `backend/.env` | Local secrets/config (**gitignored**; present on disk) |
| `backend/db.sqlite3` | Local SQLite DB with real tables |
| `frontend/taxmanfinder/` | React app |
| `frontend/taxmanfinder/src/pages/` | Screens (auth, services, chat, bookings, dashboards) |
| `frontend/taxmanfinder/src/components/` | Chat message UI |
| `frontend/taxmanfinder/src/hooks/hooks/useChatSocket.tsx` | WebSocket hook (odd nested path) |
| `docs/` | Planning docs (incomplete / stale) |
| `compose.yaml` | Intended Docker Compose — **broken/incomplete** |
| `requirements.txt` (repo root) | Unrelated tiny requests pin set — not the real backend deps |
| `backend/RECOVERY_PLAN.md` | Empty placeholder |

---

## 4. Backend functionality — by status

### Confirmed functionality (implemented in code; migrations present)

| Feature | Evidence |
|---------|----------|
| Custom email-based User model (`is_accountant`, `is_verified`, etc.) | `users/models.py`, migration `users/0001_initial` |
| Signup with role → optional `AccountantProfile` | `SignupSerializer`, `POST /users/auth/signup/` |
| Email verification token + redirect to frontend login | `users/utils.py`, `VerifyEmail` |
| Login returns JWT access + refresh; blocks unverified users | `Login` view + `LoginSerializer` |
| Token refresh endpoint | `POST /users/auth/refresh/` |
| `GET /users/me/` | `MeView` |
| Service list/retrieve public; create/update/destroy intended for accountants | `ServicesViewSet` |
| Inquiry create/list (unique per client+service), detail + messages | `inquiries/views.py`, migrations through `0004` |
| Mark inquiry read | `POST .../mark-read/` + `ConversationReadState` |
| WebSocket chat on inquiry | `ws/inquiries/<id>/`, `ChatConsumer` |
| Booking model + authenticated list/retrieve via ViewSet | `bookings/models.py`, `BookingsViewSet` |
| Django system check passes (when settings load) | `manage.py check` with `ENV=development` |
| SQLite schema exists for core tables | `sqlite3 .tables` shows users, services, inquiries, messages, bookings, etc. |

### Partially implemented / broken

| Issue | Why | Files |
|-------|-----|-------|
| `IsAccountant` unfinished | SAFE methods always allowed; write path returns `None` (denies everyone, including accountants) | `users/permissions.py` |
| Service create/update/destroy blocked | Depends on broken `IsAccountant` | `services/views.py` |
| Accountant dashboard permission wrong | Any authenticated user can GET (SAFE method → True) | `users/views.py` + `users/permissions.py` |
| Booking create via ViewSet | `perform_create` sets only `user`, not `accountant` → NOT NULL failure | `bookings/views.py` |
| Better booking create logic exists but unwired | `BookingCreation` sets accountant from service, but **not in urls** | `bookings/views.py`, `bookings/urls.py` |
| `AccountantProfile.has_services` | Uses `self.services` — relation is on `User`, not profile | `accountants/models.py` |
| `InquirySerializer.accountant_name` | `source="accountant.user.email"` but `accountant` **is** a User | `inquiries/serializers.py` |
| Inquiry status lifecycle | Field exists (`open/responded/booked/closed`) but never updated | `inquiries/models.py`, views |
| Profile completeness | Logic partially wrong; `profile_complete` field not clearly driven | `accountants/models.py` |
| Email verification error response | Malformed `{"error:", e}` | `users/views.py` |
| ASGI WebSocket security | `AllowedHostsOriginValidator` / `AuthMiddlewareStack` commented out | `config/asgi.py` |
| Dual message paths | HTTP `SendMessageView` and WS consumer both create messages | `inquiries/views.py`, `chats/consumers.py` |
| Tests unreliable / hanging | Signup hits real SMTP (`fail_silently=False`); settings `TEST.NAME` points at live sqlite; some tests wrong | `users/utils.py`, `settings.py`, various tests |
| Duplicate route entry points | Signup at `""` and `auth/signup/`; accountant create at `""` and `create/` | `users/urls.py`, `accountants/urls.py` |

### Missing functionality

| Gap | Notes |
|-----|-------|
| Payments / Stripe | Roadmap only (`docs/roadmap.md`) |
| Reviews / ratings | Not present |
| Public accountant directory beyond services list | No dedicated browse/search API |
| Accountant profile update API | Create + status only; no proper update/me profile |
| Conversation model as in docs | Docs describe Conversation 1:1 Inquiry; code uses Inquiry + Message directly |
| Logout / token blacklist | Refresh exists; no logout/blacklist flow |
| `.env.example` | Missing (comment in `.env` even asks for one) |
| Working Docker Compose / production deploy | `compose.yaml` invalid |
| Admin registration for most models | Only User + Booking registered |
| Meaningful tests for inquiries/services/chats | Empty or Selenium leftovers |

### Uncertain (could not fully prove at runtime)

| Item | Uncertainty |
|------|-------------|
| End-to-end signup → email → verify → login | Depends on valid Gmail SMTP credentials in `.env`; not exercised successfully here |
| Live WebSocket chat with Redis | Redis responds `PONG`, but full WS session not manually verified this audit |
| Whether existing SQLite data is coherent/demo-ready | Tables exist; data quality unknown |
| Whether `ENV=production` was intentional | Host value `db#change to db` looks like a leftover note, not a real hostname |

---

## 5. Frontend functionality — by status

### Confirmed (real UI wired to *some* API)

| Page / feature | File | Notes |
|----------------|------|-------|
| Login | `pages/auth/Login.tsx` | Stores tokens + `user_id`; matches backend login shape |
| Signup | `pages/auth/Signup.tsx` | Role accountant/client; redirects to login |
| Services list | `pages/services/ServicesList.tsx` | `GET /services/` |
| Service detail | `pages/services/ServiceDetail.tsx` | Loads service; contact + booking UI present |
| Client dashboard | `pages/dashboard/ClientDashboard.tsx` | Nav hub (mostly links, little API) |
| Chat layout + inbox | `pages/chat/ChatLayout/*` | `GET /api/inquiries/` |
| Conversation + WS | `ConversationView.tsx` + `useChatSocket.tsx` | Matches inquiry WS path |
| Bookings list/delete | `pages/bookings/BookingsPage.tsx` | Partially wired |

### Partially implemented / broken frontend

| Issue | Evidence |
|-------|----------|
| After “Message accountant”, navigates with `data.conversation_id` | Backend returns `inquiry_id` → chat navigation broken (`ServiceDetail.tsx`) |
| Booking create posts to `/bookings/create/` | Backend ViewSet create is `POST /bookings/` |
| Accountant dashboard fetches `/api/conversations/` | **No such backend route** |
| Bookings PATCH passes headers as body | Wrong axios signature |
| DELETE booking missing trailing slash | May 404 depending on Django slash handling |
| Login always sends user to client dashboard | Ignores accountant role |
| No route guards / logout / refresh usage | Tokens in localStorage only |
| Home page unused | `Home.tsx` stub; catch-all `*` → Login |
| Tailwind declared but not set up for CRA | `@tailwindcss/vite` unused |

### Missing frontend

- Polished public homepage / marketing
- Accountant onboarding (complete profile, add services) UI
- Auth-aware protected routes
- Env-based API base URL
- Role-based post-login routing
- Booking edit/view flows (buttons unwired)

---

## 6. Partially implemented, broken, duplicated, unused, abandoned

| Item | Classification |
|------|----------------|
| `listings/` app | Abandoned scaffold |
| `api/` Hello world | Placeholder |
| `chats/urls.py`, `chats/views.py`, `chats/permissions.py` | Empty / unused HTTP layer |
| `BookingCreation`, `MyBookingsView` | Dead code (not routed) |
| Duplicate signup/accountant-create URLs | Duplication |
| Root `requirements.txt` | Unused/misleading vs `backend/requirements.txt` |
| `compose.yaml` | Broken / abandoned draft |
| `docs/onboarding.md`, `backend/RECOVERY_PLAN.md` | Empty |
| `docs/roadmap.md` / `data-models.md` | Stale vs code |
| Frontend `Home.tsx`, CRA logo, commented chat mock code | Unused |
| Two Python venvs (`.venv` 3.12 and `venv` 3.14) | Confusing duplication |
| `db.sqlite` (empty) vs `db.sqlite3` | Leftover |

---

## 7. Database, auth, API routes, env vars, external services

### Database

- **Non-production:** SQLite at `backend/db.sqlite3` when `ENV != "production"` (`config/settings.py`).
- **Production path:** Postgres via `DB_NAME/USER/PASSWORD/HOST/PORT`.
- **Current blocker:** `.env` has `ENV=production` and `DB_HOST=db#change to db` → connection fails.
- **Migrations:** Present and applied in SQLite for users, accountants, services, bookings, inquiries, chats (verified with `ENV=development showmigrations`).
- **Note:** `DATABASE_URL` exists in `.env` but is **not read** by settings (only discrete `DB_*` vars).

### Authentication

1. Signup → user created unverified → verification email  
2. Click link → `GET /users/auth/verify-email?token=...` → redirect frontend `/login?verified=true`  
3. Login → JWT access (1h) + refresh (7d)  
4. API auth: `Authorization: Bearer <access>`  
5. WebSocket auth: `?token=<access>` query param  

### API routes (confirmed from `config/urls.py` + app urls)

```
POST   /users/auth/signup/
POST   /users/auth/login/
GET    /users/auth/verify-email          (no trailing slash)
POST   /users/auth/refresh/
GET    /users/me/
GET    /users/accountant/dashboard/
GET    /users/client/dashboard/

GET|POST           /services/
GET|PUT|PATCH|DEL  /services/<pk>/

GET|POST           /bookings/
GET|PUT|PATCH|DEL  /bookings/<pk>/

POST   /accountants/create/
GET    /accountants/profile-status/<user_id>/

GET|POST  /api/inquiries/
GET       /api/inquiries/<id>/
POST      /api/inquiries/<id>/messages/
POST      /api/inquiries/<id>/mark-read/

GET  /api/                     (placeholder hello)
WS   /ws/inquiries/<inquiry_id>/?token=...
```

### Environment variables (from settings + `.env` keys)

| Variable | Used for |
|----------|----------|
| `SECRET_KEY` | Django secret (has insecure default fallback) |
| `DEBUG` | Debug mode (`"True"` string compare) |
| `ENV` | Switches Postgres vs SQLite |
| `ALLOWED_HOSTS` | Host allowlist |
| `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` | Frontend origins |
| `FRONTEND_URL` / `BACKEND_URL` | Email links / redirects |
| `DB_*` | Postgres when production |
| `REDIS_URL` | Channels layer |
| `EMAIL_*` / `DEFAULT_FROM_EMAIL` | Verification email SMTP |

**Missing:** checked-in `.env.example`.

### External services

| Service | Status |
|---------|--------|
| SMTP (Gmail-shaped) | Configured via env; required for signup |
| Redis | Required for WebSockets; running locally (`PONG`) |
| Postgres | Intended for prod; local compose/config broken |
| Stripe / other payments | Not integrated |

---

## 8. How frontend and backend communicate

- Frontend hardcodes **`http://127.0.0.1:8000`** and **`ws://127.0.0.1:8000`** (no `REACT_APP_*` base URL).
- REST via `fetch` and `axios` with `Authorization: Bearer ${localStorage.access_token}`.
- Chat realtime via `useChatSocket` → `ws://127.0.0.1:8000/ws/inquiries/${id}/?token=...`.
- CORS defaults allow localhost `3000` / `5173` / `3001`.

### Match / mismatch matrix

| Frontend call | Backend | Status |
|---------------|---------|--------|
| `POST /users/auth/login/` | Yes | Match |
| `POST /users/auth/signup/` | Yes | Match |
| `GET /services/`, `GET /services/:id/` | Yes | Match |
| `GET/POST /api/inquiries/` | Yes | Match (response field name mismatch on create) |
| `GET /api/inquiries/:id/`, mark-read | Yes | Match |
| WS `/ws/inquiries/:id/` | Yes | Match |
| `GET /bookings/` | Yes | Match |
| `POST /bookings/create/` | No — should be `POST /bookings/` | **Mismatch** |
| `GET /api/conversations/` | No | **Mismatch** |
| Navigate with `conversation_id` | Backend returns `inquiry_id` | **Mismatch** |

---

## 9. Can it run locally? Exact steps

### Current answer

**Not reliably with the existing `.env` as-is**, because `ENV=production` forces broken Postgres.  
**Yes, with a development env override**, Redis running, and awareness of email/SMTP for signup.

### Recommended local run (backend)

```bash
cd backend
source venv/bin/activate   # or .venv — prefer one and stick to it

# Critical: do NOT use broken production DB settings for local work
export ENV=development
export DEBUG=True
# Optionally override Redis if needed:
# export REDIS_URL=redis://127.0.0.1:6379/0

pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser   # optional
# Prefer Daphne/ASGI for WebSockets:
daphne -b 0.0.0.0 -p 8000 config.asgi:application
# or: python manage.py runserver   # HTTP only; WS may be limited
```

**Email note:** Signup calls real SMTP. For local signup without Gmail, temporarily set `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend` (or mock in tests). Otherwise signup may hang/fail on SMTP.

**Verify email locally:** Check console/logs for verify URL printed in `users/utils.py`, or use Django admin to set `is_verified=True`.

### Frontend

```bash
cd frontend/taxmanfinder
npm install
npm start   # http://localhost:3000
```

Assumes backend at `127.0.0.1:8000`.

### Docker Compose

**Do not use `compose.yaml` as-is.** Problems observed:

- Backend service has no `build:`/`volumes`/`env_file` wiring to Postgres
- `db` service incorrectly runs `npm install && npm run dev` and maps port 3000
- Empty DB env vars; incomplete volume definition

### Verified during audit

| Check | Result |
|-------|--------|
| `manage.py check` with `ENV=development` | OK |
| `showmigrations` with `ENV=development` | Migrations applied |
| Default `.env` (`ENV=production`) DB commands | **Fail** (bad Postgres host) |
| Redis | Running |
| Unit tests sample | Hang risk due to real SMTP on signup |

---

## 10. Obvious security, reliability, data-model, deployment, maintainability issues

### Security

1. Hardcoded insecure `SECRET_KEY` fallback in settings  
2. WebSocket stack without origin validation / session auth middleware (JWT query string only)  
3. `CreateAccountantProfile` is `AllowAny` (unauthenticated profile creation)  
4. `CheckProfileStatus` is public for any `user_id`  
5. Broken `IsAccountant` either over-allows reads or blocks legitimate writes  
6. Email credentials live in `.env` (good that `.env` is gitignored — confirm never committed)  
7. JWT in localStorage (XSS risk; common for SPAs but worth noting)  
8. Dockerfile runs `runserver` as app user — not a production server setup  

### Reliability

1. Production `.env` prevents local DB use  
2. Signup/tests depend on live SMTP  
3. Channels requires Redis — no in-memory fallback for local  
4. Dual HTTP/WS message writers can diverge  
5. Settings use same SQLite file for tests (`TEST.NAME`) — dangerous  

### Data model

1. Docs vs code field naming drift (`role` vs `is_accountant`, `title` vs `name`, `body` vs `content`)  
2. No link between Inquiry and Booking  
3. Inquiry status never transitions  
4. `has_services` / serializer source bugs  
5. Services FK to User rather than AccountantProfile (works, but easy to misuse)

### Deployment

1. Broken compose file  
2. No `.env.example`  
3. No production ASGI/static/collectstatic/gunicorn guidance  
4. DEBUG can be True while ENV=production (current `.env` pattern)  
5. No CI config found  

### Maintainability

1. Stale docs; empty recovery/onboarding files  
2. Dead views and abandoned apps  
3. Frontend/backend contract drift  
4. Mixed JS/TS; nested `hooks/hooks/`  
5. Two virtualenvs; root vs backend requirements confusion  
6. Debug `print`/`console.log` noise  

---

## Functionality status tables (quick reference)

### Confirmed

- User signup/login/JWT/verify flow (code complete; runtime needs working email + correct ENV)
- Services CRUD API structure
- Inquiry create/list/detail, unread, mark-read
- WebSocket inquiry chat consumer
- Booking model + list API
- CRA frontend pages for auth, services, chat, bookings, dashboards

### Partially implemented

- Accountant authorization (`IsAccountant`)
- Booking creation (correct logic unwired; ViewSet incomplete)
- Profile completeness
- Inquiry status workflow
- Frontend booking + accountant dashboard + contact navigation
- Docker / production config

### Missing

- Payments, reviews, search, admin moderation
- Production-ready deploy
- Frontend homepage, onboarding, auth guards, API env config
- `.env.example`, working compose, solid test suite

### Uncertain

- Live email delivery quality
- Full WS e2e under Daphne
- Data quality in existing SQLite

---

# Backend-first roadmap

Guiding principle: make the backend runnable, correct, and contract-stable before investing in UI.

---

## Phase 1: Make the existing project run reliably

### 1.1 Fix local environment configuration
- **What:** Set local `ENV` to non-production (or fix Postgres). Add `.env.example` with safe defaults. Document required vars. Prefer console email backend for local/dev.
- **Why:** Project currently fails DB commands with stock `.env`.
- **Files:** `backend/.env` (local), new `backend/.env.example`, `config/settings.py`, README
- **Depends on:** Nothing
- **MVP:** Required
- **Effort:** Small
- **Done when:** `python manage.py migrate` and `runserver`/`daphne` work on a fresh clone using `.env.example` only

### 1.2 Choose one Python venv and document it
- **What:** Standardize on one interpreter/venv; remove/ignore the other in docs.
- **Why:** `.venv` (3.12) and `venv` (3.14) create confusion.
- **Files:** `backend/venv`, `backend/.venv`, README
- **Depends on:** 1.1
- **MVP:** Required
- **Effort:** Small
- **Done when:** README specifies one activate path; `manage.py check` succeeds there

### 1.3 Make chat runnable with Redis (or document InMemory fallback for solo local)
- **What:** Ensure Redis is documented; optionally add InMemory channel layer when `DEBUG` and Redis unavailable.
- **Why:** WebSockets fail without channel layer.
- **Files:** `config/settings.py`, README
- **Depends on:** 1.1
- **MVP:** Required
- **Effort:** Small
- **Done when:** Connecting to `ws://.../ws/inquiries/1/?token=...` does not fail on channel layer

### 1.4 Replace/disable broken Compose or rewrite minimally
- **What:** Either delete/ignore broken `compose.yaml` or rewrite: Postgres + Redis + backend build from `backend/Dockerfile` with correct env.
- **Why:** Current file is misleading and unsafe to follow.
- **Files:** `compose.yaml`, `backend/Dockerfile`
- **Depends on:** 1.1
- **MVP:** Can wait (local native run first)
- **Effort:** Medium
- **Done when:** `docker compose up` starts API + DB + Redis, or docs explicitly say “compose not ready”

---

## Phase 2: Validate and stabilize the backend

### 2.1 Fix `IsAccountant` permission
- **What:** Complete `has_permission` so accountants can write and non-accountants cannot; decide read policy.
- **Why:** Blocks service writes; under-protects accountant dashboard GET.
- **Files:** `users/permissions.py`, related tests
- **Depends on:** 1.1
- **MVP:** Required
- **Effort:** Small
- **Done when:** Accountant can create service; client cannot; client cannot access accountant dashboard; tests pass

### 2.2 Fix booking creation path
- **What:** Wire correct create behavior (set `accountant` from `service`) into the ViewSet (or restore dedicated route and update clients). Prefer single canonical `POST /bookings/`.
- **Why:** Current create is broken; frontend already confused.
- **Files:** `bookings/views.py`, `bookings/urls.py`, serializers
- **Depends on:** 2.1 (if accountant-only rules apply)
- **MVP:** Required
- **Effort:** Small
- **Done when:** Authenticated client can create booking with service id; response includes accountant; tests cover happy path

### 2.3 Fix accountant profile completeness + inquiry serializer
- **What:** `has_services` → `self.user.services.exists()`; fix `accountant_name` source to `accountant.email`.
- **Why:** Profile status and inquiry list fields are wrong.
- **Files:** `accountants/models.py`, `inquiries/serializers.py`, tests
- **Depends on:** Nothing critical
- **MVP:** Required
- **Effort:** Small
- **Done when:** Profile status and inquiry list return correct values in tests

### 2.4 Stabilize email + tests
- **What:** Mock email in tests; use console backend in DEBUG; fix hanging tests; stop using live sqlite as test DB.
- **Why:** Tests currently hang/risk data corruption.
- **Files:** `users/utils.py`, `users/tests.py`, `config/settings.py`
- **Depends on:** 1.1
- **MVP:** Required
- **Effort:** Medium
- **Done when:** `manage.py test users accountants bookings` completes green without SMTP/network

### 2.5 Clean dead/duplicate routes and abandoned apps
- **What:** Remove or clearly quarantine `listings/`, placeholder `api` hello, empty `api/chats`, duplicate URL paths; register useful models in admin.
- **Why:** Reduces confusion and accidental use of dead endpoints.
- **Files:** `config/urls.py`, `listings/`, `api/`, `chats/urls.py`, admin modules
- **Depends on:** 2.2 (know which booking routes stay)
- **MVP:** Can wait (but do early for clarity)
- **Effort:** Medium
- **Done when:** Root URL map has only intentional routes; README lists them

### 2.6 Harden ASGI WebSocket auth/origins
- **What:** Re-enable origin validation; keep JWT query auth but document risks; strip debug prints.
- **Why:** Current stack is insecure for any non-local deploy.
- **Files:** `config/asgi.py`, `chats/consumers.py`
- **Depends on:** 1.3
- **MVP:** Required before deploy; can wait for local MVP
- **Effort:** Medium
- **Done when:** Non-allowed origins rejected; unauthorized WS cannot join other users’ inquiries

---

## Phase 3: Complete the core product workflow

Core backend workflow for MVP:

`Signup → verify → login → (accountant: profile + services) → (client: browse services) → inquiry/chat → booking`

### 3.1 Accountant onboarding API
- **What:** Authenticated endpoints to get/update own profile; enforce completeness rules; create services only for self.
- **Why:** Marketplace needs publishable accountant offerings.
- **Files:** `accountants/`, `services/`
- **Depends on:** 2.1, 2.3
- **MVP:** Required
- **Effort:** Medium
- **Done when:** Accountant can complete profile + add ≥1 service; status endpoint reflects completeness

### 3.2 Public browse/search minimum
- **What:** Ensure public service list is stable; optionally filter by price/name; hide incomplete accountants if desired.
- **Why:** Clients need a discovery surface.
- **Files:** `services/views.py`, serializers
- **Depends on:** 3.1
- **MVP:** Required (list is enough; search can wait)
- **Effort:** Small–Medium
- **Done when:** Anonymous `GET /services/` returns usable listings for complete accountants (if you choose that rule)

### 3.3 Inquiry ↔ messaging contract freeze
- **What:** Document response shapes (`inquiry_id`, message fields, unread). Decide HTTP vs WS send (recommend WS primary, HTTP optional). Optionally update inquiry status on first accountant reply.
- **Why:** Frontend already breaks on field names; freeze API before UI work.
- **Files:** `inquiries/views.py`, `chats/`, short API notes in README or `docs/api.md`
- **Depends on:** 2.3
- **MVP:** Required
- **Effort:** Medium
- **Done when:** Written contract exists; create inquiry returns stable JSON; messages round-trip

### 3.4 Booking lifecycle minimum
- **What:** Create, list (client + accountant views), cancel/status update with permissions.
- **Why:** Booking is a core marketplace action already partially built.
- **Files:** `bookings/`
- **Depends on:** 2.2
- **MVP:** Required (create/list/cancel); rich scheduling can wait
- **Effort:** Medium
- **Done when:** Client books a service; both parties can see it; cancel works; unauthorized access blocked

### 3.5 Defer non-MVP chat features
- **What:** Explicitly defer online status, media, E2E encryption, notifications from `docs/roadmap.md`.
- **Why:** Avoid scope explosion.
- **Files:** `docs/roadmap.md`
- **Depends on:** None
- **MVP:** N/A (documentation)
- **Effort:** Small
- **Done when:** Roadmap marks these as post-MVP

---

## Phase 4: Add the minimum viable frontend

Only after Phase 2–3 contracts are stable.

### 4.1 API client + env base URL
- **What:** Single `REACT_APP_API_URL` / WS URL helper; remove hardcoded hosts.
- **Why:** Required for any non-local environment.
- **Files:** frontend `src/` API helper, `.env.example`
- **Depends on:** Phase 3 contract freeze
- **MVP:** Required
- **Effort:** Small
- **Done when:** No `127.0.0.1` literals in `src/`

### 4.2 Auth shell
- **What:** Persist tokens, refresh or re-login, logout, role-based redirect, protected routes.
- **Why:** Current login always goes to client dashboard; no guards.
- **Files:** `Login.tsx`, `Signup.tsx`, `App.js`, new auth context/helpers
- **Depends on:** 4.1, backend auth stable
- **MVP:** Required
- **Effort:** Medium
- **Done when:** Client vs accountant land correctly; unauthenticated users redirected from private pages

### 4.3 Fix existing page ↔ API mismatches
- **What:** `inquiry_id` navigation; bookings `POST /bookings/`; accountant inbox uses `/api/inquiries/`; fix axios PATCH.
- **Why:** These flows are almost done but broken.
- **Files:** `ServiceDetail.tsx`, `BookingsPage.tsx`, `AccountantDashboard.tsx`
- **Depends on:** 4.1, Phase 3
- **MVP:** Required
- **Effort:** Small
- **Done when:** Contact → chat works; booking create works; accountant sees inquiries

### 4.4 Minimal screens only
- **What:** Home/browse services, auth, dashboards (thin), chat, bookings. Skip design system overhaul.
- **Why:** You asked to keep frontend light until backend is sound.
- **Files:** existing pages
- **Depends on:** 4.2–4.3
- **MVP:** Required
- **Effort:** Medium
- **Done when:** One happy-path demo works end-to-end for client and accountant

---

## Phase 5: Prepare for deployment

### 5.1 Production settings checklist
- **What:** `DEBUG=False`, real `SECRET_KEY`, Postgres, allowed hosts, CORS, secure cookies/HTTPS assumptions, static files, Daphne/uvicorn + reverse proxy.
- **Why:** Current settings are local-dev oriented.
- **Files:** `config/settings.py`, deploy docs, Dockerfile
- **Depends on:** Phases 1–3
- **MVP:** Required for deploy
- **Effort:** Large
- **Done when:** Staging deploy serves API + WS over HTTPS with Postgres/Redis

### 5.2 Secrets and ops
- **What:** Hosted Redis, SMTP provider, secret manager; never commit `.env`.
- **Why:** Email/chat/auth depend on external services.
- **Files:** infra docs, `.env.example`
- **Depends on:** 5.1
- **MVP:** Required for deploy
- **Effort:** Medium
- **Done when:** Staging uses managed secrets; signup email arrives

### 5.3 Basic observability
- **What:** Structured logging, error tracking (e.g. Sentry), health endpoint.
- **Why:** Otherwise production failures are invisible.
- **Files:** settings, new health view
- **Depends on:** 5.1
- **MVP:** Can wait briefly after first staging
- **Effort:** Medium
- **Done when:** Health check returns 200; errors appear in tracker

---

## Phase 6: Post-deployment hardening

### 6.1 Security pass
- Rate limiting, tighter WS auth, permission audits, remove debug prints, security headers.

### 6.2 Data-model cleanup
- Inquiry status transitions; optional Booking↔Inquiry link; consider Conversation model only if needed.

### 6.3 Test coverage for critical paths
- Auth, services, inquiries/messages, bookings — API tests without Selenium.

### 6.4 Payments / reviews (post-MVP)
- As in original roadmap Phase 3.

### 6.5 Frontend quality
- Replace CRA if desired, unify TS, real design — after product validation.

---

# Decision aids

## 1. Current-state summary (one paragraph)

Tax Man Finder is a Django/DRF marketplace backend with JWT auth, services, inquiry-based chat (HTTP + Redis WebSockets), and bookings, plus a CRA React prototype UI. The domain logic is partly real, but local config is broken for production-mode Postgres, several backend permission/serializer/booking bugs block core flows, and the frontend calls a few non-existent or mismatched endpoints. Stabilize run + backend contracts first; then fix the thin UI against that contract.

## 2. Five highest-priority issues

1. **Broken local/prod env switch** — `ENV=production` + invalid `DB_HOST` prevents normal runs (`backend/.env`, `config/settings.py`).
2. **Incomplete `IsAccountant`** — blocks service writes and mis-guards dashboards (`users/permissions.py`).
3. **Booking create broken / unwired** — ViewSet omits accountant; better view not routed (`bookings/views.py`, `bookings/urls.py`).
4. **Frontend ↔ backend contract mismatches** — `conversation_id` vs `inquiry_id`, `/bookings/create/`, `/api/conversations/` (frontend pages listed above).
5. **Serializer/profile bugs** — `accountant_name` wrong source; `has_services` wrong relation (`inquiries/serializers.py`, `accountants/models.py`).

## 3. Proposed MVP scope (based on what exists)

**In scope**
- Client + accountant signup, email verify, JWT login
- Accountant profile + at least one service
- Public service browse + detail
- Create inquiry → chat (WebSocket) → mark read
- Client creates booking; both can list; cancel/status update
- Thin frontend covering those flows only

**Out of scope for MVP**
- Stripe/payments, reviews, advanced chat (media, online presence, E2E), polished marketing site, full Docker/K8s, search sophistication

## 4. Checklist: backend ready for frontend investment?

- [ ] Fresh clone runs with `.env.example` (SQLite or local Postgres) without manual guesswork
- [ ] `migrate` succeeds; `daphne` serves HTTP + WS
- [ ] Signup/login/verify works (console email OK for local)
- [ ] `IsAccountant` correct; accountants can CRUD own services
- [ ] Inquiry create returns documented `{ inquiry_id }` (or agreed field)
- [ ] Messages send/receive over WS for inquiry participants only
- [ ] Booking create/list works with documented payload
- [ ] Broken serializers/profile helpers fixed
- [ ] Short API contract doc lists endpoints + example JSON
- [ ] Critical API tests pass without network/SMTP
- [ ] No reliance on abandoned routes (`/api/conversations/`, `/bookings/create/` unless restored intentionally)

## 5. Checklist: ready to deploy?

- [ ] `DEBUG=False`; strong `SECRET_KEY`; no secrets in git
- [ ] Postgres + Redis managed and reachable
- [ ] Migrations applied; backup strategy defined
- [ ] HTTPS reverse proxy; correct `ALLOWED_HOSTS` / CORS / CSRF
- [ ] ASGI server (Daphne/Uvicorn) for WS; not `runserver`
- [ ] SMTP provider working for verification emails
- [ ] WebSocket origin checks enabled
- [ ] Health check + basic logging/error tracking
- [ ] Frontend build pointed at production API/WS URLs
- [ ] Smoke test of full MVP path on staging

## 6. Recommended next 10 concrete tasks

1. Fix `.env` for local (`ENV=development` or valid Postgres) and add `backend/.env.example`.
2. Document and use one venv; confirm `migrate` + `daphne` + Redis.
3. Switch local email to console backend; mock email in tests.
4. Fix `IsAccountant` and add/adjust permission tests.
5. Fix `BookingViewSet.perform_create` (set accountant from service); remove or wire dead booking views.
6. Fix `AccountantProfile.has_services` and `InquirySerializer.accountant_name`.
7. Write a one-page API contract (auth, services, inquiries, chat WS, bookings).
8. Run/fix backend tests for users + bookings + accountants until green.
9. Only then: frontend API base URL helper + fix `inquiry_id`, bookings URL, accountant inbox endpoint.
10. Implement thin role-based auth routing (client vs accountant) and verify one end-to-end demo.

---

## Appendix A — Root URL map (backend)

See section 7. Mounted from `backend/config/urls.py`.

## Appendix B — Frontend routes

From `frontend/taxmanfinder/src/App.js`:

| Path | Component |
|------|-----------|
| `/login` | Login |
| `/signup` | Signup |
| `/services` | ServicesList |
| `/services/:serviceId` | ServiceDetail |
| `/bookings` | BookingsPage |
| `/dashboard/accountant` | AccountantDashboard |
| `/dashboard/client` | ClientDashboard |
| `/chat` | ChatLayout + empty state |
| `/chat/:inquiryId` | ConversationView |
| `*` | Login (catch-all) |

## Appendix C — Evidence highlights (file references)

- Intent: `README.md`, `docs/user-flows.md`, `docs/roadmap.md`
- Settings/DB/JWT/Channels: `backend/config/settings.py`
- Broken permission: `backend/users/permissions.py` (incomplete method)
- Broken booking create: `backend/bookings/views.py` `perform_create`
- Dead booking views vs urls: `bookings/views.py` vs `bookings/urls.py`
- Inquiry response field: `inquiries/views.py` returns `inquiry_id`
- Frontend mismatch: `ServiceDetail.tsx` uses `conversation_id` and `/bookings/create/`
- Accountant dashboard mismatch: `AccountantDashboard.tsx` → `/api/conversations/`
- Abandoned listings: not in `INSTALLED_APPS`
- Broken compose: `compose.yaml`
- Empty plans: `docs/onboarding.md`, `backend/RECOVERY_PLAN.md`

---

*End of audit. No application code was modified; this file is the deliverable.*
