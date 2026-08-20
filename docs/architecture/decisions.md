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

`Inquiry` represents the durable engagement workspace between one client and one accountant (optionally tied to a service).

**Consequences**

- Messages belong to the Inquiry.
- Bookings represent appointments within the Inquiry.
- Shared attachments will belong to the Inquiry when file sharing is built.
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

A consultation is a `Booking` on an Inquiry. The client selects `starts_at`; `ends_at` is start plus 30 minutes. Statuses are pending, confirmed, declined, and cancelled. At most one active (pending or confirmed) booking exists per Inquiry.

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

**Status:** Accepted — not yet implemented  
**Date:** 2026-08-20

**Context**

Participants need to exchange documents as part of an engagement. Documents may be introduced through chat, but they outlive any single booking. Booking decline, cancellation, confirmation, and later booking requests on the same Inquiry must not discard shared files. Inquiry already defines the durable client–accountant boundary.

**Decision**

When file sharing is built:

- Attachments are owned by `Inquiry`.
- An attachment may optionally be associated with a `Message` for timeline presentation.
- Attachments are not owned by `Booking`.
- No separate Workspace entity is introduced for file sharing.

**Consequences**

- File lifetime follows the Inquiry, independent of booking status.
- Authorization for attachments aligns with Inquiry participant rules (same boundary as messages).
- How file-only chat rows are represented (for example empty message content with attachments) remains an open implementation detail under this decision.

Product status: [current-requirements.md](../product/current-requirements.md).

---

## Open

### Map-based accountant discovery

**Status:** Open  
**Date:** 2026-08-20

Location is free-text on `AccountantProfile` today. Map, geocoding, and search approach are not specified yet. This capability is listed as remaining product work.

### Representation of file-only chat messages

**Status:** Open  
**Date:** 2026-08-20

Message content is currently required to be non-blank. Under Inquiry-owned attachments, the exact representation of attachment-only timeline entries is still undecided.

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
