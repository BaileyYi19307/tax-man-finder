# TaxManFinder MVP Checklist

Audit date: 17 August 2026. Source of truth is the repository as inspected, not models or docs alone.

This document has two separate goals. **Phase 1 is the current work.** Phase 2 is parked until the local product is coherent.

| Phase | Goal |
| --- | --- |
| **Phase 1 — MVP feature completion** | Make the accountant-discovery → message → consultation → booking loop work end-to-end **locally**, with navigation and logout. |
| **Phase 2 — Production readiness** | Host, HTTPS, SMTP, secrets, static files, CORS, deploy scripts. Do not start this until Phase 1 is done. |

Signup creates one `User`. An accountant is that same user with an `AccountantProfile`. There is no `ClientProfile`. A consultation is a `Booking` on an `Inquiry`.

**Status**

| Status | Meaning |
| --- | --- |
| `DONE` | Frontend and backend are wired; a local user can complete the step |
| `PARTIAL` | Usable core with a gap that distorts the product |
| `NOT_STARTED` | No real implementation |
| `BROKEN` | Implemented, but the user-facing path fails or sends people to the wrong place |
| `DEFER` | Intentionally not Phase 1 |

**Priority (Phase 1):** `P0` is required for local feature completeness. `P1` is useful. `P2` is post-MVP.

---

# Phase 1 — MVP Feature Completion

## Feature-complete local MVP

A user on `localhost:3000` + `127.0.0.1:8000` (Daphne + Redis or `CHANNEL_LAYER=memory`) should be able to do all of the following without typing URLs by hand.

**Public discovery.** Visitor opens TaxManFinder → browses accountants → opens a profile → sees name/firm/location, bio, credentials, and services.

**Client.** Visitor chooses Message or Request consultation → signs up / logs in if needed → returns to the same page → sends the inquiry → later finds conversations and consultation status.

**Accountant.** Signs up → completes onboarding → reaches the accountant dashboard → can view/edit their profile → can see (and at least edit) their services → sees incoming inquiries → replies.

**Consultation / booking.** Client requests a consultation → accountant sees it and accepts or declines → both see status. An accepted consultation is a confirmed booking visible to both.

**Usability.** Both roles can navigate Browse, Messages, Consultations, Dashboard/Profile, and can log out / log back in to the correct dashboard.

Local email verification may stay on the console backend. Phase 1 does **not** include SMTP, hosting, or HTTPS.

## Current local state

The **backend of the core loop is mostly in place**, and several frontend paths are already wired:

- Public directory and profile APIs
- Signup / login / accountant onboarding (first-time, same browser)
- Start inquiry from profile/service after login
- Chat list + conversation + WebSocket replies (when Daphne/Redis are running). Failed send no longer looks delivered.
- Request consultation, accept/decline, `/bookings` for both roles
- My Services list with edit
- Service ownership checks

What is **not** feature-complete: accountants cannot add or delete extra services from the UI. The public directory shows names for complete profiles only. Shared header + logout exist on main app pages. Returning complete accountants log in to `/dashboard/accountant`. Client dashboard “Find a Tax Professional” goes to `/accountants`. Accountants can view/edit their profile at `/dashboard/profile` and edit an existing service from My Services.

**Assessment:** core flows are **mostly wired locally**. Remaining Phase 1 work is mostly P1 polish (signup verify screen, extra service create, HTTP chat fallback).

---

## Phase 1 area audit

### 1. Public accountant marketplace

| Feature | Status | Priority | Evidence |
| --- | --- | --- | --- |
| Accountant directory (`/accountants`) | `DONE` | P0 | `AccountantsDirectory.tsx` → `GET /accountants/directory/` (`PublicAccountantDirectoryView`, `AllowAny`). Directory lists only complete profiles. Cards show name (firm fallback), firm + location, credentials, bio. Loading, empty, and error states. Tests: `AccountantsDirectory.test.js`, `test_directory_excludes_incomplete_profiles`. |
| Public profile (`/accountants/:userId`) | `DONE` | P0 | `AccountantProfile.tsx`. Title is name (firm fallback). Firm + location shown. Back link to `/accountants`. “Go to inbox” only when logged in. Message / Request consultation unchanged. |
| Real name / firm / location (not email) | `DONE` | P0 | `displayName.ts`. Email stays in the API payload but is not used as the public title. |
| Hide incomplete profiles | `DONE` | P0 | Completeness is `bio` + `credentials` + ≥1 active service (`AccountantProfile.is_complete`). Directory filters with `profile.is_complete`. Direct `/accountants/:userId` still returns an existing profile. |
| Services on profile | `DONE` | P0 | Active services only (`id`, `name`) with empty copy. Test: `test_public_profile_lists_active_services`. |
| Service detail (`/services/:id`) | `DONE` | P0 | `ServiceDetail.tsx` + `AllowAny` retrieve. Message / consult work. Failed fetch shows an error with links back to `/accountants` and `/services`. Tests: `ServiceDetail.test.js`. |
| Public service catalog (`/services`) | `PARTIAL` | P1 | Exists; includes inactive rows. Discovery for MVP is the **accountant directory**, not this catalog. Client dashboard CTA now goes to `/accountants`. |
| Search / filters | `DEFER` | P2 | Not needed for a small local directory. |
| Empty / error / loading | `PARTIAL` | P0 | Directory has loading/empty/error. Service detail has loading/error. Service list has none. |

### 2. Authentication and product routing

| Feature | Status | Priority | Evidence |
| --- | --- | --- | --- |
| Client signup | `DONE` | P0 | `/signup` → `POST /users/auth/signup/` email + password only. No role. Tests in `users/tests.py`. |
| Accountant signup intent | `DONE` | P0 | Home card stores `tax-professional` (`intent.ts`) and sends people to `/onboarding/accountant`. First-time same-browser path works. |
| Login | `DONE` | P0 | `POST /users/auth/login/`. JWT in `localStorage`. Requires `is_verified`. Flags `has_accountant_profile` / `accountant_profile_complete` are returned. |
| Logout | `DONE` | P0 | Header **Log out** (`AppHeader.tsx`) clears `access_token`, `refresh_token`, and `user_id` (`auth/session.ts`), drops in-memory `AuthProvider` user, and navigates to `/`. No backend logout endpoint. Tests in `AppHeader.test.js`. |
| Post-login routing (returning accountant) | `DONE` | P0 | `resolvePostAuthPath` uses `hasAccountantProfile` / `profileComplete`. Complete accountants go to `/dashboard/accountant` without leftover intent. Incomplete profiles resume onboarding. Message `next` still wins. Tests in `intent.test.js`. |
| Incomplete accountant resumes onboarding | `DONE` | P0 | `GET /accountants/me/` prefills; complete profiles skip to accountant dashboard. Tests in `accountants/tests.py`. |
| Message / Request consultation `next` | `DONE` | P0 | `loginPath({ next: location.pathname })`. Explicit `next` is not stolen by leftover accountant intent (`intent.test.js`). Composer does not reopen (acceptable). |
| Password reset | `DEFER` | P2 | Not required to call the local MVP feature-complete. |
| Check-email after signup | `PARTIAL` | P1 | API says verify; UI goes straight to `/login`, which then fails until the console verify link is clicked. Local console mail is enough for Phase 1; a one-screen “check the server console / email” is polish. SMTP is Phase 2. |

### 3. Client dashboard / client experience

| Feature | Status | Priority | Evidence |
| --- | --- | --- | --- |
| Client home | `DONE` | P0 | `/dashboard/client` → `ClientDashboard.tsx`. Static cards. **Login-gated** (`RequireAuth`). Primary CTA **Browse accountants** → `/accountants`. Raw `user_id` card removed. Test: `ClientDashboard.test.js`. |
| Sent inquiries / conversations | `PARTIAL` | P0 | Messages card → `/chat`. List works if a token exists. Unauthenticated `/chat` redirects to login with `next`. |
| Consultation / booking status | `DONE` | P0 | Bookings card → `/bookings` (`BookingsPage.tsx`) with login redirect, list, status, cancel. |
| Navigate to accountant discovery | `DONE` | P0 | Find a Tax Professional CTA links to `/accountants`. |
| Client profile onboarding | `DEFER` | P2 | Not required. Do not invent a `ClientProfile`. |

### 4. Accountant dashboard

| Feature | Status | Priority | Evidence |
| --- | --- | --- | --- |
| Dashboard landing | `DONE` | P0 | `/dashboard/accountant` → `AccountantDashboard.tsx`. **Login-gated**; incomplete profiles → onboarding; no profile → client dashboard. Recent inquiries (first 5) + cards. Loading, empty, and error states. |
| Profile card / link | `DONE` | P0 | Dashboard card and header **My profile** → `/dashboard/profile`. Public listing link on the edit page. |
| My Services card | `DONE` | P0 | Links to `/dashboard/services`. Label is “View **and edit** your listings.” |
| Inbox card | `DONE` | P0 | Links to `/chat`. |
| Consultations card | `DONE` | P0 | Links to `/bookings`. |
| Incoming inquiries | `DONE` | P0 | Recent inquiries list. Empty copy only after a successful fetch. Failed fetch shows an error. Tests in `AccountantDashboard.test.js`. |

### 5. Accountant profile management

| Feature | Status | Priority | Evidence |
| --- | --- | --- | --- |
| Onboarding creates / upserts profile | `DONE` | P0 | `POST /accountants/create/` binds `user=request.user`. Name, firm, location, bio, credentials, first service. Tests cover duplicate-safe upsert. |
| View own profile after complete | `DONE` | P0 | `/dashboard/profile` loads `GET /accountants/me/`. Complete users are still redirected away from `/onboarding/accountant`. |
| Edit after onboarding | `DONE` | P0 | Same page saves via `POST /accountants/create/` without creating another service. Tests: `AccountantProfileEdit.test.js`. |
| Public profile reflects edits | `DONE` | P0 | Public pages show name/firm/location; edit uses the same fields. |
| Incomplete behavior | `DONE` | P0 | Resume works. Incomplete rows are excluded from the public directory. Direct profile URLs still load. |

**Minimum for Phase 1:** keep using `POST /accountants/create/` as the save API. Add a “My profile” view that shows current fields and allows edit (either reopen a form on a new route or stop bouncing complete users off onboarding). Do not add a second profile model.

### 6. Service management

| Feature | Status | Priority | Evidence |
| --- | --- | --- | --- |
| Onboarding creates first service | `DONE` | P0 | Created only if the user has no active services. |
| My Services list (owned only) | `DONE` | P0 | `GET /services/mine/` + `MyServices.tsx`. Tests in `services/tests.py` and `MyServices.test.js`. Login redirect exists. |
| Ownership authorization | `DONE` | P0 | `IsServiceOwner`; create binds `request.user`; serializer `accountant` read-only. Tests cover spoofed owner and other-accountant PATCH/DELETE. |
| Create additional service UI | `NOT_STARTED` | P1 | API `POST /services/` exists. First service from onboarding is enough for a one-listing MVP. |
| Edit service UI | `DONE` | P0 | `MyServices.tsx` Edit form PATCHes name/description (and indicative price when shown). Tests: `MyServices.test.js`. Create/delete still P1. |
| Delete / deactivate UI | `NOT_STARTED` | P1 | DELETE/PATCH `is_active` exist. Defer unless an accountant ships a bad listing they must hide. Filter public catalog to `is_active=True` if deactivation is added. |
| Public catalog vs My Services | `DONE` | P1 | They are separate routes. Keep it that way. Point clients at `/accountants`, not `/services`. |

**Phase 1 minimum:** owned list (done) + **edit** the existing service. Extra create/delete can wait.

### 7. Inquiry and messaging

| Feature | Status | Priority | Evidence |
| --- | --- | --- | --- |
| Client sends inquiry from profile/service | `DONE` | P0 | `startConversation` → `POST /api/inquiries/`. Client from `request.user`. Reuses open inquiry. |
| Client sees conversation | `DONE` | P0 | Navigate to `/chat/:inquiryId`. History via `GET /api/inquiries/:id/`. |
| Accountant receives / opens / replies | `PARTIAL` | P0 | Dashboard + `/chat` list. Reply is WebSocket-only (`useChatSocket` → `ws://127.0.0.1:8000/...`). Works **locally** with Daphne + Redis/memory. HTTP `POST .../messages/` is unused. Failed send does not add a bubble. |
| Client sees reply | `DONE` | P0 | Same socket / history refresh, assuming WS is up. |
| Permissions | `DONE` | P0 | Participant queryset → outsider 404. WS outsider close 4003. |
| Chat when logged out | `DONE` | P0 | `RequireAuth` on `/chat` redirects to login with `next`. `ChatLayout` still no-ops without a token if reached another way. |
| Empty / error states | `DONE` | P1 | Inbox and dashboard distinguish empty from a failed fetch. |
| Close inquiry UI | `DEFER` | P2 | |

For Phase 1, keep WebSocket send locally. Add login redirect on `/chat` and do not treat failed WS sends as success. HTTP fallback is P1 (helps when Redis is down). Moving WS off localhost is Phase 2.

### 8. Consultation request flow

Consultation **is** a pending `Booking` attached to an inquiry.

| Feature | Status | Priority | Evidence |
| --- | --- | --- | --- |
| Client requests from profile / service | `DONE` | P0 | `requestConsultation()` → `POST /bookings/request-consultation/`. Creates/reuses inquiry + message + pending booking. |
| Accountant sees request | `DONE` | P0 | `/bookings` and conversation “Consultation requests” block. |
| Accept / decline | `DONE` | P0 | Accountant-only; UI on both surfaces. |
| Client sees status | `DONE` | P0 | Same pages, `status_label`. |
| Duplicate / invalid | `DONE` | P1 | Unique active booking per inquiry; new booking after decline; self-request blocked. Frontend errors are generic. |
| Request from inside an open chat | `NOT_STARTED` | P2 | `POST /bookings/` exists (API-only). Not required; profile/service already start the flow. |
| Notify by email | `DEFER` | P2 | In-app is enough for local two-browser testing. Real notify is Phase 2. |

### 9. Booking flow

| Feature | Status | Priority | Evidence |
| --- | --- | --- | --- |
| What creates a booking | `DONE` | P0 | User-facing: request-consultation. Direct create-on-inquiry is API-only. |
| Belongs to inquiry; parties derived | `DONE` | P0 | FK required; client/accountant copied from inquiry, not the payload. |
| Statuses | `DONE` | P0 | `pending` → `confirmed` (accept) / `declined` / `cancelled`. |
| Client + accountant views | `DONE` | P0 | Shared `/bookings` page, participant queryset. |
| Cancel | `PARTIAL` | P1 | UI + `POST /bookings/:id/cancel/`. No backend cancel tests. Double-submit not guarded. |
| Confirmed overlap | `DONE` | P2 | Enforced on accept only. |

Accepted consultation **is** the confirmed booking. No extra booking-creation step is needed for Phase 1.

### 10. Navigation

Shared header (`AppHeader` via `AppLayout`) is on main app pages. Login, signup, and accountant onboarding stay header-free. Dashboard link uses `GET /users/me/` `has_accountant_profile`, not signup intent. Messages = `/chat`. Consultations = `/bookings`. Complete accountants also get **My profile** → `/dashboard/profile`. My Services stays a dashboard card.

| Role | Needed | Today |
| --- | --- | --- |
| Client: Browse | `/accountants` | Header **Browse** |
| Client: Messages | `/chat` | Header **Messages** (and dashboard card) |
| Client: Consultations | `/bookings` | Header **Consultations** (and dashboard card) |
| Client: Logout | clear tokens + Home | Header **Log out** |
| Accountant: Dashboard | `/dashboard/accountant` | Header **Accountant Dashboard** when `has_accountant_profile`. Home → Log in uses capability (`resolvePostAuthPath`). |
| Accountant: Profile | own view/edit | Header **My profile** → `/dashboard/profile` when the profile is complete |
| Accountant: My Services | `/dashboard/services` | Dashboard card only (intentionally not in this header) |
| Accountant: Messages | `/chat` | Header **Messages** |
| Accountant: Consultations | `/bookings` | Header **Consultations** |
| Accountant: Logout | same as client | Header **Log out** |

Unknown URLs currently render Home (`App.js` `path="*"`). Custom 404 is P2.

---

## Phase 1 P0 gaps (product only)

None. Remaining backlog items are P1 or deferred.

---

## Phase 1 implementation backlog

Work **vertical product slices**. Do not start Phase 2 items in this list. Order is dependency + journey, not “backend then frontend.”

| Order | Area | Feature / Problem | Status | Priority | Evidence | Recommended Work |
| ----- | ---- | ----------------- | ------ | -------- | -------- | ---------------- |
| 1 | Navigation | Shared header + logout | `DONE` | P0 | `AppHeader.tsx`, `AuthProvider.tsx`, `auth/session.ts`; tests `AppHeader.test.js`, `Home.test.js` | Header on main app routes. Logout clears session keys and returns to `/`. Home no longer shows Log in/Sign up when authenticated. |
| 2 | Auth routing | Returning accountant → `/dashboard/client` | `DONE` | P0 | `intent.ts` `resolvePostAuthPath`; `RequireAuth.tsx`; `Login.tsx` profile flags | Complete accountant → `/dashboard/accountant`. Incomplete profile → onboarding. Message `next` still wins. `/dashboard/*` and `/chat` login-gated. |
| 3 | Marketplace | Directory/profile show email; list incomplete | `DONE` | P0 | `PublicAccountantDirectoryView`; `displayName.ts`; `AccountantsDirectory.tsx`; `AccountantProfile.tsx` | Directory lists complete profiles only. Public title is name (firm fallback). Firm + location shown. Back to `/accountants`. Inbox link logged-in only. |
| 4 | Client experience | Find-professional CTA hits service catalog | `DONE` | P0 | `ClientDashboard.tsx`; `ClientDashboard.test.js` | Primary CTA goes to `/accountants`. Raw `user_id` card removed. |
| 5 | Accountant profile | No view/edit after complete | `DONE` | P0 | `AccountantProfileEdit.tsx`; header + dashboard links | `/dashboard/profile` loads `GET /accountants/me/` and saves via `POST /accountants/create/`. Public listing uses the same name/firm fields. |
| 6 | Services | My Services is read-only | `DONE` | P0 | `MyServices.tsx` + `updateMyService`; dashboard copy | Edit name/description (and price if shown) for owned services. Create/delete still P1. |
| 7 | Messaging | Failed WS looks sent; dashboard empty vs error | `DONE` | P0 | `useChatSocket` returns send success; `ConversationView.tsx`; dashboard + inbox error states | Failed WS send keeps the draft and shows an error (no fake bubble). Inquiry fetch empty vs error on dashboard and inbox. HTTP fallback still P1. |
| 8 | Marketplace | Service detail infinite loading | `DONE` | P0 | `ServiceDetail.tsx` fetch loading/error | Failed fetch → error + links to `/accountants` and `/services`. |
| 9 | Signup UX | Verify required; UI dumps user on login | `PARTIAL` | P1 | `Signup.tsx` navigates to login; console mail | After signup, show “Open the verify link from the Django console, then log in” while keeping `next` / intent. Not SMTP. |
| 10 | Services | Add a second listing | `NOT_STARTED` | P1 | `POST /services/` unused by UI | Create form on My Services after edit exists. |
| 11 | Messaging | HTTP send unused | `PARTIAL` | P1 | `POST /api/inquiries/<id>/messages/` | Fallback when WS is not `OPEN` so local chat still works without Redis. |
| 12 | Bookings | Cancel untested; double-submit | `PARTIAL` | P1 | `BookingsPage.tsx`; no `test_cancel` | Disable buttons in flight; add a cancel permission test. |
| 13 | Services | Extra create is enough; delete optional | `NOT_STARTED` | P1 | DELETE / `is_active` | Deactivate or delete own service; public list only `is_active`. |
| 14 | Marketplace | Search / filters | `DEFER` | P2 | None | Do not build. |
| 15 | Consultations | In-chat request form | `NOT_STARTED` | P2 | `POST /bookings/` API-only | Skip; profile/service already start the flow. |
| 16 | Auth | Password reset | `NOT_STARTED` | P2 | None | Phase 1 defer; revisit in Phase 2 with real mail. |

---

## Phase 1 local acceptance test

Two browsers, local API + Redis (or memory channel layer). Console email is OK.

1. Logged out: Home → Find an accountant. Directory shows **names**, not incomplete shells.
2. Open a profile: name, firm/location if set, bio, credentials, services. Open a service; it loads or errors clearly.
3. Message → signup/login → return to the **same** profile → send. Conversation opens.
4. Accountant: signup → verify via console link → onboarding → accountant dashboard.
5. Header works: Profile, My Services, Messages, Consultations, Log out.
6. Log out. Log in from Home **without** leftover tax-professional intent → accountant dashboard.
7. Accountant replies; client sees the reply.
8. Client requests consultation; accountant accepts (or declines); both `/bookings` pages match.
9. Accountant edits profile and a service; public profile/listing updates.
10. Client header: Browse, Messages, Consultations, Log out. After logout, Home shows Log in again.

---

# Phase 2 — Production Readiness

Parked until Phase 1 is accepted. These findings are from the 16 August 2026 audit and are **not** the current implementation order.

Local `127.0.0.1` URLs are acceptable for Phase 1. They become blockers only when the SPA is hosted.

## Phase 2 current state

The repo is a local Django/DRF + CRA app. README covers venv, SQLite, Daphne, Redis, `npm start`. There is no chosen host, Dockerfile, Procfile, or committed CI (`.github/` is gitignored).

## Phase 2 checklist

### Frontend origin / chat transport

| Feature | Status | Priority | Evidence |
| --- | --- | --- | --- |
| Single API base URL | `NOT_STARTED` | P0 | `api/client.ts` has `REACT_APP_API_BASE` but login, signup, `ServicesList.tsx` hardcode `http://127.0.0.1:8000`. |
| WebSocket origin / `wss` | `NOT_STARTED` | P0 | `useChatSocket.tsx` hardcodes `ws://127.0.0.1:8000/ws/inquiries/.../?token=`. |
| HTTP chat fallback in production | `PARTIAL` | P1 | Same unused `POST /api/inquiries/<id>/messages/` as Phase 1 item 11. |

### Secrets, Django, HTTPS

| Feature | Status | Priority | Evidence |
| --- | --- | --- | --- |
| `SECRET_KEY` fail-closed | `PARTIAL` | P0 | `config/settings.py` default `django-insecure-…`. Missing env forges JWTs and verify signatures. |
| `DEBUG` / `ALLOWED_HOSTS` / CORS | `PARTIAL` | P0 | Code `DEBUG` default False; `.env.example` sets `DEBUG=True`. Hosts/CORS are localhost. |
| HTTPS Django settings | `NOT_STARTED` | P0 | No `SECURE_SSL_REDIRECT`, HSTS, secure cookies, `SECURE_PROXY_SSL_HEADER`. |
| JWT in WS query string | `PARTIAL` | P1 | Logs / Referer leak. Naive `query.split("token=")[1]`. |
| Password validators on signup | `PARTIAL` | P1 | `AUTH_PASSWORD_VALIDATORS` configured; `SignupSerializer.create` does not run them. |
| Login throttling | `NOT_STARTED` | P2 | |

### Email / notifications (real users)

| Feature | Status | Priority | Evidence |
| --- | --- | --- | --- |
| SMTP / transactional mail | `NOT_STARTED` | P0 | Console backend unless `ENV=production` switches default to SMTP with empty credentials. Verification is required to log in. |
| Verify endpoint robustness | `PARTIAL` | P1 | Invalid token returns a Python set; `print` in `VerifyEmail`. Intent after verify is `localStorage` only. |
| Password reset mail | `NOT_STARTED` | P1 | No reset feature yet. |
| New inquiry / consultation emails | `NOT_STARTED` | P1 | No `send_mail` in inquiries/bookings. Needed when accountants are not sitting on localhost. |
| Notification center | `DEFER` | P2 | Unread inquiry dots are enough. |

### Data, static files, process

| Feature | Status | Priority | Evidence |
| --- | --- | --- | --- |
| Postgres when `ENV=production` | `PARTIAL` | P0 | `DB_*` vars; `DATABASE_URL` documented as unused. |
| Migrations on deploy | `DONE` locally | P0 | Includes `accountants.0004`. Must be applied on the server. |
| Static files / CRA build serving | `NOT_STARTED` | P0 | `STATIC_URL` only; no `STATIC_ROOT` / WhiteNoise. Admin breaks with `DEBUG=False`. |
| Docker / CI / process manager | `NOT_STARTED` | P0 | Local Daphne only. |
| Health check / logging | `NOT_STARTED` | P1 | `GET /api/` is a polls hello. No `LOGGING`. |
| Backups | `NOT_STARTED` | P1 | |
| Admin / superuser docs | `PARTIAL` | P2 | `/admin/` exists; User + Booking registered. |
| Seed / demo data | `NOT_STARTED` | P2 | |
| Deploy README | `NOT_STARTED` | P0 | Root README is local-only. |

### Authorization notes still true in production

These are **not** production-only; they already hold locally and should stay green:

- Profile/service/inquiry/booking ownership is derived from `request.user` / inquiry, not trusted body IDs.
- `IsServiceOwner` prevents mutating another accountant’s services.
- Outsiders cannot read/send on others’ inquiries (HTTP 404 / WS 4003).

Residual product/security follow-ups (Phase 2 or later P1): consultation `accountant` queryset is `User.objects.all()` (spam thread against any user); public payload still includes email (no longer used as the directory title).

## Phase 2 P0 blockers (when you return)

1. Frontend HTTP/WS still points at the visitor’s localhost.
2. `SECRET_KEY` fallback, local `ALLOWED_HOSTS`/CORS, no HTTPS settings.
3. Required email verification without production SMTP.
4. No `STATIC_ROOT`, Postgres wiring in real env, process/host, or deploy docs.
5. Chat `ws://` (needs `wss` + Redis on the host).

Recommended Phase 2 order (do not do now): API/WS env URLs → fail-closed secrets + HTTPS → SMTP → Postgres/`collectstatic`/Daphne+Redis → health/logging/README → inquiry/consultation emails → password reset.

---

## Deferred everywhere (do not do in Phase 1 or as a side quest)

- Search and extra filters
- Notification center
- In-chat request-consultation UI
- Client profile model
- Credential/license verification
- Custom 404
- Visual design pass
- Mobile chat column collapse (P2 unless you only test on phones)
- A separate Consultation model
- Using `User.is_accountant` (legacy; `AccountantProfile` is the source of truth)
