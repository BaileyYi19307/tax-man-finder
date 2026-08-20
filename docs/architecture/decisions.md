# Architecture decisions

Concise record of architectural product decisions. Prefer updating this file over scattering decisions across scratch notes.

Statuses:

- **Accepted** — agreed; follow this when building
- **Open** — unresolved; do not invent a solution in docs as if decided
- **Superseded** — replaced by a later decision

---

## Accepted

### Inquiry is the durable engagement workspace

**Status:** Accepted (implemented)

- One Inquiry = one client + one accountant conversation/workspace, optionally tied to a service
- Messages and bookings belong to the Inquiry
- Participant identity is the authorization boundary for chat and participant booking access
- Booking lifecycle does not end the Inquiry; after decline/cancel, another booking may be requested on the same Inquiry

Details: [`domain-model.md`](./domain-model.md).

### Accountant capability via AccountantProfile

**Status:** Accepted (implemented)

- Offering services requires an `AccountantProfile` on the same `User`
- Signup intent is routing-only, not a permanent CLIENT/ACCOUNTANT role
- No `ClientProfile` model
- `User.is_accountant` is legacy and must not remain a second source of truth for permissions

Details: [`../product/signup-onboarding.md`](../product/signup-onboarding.md).

### Indicative service pricing

**Status:** Accepted (implemented)

- `pricing_type`: fixed / hourly / consultation_required
- `indicative_price` required for fixed and hourly; optional for consultation_required
- Indicative prices are not binding quotes

### Consultation bookings are 30-minute Bookings on an Inquiry

**Status:** Accepted (implemented)

- Client selects `starts_at`; `ends_at = starts_at + 30 minutes`
- Statuses: pending / confirmed / declined / cancelled
- At most one active (pending|confirmed) booking per Inquiry

### Profile completeness for public directory

**Status:** Accepted (implemented)

- Complete = non-empty `bio` + `credentials` + ≥1 active service
- `years_experience` is collected but not required for completeness (earlier draft domain text that required it is superseded by this implemented rule)

### Inquiry-owned shared documents

**Status:** Accepted — **not yet implemented**

When file sharing is implemented:

- `Inquiry` remains the durable workspace
- Attachments belong to `Inquiry`
- An attachment may optionally be associated with a `Message` for timeline presentation
- Attachments do **not** belong to `Booking`
- Do **not** introduce a separate `Workspace` model merely for file sharing
- Booking status transitions must **not** determine attachment lifetime (files survive decline, cancel, confirm, and later booking requests on the same Inquiry)

Do not treat this as shipped. Product gap: [`../product/current-requirements.md`](../product/current-requirements.md).

---

## Open

### Map-based accountant discovery

**Status:** Open (required product gap; design not locked here)

- Location is currently free-text on `AccountantProfile`
- Map/geocoding/search approach is not specified in this file

### File-only chat messages (when implementing attachments)

**Status:** Open (implementation detail under the accepted Inquiry-owned attachments decision)

- Today `Message.content` cannot be blank
- How file-only timeline rows are represented (empty content allowed with attachments vs other approach) is decided at implementation time; follow Inquiry/Message authorization patterns

### Closing an Inquiry from the product

**Status:** Open / deferred

- `closed` status and send/booking guards exist
- No HTTP API or UI to close an Inquiry yet

---

## Superseded

### Signup role creates AccountantProfile immediately

**Superseded by:** Accountant capability via AccountantProfile (intent + later onboarding)

### Separate Conversation model / inquiry statuses `responded` | `booked`

**Superseded by:** Inquiry `open` | `closed` with Messages directly on Inquiry

### Binding `Service.price` as the only pricing field

**Superseded by:** Indicative pricing (`pricing_type` + `indicative_price`)
