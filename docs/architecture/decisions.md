# Architecture decisions

Record of meaningful architectural choices. Status values:

- **Accepted** — current guidance for the system
- **Open** — not yet decided
- **Superseded** — replaced by a later decision

Related domain detail: [domain-model.md](./domain-model.md). Product status: [../product/current-requirements.md](../product/current-requirements.md).

---

## Accepted

### Inquiry as the engagement workspace

**Status:** Accepted (implemented)  
**Date:** 2026-08-20

**Context**

Clients and accountants often communicate before any consultation exists. A booking may be confirmed, declined, or cancelled without ending the relationship, and another consultation may be requested later in the same thread.

**Decision**

`Inquiry` represents the durable engagement workspace between one client and one accountant. Service context belongs on Booking, not on Inquiry.

**Consequences**

- Messages belong to the Inquiry.
- Bookings represent appointments within the Inquiry.
- Shared attachments belong to the Inquiry.
- Booking lifecycle changes do not end the workspace.
- A separate Workspace model is unnecessary because Inquiry already defines that boundary.
- Participant identity on the Inquiry is the authorization boundary for chat and participant booking access.

---

### Accountant capability via AccountantProfile

**Status:** Accepted (implemented)  
**Date:** 2026-08-20

**Context**

Early designs treated client and accountant as mutually exclusive signup roles. The product needs a single account that can seek help, offer services later, or do both in different engagements.

**Decision**

Offering services is a capability on a normal `User`, represented by an `AccountantProfile`. Signup intent only influences routing and onboarding. There is no `ClientProfile` model.

**Consequences**

- Signup creates a User only.
- Permissions for accountant actions check for an AccountantProfile.
- `User.is_accountant` remains as a legacy field and is not the authoritative capability indicator.

---

### Indicative service pricing

**Status:** Accepted (implemented)  
**Date:** 2026-08-20

**Context**

Some offerings have a predictable fee; others cannot be priced until the accountant understands scope.

**Decision**

Services use `pricing_type` (`fixed`, `hourly`, `consultation_required`) plus optional `indicative_price`. Prices are indicative, not binding quotes. Fixed and hourly require an indicative price; consultation-required may omit it.

---

### Consultation bookings are fixed-duration appointments on an Inquiry

**Status:** Accepted (implemented)  
**Date:** 2026-08-20

**Context**

The MVP consultation is a short scheduled call that needs accountant approval, without becoming a full calendar product.

**Decision**

A consultation is a `Booking` on an Inquiry. The client selects `starts_at`; `ends_at` is start plus 30 minutes. Statuses include pending, awaiting payment, confirmed, declined, and cancelled. At most one active (pending, awaiting payment, or confirmed) booking exists per Inquiry.

---

### Consultation fee snapshots and Payment separate from Booking

**Status:** Accepted — implemented (MVP demo processor)  
**Date:** 2026-08-23

**Context**

Accountants may offer free or paid consultations. The fee must survive later Service price edits. Client payment and accountant payout eligibility are separate events. Production should use Stripe Connect later without rewriting Booking lifecycle rules.

**Decision**

- Service stores `consultation_fee` and descriptive `cancellation_policy`.
- Booking snapshots fee and policy at request time.
- Free accept → Booking `confirmed`. Paid accept → Booking `awaiting_payment` plus a pending `Payment` derived from the snapshot.
- Domain payment service owns pending → paid (and Booking confirm) and paid → payable after `ends_at`. Demo completion and a future Stripe webhook should call the same transitions.
- `processor_reference` is an opaque nullable external id; core Payment status names stay processor-agnostic.
- No Stripe SDK, Connect models, or real card collection in this MVP.

**Consequences**

- UI exposes Complete Demo Payment only; no fake card forms.
- Payable means payout-eligible, not transferred.
- Attention badges and dashboard “Needs attention” surface existing Booking/unread state without a notification platform.

---

### Profile completeness for public directory

**Status:** Accepted (implemented)  
**Date:** 2026-08-20

**Context**

The directory should show accountants who are ready to be contacted, without requiring every optional field.

**Decision**

A profile is complete when `bio` and `credentials` are present and the accountant has at least one active service. Years of experience, firm name, and location may be collected and displayed but are not required for completeness.

---

### Inquiry-owned shared documents

**Status:** Accepted — implemented (MVP)  
**Date:** 2026-08-20

**Context**

Participants need to exchange documents as part of an engagement. Documents may be introduced through chat, but they outlive any single booking. Booking decline, cancellation, confirmation, and later booking requests on the same Inquiry must not discard shared files. Inquiry already defines the durable client–accountant boundary.

**Decision**

- Attachments are owned by `Inquiry`.
- An attachment may optionally be associated with a `Message` for timeline presentation.
- Attachments are not owned by `Booking`.
- No separate Workspace entity is introduced for file sharing.
- A chat message may have blank `content` when it has one or more attachments; text-only messages still require non-blank content.

**Consequences**

- File lifetime follows the Inquiry, independent of booking status.
- Authorization for attachments aligns with Inquiry participant rules (same boundary as messages).
- Participants can upload into an Inquiry shared-files library without creating a Message, or attach files when sending a Message.
- Downloads go through authenticated Inquiry-scoped endpoints; the product does not expose permanent public file URLs for marketplace documents.

Product status: [current-requirements.md](../product/current-requirements.md). Domain: [domain-model.md](./domain-model.md).

---

## Accepted

### Map-based accountant discovery

**Status:** Accepted — implemented (MVP)  
**Date:** 2026-08-20

Flat-list vs map eligibility, fixed-radius search, remote/nationwide service scope, current Leaflet/OSM/Nominatim architecture, and a future styleable-map evaluation note are recorded in [decisions/001-accountant-map-discovery.md](./decisions/001-accountant-map-discovery.md).

---

## Open

### Closing an Inquiry from the product

**Status:** Open  
**Date:** 2026-08-20

Closed status and send/booking guards exist. There is no user-facing close flow or dedicated close API yet.

---

## Superseded

### Signup role creates AccountantProfile immediately

Replaced by accountant capability via AccountantProfile (intent plus later onboarding).

### Separate Conversation model and Inquiry statuses `responded` / `booked`

Replaced by Inquiry `open` / `closed` with Messages belonging directly to the Inquiry.

### Single binding `Service.price` field

Replaced by indicative pricing (`pricing_type` + `indicative_price`).
