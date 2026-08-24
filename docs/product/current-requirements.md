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

The core local product loop—discover → message → share files → request consultation → accept/decline (and pay when required) → cancel—is implemented. Deferred items are listed below.

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

- Clients start a conversation from a public profile or service page by sending a non-blank first message. That creates an Inquiry (or reuses the open Inquiry for that client–accountant pair) and opens the chat workspace.
- Matching open inquiries are reused by client–accountant pair regardless of service; a later contact after an Inquiry is closed starts a new Inquiry rather than reopening the closed one.
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

- Clients request a consultation from a profile or service page, or from an open chat. That creates or reuses an open Inquiry, records an initial message, and creates a pending Booking.
- When a Booking is created, the selected service’s consultation fee and cancellation policy are **snapshotted** onto the Booking. Later edits to the Service do not change existing Bookings.
- Accountants can accept or decline a pending booking. Either participant can cancel a pending, awaiting-payment, or confirmed booking.
- An Inquiry may have at most one active booking (pending, awaiting payment, or confirmed). After decline or cancellation, another booking may be requested on the same Inquiry.
- Booking status changes do not end the Inquiry; participants can continue messaging while the Inquiry remains open.
- In chat, the client sees **Request consultation** when the inquiry is open and has no active booking.

### Free vs paid consultation

- A consultation fee is a fee for the scheduled consultation itself, not a deposit toward later accounting work.
- **Free consultation:** accountant accepts → Booking becomes `confirmed`. No Payment is created.
- **Paid consultation:** accountant accepts → Booking becomes `awaiting_payment` and a pending Payment is created from the Booking fee snapshot. The client must complete payment before the meeting. After payment succeeds → Booking becomes `confirmed`.
- Payment state is separate from Booking state. Changing Booking status alone does not prove money moved.
- After a paid consultation ends (`ends_at` has passed), a paid Payment may become `payable`, meaning funds are eligible for accountant payout. No real bank transfer or payout product is implemented yet.
- The current client payment action is an explicit **Complete Demo Payment** flow. It does not collect card data and does not move real money. Production payment is planned as Stripe Connect with Stripe-hosted onboarding and checkout; webhooks would call the same payment domain transitions used by the demo action.

### Awareness when returning to the app

- Booking lifecycle changes (accept, decline, payment completed, cancel) post concise **system timeline messages** in the Inquiry chat. They are visually distinct from ordinary chat and persist after refresh/re-login; unread follows the existing conversation read-state model.
- Header **Consultations** and **Messages** links show counts when there is actionable work (for example pending requests, payment required, or unread messages).
- Client and accountant dashboards show a **Needs attention** section (and **Upcoming** for confirmed future consultations) derived from existing Booking and Inquiry unread data. There is no separate notification system, email alerts for booking events, or push notifications.

### Planned

No additional consultation product features are currently required beyond the deferred payment production integration below.

---

## Accountants and Services

### Current behavior

- Accountants complete onboarding (name, firm, location, credentials, bio, primary service) and use the accountant dashboard.
- Complete accountants can view and edit their public profile and manage owned services (list, create, edit, deactivate).
- Service pricing is indicative: fixed, hourly, or consultation-required. Indicative prices are not binding quotes.
- Each service also configures whether its consultation is free or paid. Paid consultations require a consultation fee greater than zero. Accountants may set a descriptive cancellation policy on the service.
- Shared navigation and logout are available on main app pages. Returning complete accountants land on the accountant dashboard unless a return-to path from message/consultation applies.

### Planned

No additional accountant/service product features are currently required for the next product milestone.

---

## Product Work Remaining

No intended product capabilities are currently marked unimplemented beyond deferred items below. Map discovery, Inquiry file sharing, consultation fees with demo payment, and lightweight attention indicators are implemented; see sections above and [001-accountant-map-discovery.md](../architecture/decisions/001-accountant-map-discovery.md).

---

## Deferred Features

The following are intentionally out of the near-term product scope:

- Advanced directory filters beyond the current complete-profile list and place/radius map search
- Password reset
- User-facing close-inquiry flow
- A separate client profile model
- Credential or license verification beyond email verification and profile fields
- Custom 404 page
- Broader visual design and mobile chat layout polish
- Real Stripe Connect / Checkout / webhooks, refunds, disputes, platform fees, invoices, and accountant payout transfers
- Reviews, saved accountants, formal quotes, and RFI-style workflows
- Product email or push notifications for messages and booking lifecycle events

---

## Production Readiness

Hosting, HTTPS, production email (SMTP), hardened secrets and CORS, production database, static asset serving, and deploy runbooks are **infrastructure concerns**, separate from the product features above. Local development currently uses console email and localhost API/WebSocket URLs; see the root [README.md](../../README.md) for running the stack.

Production deployment remains deferred until infrastructure and deploy concerns are ready; see the deferred and production sections above.
