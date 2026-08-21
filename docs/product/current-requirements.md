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

The core local product loop—discover → message → share files → request consultation → accept/decline/cancel—is implemented. Deferred items are listed below.

---

## Core User Model

Every authenticated person is a **User**. Seeking tax help does not require a separate client profile. Offering services is a capability on the same account, represented by an **AccountantProfile**.

Signup creates a user account only. Homepage intent (looking for help vs tax professional) affects post-auth routing and onboarding, not a permanent role stored in the database. Details are in [signup-onboarding.md](./signup-onboarding.md).

Offering accounting services is represented by the presence of an `AccountantProfile`. `User.is_accountant` is a legacy field and is not the authoritative capability indicator.

---

## Accountant Discovery

### Current behavior

- The public directory lists complete profiles only. Completeness means non-empty bio and credentials plus at least one active service.
- A public profile shows display name (firm name as fallback), firm, location, bio, credentials, service scope when remote/nationwide, and active services.
- Incomplete profiles are omitted from the directory but may still load if opened by direct URL.
- Primary discovery is the accountant directory with an integrated map. A public services catalog lists active services only; inactive services are not publicly retrievable.
- Profiles may store optional latitude/longitude for map pins. Free-text location remains the human-readable base location. Visitors can search a place and filter map pins by fixed radius in miles.
- Accountants without coordinates still appear in the flat directory; they do not appear as pins or in radius-filtered geographic results.

### Planned

No additional discovery product features are currently required beyond the map MVP described above. Architecture and a future styleable-map evaluation note: [001-accountant-map-discovery.md](../architecture/decisions/001-accountant-map-discovery.md).

---

## Messaging and Inquiries

### Current behavior

- Clients start a conversation from a public profile or service page by sending a non-blank first message. That creates an Inquiry (or reuses a matching open one) and opens the chat workspace.
- Matching open inquiries are reused; a later contact after an Inquiry is closed starts a new Inquiry rather than reopening the closed one.
- Only the Inquiry’s client and accountant can read or send on that conversation. Closed inquiries reject new messages.
- Participants can share files on an open Inquiry: attach files when sending a chat message, or upload to the Inquiry’s shared-files library without a message. Allowed types include PDF, JPEG, PNG, and common Office documents, with a per-file size limit. Downloads require Inquiry participant authorization. JPEG, PNG, and PDF support in-chat preview via authenticated download. Architecture: [decisions.md](../architecture/decisions.md).
- Chat messages may include text, attachments, or both. Text-only sends still require non-blank content; attachment-only messages use blank content.
- Live chat uses a WebSocket when available, with HTTP send as a fallback.
- The data model supports an Inquiry status of `closed`, but the product does not yet expose a way for users to close an Inquiry. Closed inquiries remain readable and files remain downloadable.

### Planned

No additional messaging product features are currently required beyond Inquiry file sharing described above.

---

## Consultations and Bookings

### Current behavior

- Clients request a consultation from a profile or service page. That creates or reuses an open Inquiry, records an initial message, and creates a pending Booking.
- Accountants can accept or decline a pending booking. Either participant can cancel a pending or confirmed booking.
- An Inquiry may have at most one active booking (pending or confirmed). After decline or cancellation, another booking may be requested on the same Inquiry.
- Booking status changes do not end the Inquiry; participants can continue messaging while the Inquiry remains open.
- The main product path starts consultations from profile or service pages. Creating a booking on an existing open Inquiry is supported by the API; an in-chat request form is not part of the current UI.

### Planned

No additional consultation product features are currently required.

---

## Accountants and Services

### Current behavior

- Accountants complete onboarding (name, firm, location, credentials, bio, primary service) and use the accountant dashboard.
- Complete accountants can view and edit their public profile and manage owned services (list, create, edit, deactivate).
- Service pricing is indicative: fixed, hourly, or consultation-required. Indicative prices are not binding quotes.
- Shared navigation and logout are available on main app pages. Returning complete accountants land on the accountant dashboard unless a return-to path from message/consultation applies.

### Planned

No additional accountant/service product features are currently required for the next product milestone.

---

## Product Work Remaining

No intended product capabilities are currently marked unimplemented beyond deferred items below. Map discovery and Inquiry file sharing are implemented; see Messaging and Inquiries and [001-accountant-map-discovery.md](../architecture/decisions/001-accountant-map-discovery.md).

---

## Deferred Features

The following are intentionally out of the near-term product scope:

- Advanced directory filters beyond the current complete-profile list and place/radius map search
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

Production deployment remains deferred until infrastructure and deploy concerns are ready; see the deferred and production sections above.
