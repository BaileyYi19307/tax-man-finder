# Current product requirements

What TaxManFinder is expected to do. Statements under **Implemented** describe behavior that exists in the repository today. Do not treat historical roadmaps or wireframes as requirements unless they appear here or in an [accepted decision](../architecture/decisions.md).

Signup, intent, and onboarding rules live in [`signup-onboarding.md`](./signup-onboarding.md) — this file links to that doc rather than repeating those rules.

Domain semantics for Inquiry / Message / Booking live in [`../architecture/domain-model.md`](../architecture/domain-model.md).

---

## Product shape

TaxManFinder is a marketplace that connects people looking for tax help with accountants.

- Every authenticated person is a **User**. Looking for help does not require a separate client profile.
- Offering services requires an **AccountantProfile** on that same user (a capability, not a permanent role).
- Visitors may browse public accountant listings without an account.
- Authentication is required to message an accountant or request a consultation.
- An **Inquiry** is the durable client–accountant engagement (conversation and workspace). Consultations are **Bookings** attached to an Inquiry.

---

## Implemented / current behavior

### Public discovery

- Public accountant directory lists **complete** profiles only (bio + credentials + at least one active service).
- Public profile shows name (firm as fallback), firm, location, bio, credentials, and active services.
- Direct profile URLs may still load an incomplete profile if it exists; incomplete profiles are not listed in the directory.
- Public service catalog (`/services`) lists active services only; discovery for the MVP centers on the accountant directory.
- Service detail is public for active services; inactive services are not publicly retrievable.

### Account and capability

- Signup creates a `User` (email + password) with email verification required before login.
- Signup does **not** create an `AccountantProfile` or assign a permanent client/accountant role.
- Intent cards and post-auth routing: see [`signup-onboarding.md`](./signup-onboarding.md).
- Accountants complete onboarding (name, firm, location, credentials, bio, primary service), then use the accountant dashboard.
- Complete accountants can view/edit their profile and manage owned services (list, create, edit, deactivate).
- Shared navigation and logout exist on main app pages; returning complete accountants land on the accountant dashboard (unless a return-to `next` path applies).

### Messaging (Inquiry)

- Clients start a conversation from a public profile or service with a required non-blank first message (`POST /api/inquiries/`).
- Matching **open** inquiries are reused; closed inquiries are not revived (a later contact creates a new Inquiry).
- Participants only: outsider access is denied (HTTP 404 for inquiry/message surfaces; WebSocket reject for non-participants).
- Further messages: WebSocket preferred; HTTP fallback when the socket is not open.
- Blank messages are rejected. Messages cannot be sent to a **closed** Inquiry.
- There is currently **no product UI or HTTP API** to close an Inquiry; `closed` is enforced when status is set (for example in tests/admin).

### Consultations (Booking on Inquiry)

- Request consultation from profile/service creates or reuses an open Inquiry, records an initial message, and creates a **pending** Booking.
- Accountant may **accept** or **decline** a pending booking; either participant may **cancel** a pending or confirmed booking.
- At most one **active** booking (pending or confirmed) per Inquiry. After decline or cancel, another booking may be requested on the same Inquiry.
- Booking status changes do **not** close the Inquiry; messaging continues while the Inquiry is open.
- In-chat “request consultation” UI is not required; the API can attach a booking to an existing Inquiry, but the product path is profile/service.

### Local MVP completeness

The local discovery → message → consultation → booking loop is feature-complete for development on localhost (console email verification, Daphne + Redis or in-memory channel layer). See the acceptance-style checklist under **Deferred / later work** for production hosting items that are intentionally not part of this local product bar.

---

## Required before moving on (product gaps)

These are **not implemented**. They are the known product work to tackle before treating the product as complete for the next major phase (separate from production hosting).

1. **Map-based accountant discovery** — location is a free-text string on `AccountantProfile` today; there is no map, geocoding, or location search.
2. **File / document sharing** — clients and accountants cannot share files on an Inquiry yet. Architecture for when this is built is recorded as an accepted decision in [`../architecture/decisions.md`](../architecture/decisions.md) (**Accepted — not yet implemented**).

Do not describe either as shipped.

---

## Deferred / later work

### Explicitly deferred product features

- Search / extra directory filters (beyond the current complete-profile list)
- In-chat request-consultation form
- Password reset
- Close-inquiry UI/API
- Client profile model (do not invent one)
- Credential/license verification beyond email + profile fields
- Custom 404 page
- Visual design pass / mobile chat layout polish
- Payments, reviews, saved accountants, formal quotes, RFI workflows

### Production readiness (parked)

Parked until product gaps above (and any other agreed product work) are in a coherent place. Local `127.0.0.1` URLs are acceptable for development.

When returning to hosting:

- Frontend HTTP/WebSocket still hardcode localhost in places; need env-based API/`wss` origins
- Fail-closed `SECRET_KEY`, production `ALLOWED_HOSTS` / CORS, HTTPS Django settings
- Real SMTP (verification currently relies on console email locally)
- Postgres wiring for production, static files / CRA build serving, process manager / deploy docs
- Health checks, logging, backups
- Transactional email for new inquiry / consultation (optional but needed when users are not co-located on localhost)

Residual notes (already true locally; stay true in production): ownership is derived from `request.user` / Inquiry participants, not trusted body IDs; outsiders cannot read others’ inquiries.

---

## Out of scope reminders

- Do not parent shared files to Booking or invent a separate Workspace model for file sharing (see decisions).
- Do not treat `User.is_accountant` as the source of truth for offering services; use `AccountantProfile` presence.
