# Current Product Requirements

Product behavior and status for TaxManFinder. Related reading:

- Signup and onboarding: [signup-onboarding.md](./signup-onboarding.md)
- Domain model: [../architecture/domain-model.md](../architecture/domain-model.md)
- Architecture decisions: [../architecture/decisions.md](../architecture/decisions.md)
- Local development setup: [../../README.md](../../README.md)

---

## Product Overview

TaxManFinder is a marketplace that connects people seeking tax help with accountants who offer services.

Visitors can browse public accountant listings without an account. Messaging an accountant or requesting a consultation requires authentication. The durable relationship between a client and an accountant is an **Inquiry**; scheduled consultations are **Bookings** attached to that Inquiry.

The core local product loop—discover → message → request consultation → accept/decline/cancel—is implemented. Remaining product work and deferred items are listed below.

---

## Core User Model

Every authenticated person is a **User**. Seeking tax help does not require a separate client profile. Offering services is a capability on the same account, represented by an **AccountantProfile**.

Signup creates a user account only. Homepage intent (looking for help vs tax professional) affects post-auth routing and onboarding, not a permanent role stored in the database. Details are in [signup-onboarding.md](./signup-onboarding.md).

Offering accounting services is represented by the presence of an `AccountantProfile`. `User.is_accountant` is a legacy field and is not the authoritative capability indicator.

---

## Accountant Discovery

### Current behavior

- The public directory lists complete profiles only. Completeness means non-empty bio and credentials plus at least one active service.
- A public profile shows display name (firm name as fallback), firm, location, bio, credentials, and active services.
- Incomplete profiles are omitted from the directory but may still load if opened by direct URL.
- Primary discovery is the accountant directory. A public services catalog lists active services only; inactive services are not publicly retrievable.
- Location on a profile is free-text. There is no map, geocoding, or location-based search.

### Planned

- **Map-based accountant discovery**, so visitors can find accountants by geography rather than browsing a flat directory alone.

---

## Messaging and Inquiries

### Current behavior

- Clients start a conversation from a public profile or service page by sending a non-blank first message. That creates an Inquiry (or reuses a matching open one) and opens the chat workspace.
- Matching open inquiries are reused; a later contact after an Inquiry is closed starts a new Inquiry rather than reopening the closed one.
- Only the Inquiry’s client and accountant can read or send on that conversation. Blank messages are rejected. Closed inquiries reject new messages.
- Live chat uses a WebSocket when available, with HTTP send as a fallback.
- The data model supports an Inquiry status of `closed`, but the product does not yet expose a way for users to close an Inquiry.

### Planned

- **File and document sharing** on an Inquiry, so participants can exchange documents as part of the engagement. Ownership and lifetime of shared files follow the Inquiry workspace model described in [decisions.md](../architecture/decisions.md) (accepted architecture; not built yet).

---

## Consultations and Bookings

### Current behavior

- Clients request a consultation from a profile or service page. That creates or reuses an open Inquiry, records an initial message, and creates a pending Booking.
- Accountants can accept or decline a pending booking. Either participant can cancel a pending or confirmed booking.
- An Inquiry may have at most one active booking (pending or confirmed). After decline or cancellation, another booking may be requested on the same Inquiry.
- Booking status changes do not end the Inquiry; participants can continue messaging while the Inquiry remains open.
- The main product path starts consultations from profile or service pages. Creating a booking on an existing open Inquiry is supported by the API; an in-chat request form is not part of the current UI.

### Planned

No additional consultation product features are currently required beyond the engagement work listed under Product Work Remaining (shared documents may appear in the same chat workspace).

---

## Accountants and Services

### Current behavior

- Accountants complete onboarding (name, firm, location, credentials, bio, primary service) and use the accountant dashboard.
- Complete accountants can view and edit their public profile and manage owned services (list, create, edit, deactivate).
- Service pricing is indicative: fixed, hourly, or consultation-required. Indicative prices are not binding quotes.
- Shared navigation and logout are available on main app pages. Returning complete accountants land on the accountant dashboard unless a return-to path from message/consultation applies.

### Planned

No additional accountant/service product features are currently required for the next product milestone beyond discovery and file sharing.

---

## Product Work Remaining

These capabilities are part of the intended product and are **not yet implemented**:

1. **Map-based accountant discovery** — see Accountant Discovery → Planned.
2. **File / document sharing on an Inquiry** — see Messaging and Inquiries → Planned; architecture in [decisions.md](../architecture/decisions.md).

---

## Deferred Features

The following are intentionally out of the near-term product scope:

- Directory search and advanced filters beyond the current complete-profile list
- In-chat “request consultation” UI
- Password reset
- User-facing close-inquiry flow
- A separate client profile model
- Credential or license verification beyond email verification and profile fields
- Custom 404 page
- Broader visual design and mobile chat layout polish
- Payments, reviews, saved accountants, formal quotes, and RFI-style workflows

---

## Production Readiness

Hosting, HTTPS, production email (SMTP), hardened secrets and CORS, production database, static asset serving, and deploy runbooks are **infrastructure concerns**, separate from the product features above. Local development currently uses console email and localhost API/WebSocket URLs; see the root [README.md](../../README.md) for running the stack.

Production deployment remains deferred until the remaining product work is in a coherent place.
