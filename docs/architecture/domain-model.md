# Domain model

Technical description of the marketplace domain as implemented in this repository. Product status and planned work: [../product/current-requirements.md](../product/current-requirements.md). Decision rationale: [decisions.md](./decisions.md).

---

## Overview

TaxManFinder connects people seeking tax help with accountants.

| Concept | Meaning |
| --- | --- |
| **User** | Every authenticated person |
| **Client** | A user acting as the client on a given Inquiry or Booking (not a separate table) |
| **Accountant** | A user who has an AccountantProfile and may offer Services |
| **Inquiry** | Durable engagement between one client and one accountant (conversation and workspace) |
| **Message** | A communication event on an Inquiry |
| **Attachment** | An Inquiry-owned shared file; optionally linked to a Message for the chat timeline |
| **Booking** | A scheduled consultation appointment belonging to an Inquiry |
| **Payment** | Client payment record for a paid consultation Booking (separate from Booking status) |

A user may be a client in some engagements and an accountant in others, but never both parties on the same Inquiry or Booking.

Authorization for chat, shared files, and participant booking actions is scoped to the Inquiry’s two participants.

---

## User

A User is the shared identity used for authentication and for participation in engagements.

**Relationships**

- May optionally have one AccountantProfile
- May own Services when acting as an accountant
- May appear as client or accountant on Inquiries and Bookings
- May send Messages
- May upload Attachments on Inquiries where they are a participant

**Lifecycle**

- Created at signup with email and password
- Must verify email before login
- Signup does not create an AccountantProfile or assign a permanent marketplace role

**Invariants**

- Email is unique
- There is no ClientProfile model
- Accountant eligibility is determined by the presence of an AccountantProfile
- `User.is_accountant` exists as a legacy column; product permissions and routing use AccountantProfile presence instead

**Fields**

```text
id, email, password, first_name, last_name, phone_number,
is_active, is_verified, is_mobile_verified, is_accountant,
date_joined, updated_at
```

---

## AccountantProfile

Stores professional information for users who offer accounting services and marks that capability on the User account.

**Relationships**

- Belongs to exactly one User
- A User has at most one AccountantProfile

**Lifecycle**

- Created or updated during accountant onboarding for the authenticated user
- May create an initial Service when onboarding supplies a primary service and the user has none yet
- Later edits update the same profile rather than creating another

**Completeness**

A profile is complete for public directory listing when:

- `bio` and `credentials` are non-empty, and
- the user has at least one active Service

`years_experience`, `firm_name`, and `location` are stored and shown when present; they are not required for completeness. Optional `latitude` and `longitude` enable map pins and fixed-radius search; they do not affect directory completeness. `service_scope` (`local`, `remote`, `nationwide`) describes how the accountant serves clients and is separate from the map pin. A Boolean `profile_complete` column exists in the database; APIs and listing logic use the computed completeness property instead.

**Public visibility**

- The directory lists complete profiles only
- Profile detail by id may return an incomplete profile if it exists
- Map pins and geographic radius results include only complete profiles that also have both coordinates (`is_map_eligible`)

**Fields**

```text
id, user_id, years_experience, credentials, bio,
firm_name, location, latitude, longitude, service_scope,
profile_complete, created_at, updated_at
```

Map discovery behavior and presentation architecture: [decisions/001-accountant-map-discovery.md](./decisions/001-accountant-map-discovery.md).

---

## Service

A Service is an offering listed by an accountant, with indicative (non-binding) pricing.

**Relationships**

- Owned by a User who has an AccountantProfile
- May optionally be referenced by a Booking

**Lifecycle**

- Created during onboarding or from My Services
- May be edited by the owning accountant
- Deactivation (`is_active = false`) hides the service from public list and retrieve; the owner can still see it in their managed list

**Invariants**

- `pricing_type` is one of `fixed`, `hourly`, or `consultation_required`
- `indicative_price` is required for fixed and hourly; optional for consultation-required
- `consultation_fee` is null or zero for a free consultation; paid consultations require a fee greater than zero
- `cancellation_policy` is optional descriptive text (no automatic refund calculation in the MVP)
- Consultation fee is distinct from `indicative_price` (service work estimate, not a deposit)
- Mutations are limited to the owning accountant; create always assigns the authenticated user as owner

**Fields**

```text
id, accountant_id, name, description, pricing_type,
indicative_price, consultation_fee, cancellation_policy,
is_active, created_at, updated_at
```

---

## Inquiry

An Inquiry represents the durable engagement between a client and an accountant. It is the conversation thread and the workspace for that relationship.

**Relationships**

- Belongs to one client User and one accountant User
- Contains Messages
- Contains Booking history (each Booking may reference a Service)
- Contains shared Attachments ([decisions.md](./decisions.md))

**Lifecycle**

- Status is `open` (default) or `closed`
- Created when a client sends a non-blank first message from a profile or service entry point, or when a matching open Inquiry is reused and a new message is appended
- Opening a message composer without sending does not create an Inquiry
- Booking confirmation, decline, cancellation, and later booking requests do not change Inquiry status or end the engagement
- Closed inquiries reject new messages and new bookings; a later contact creates a new Inquiry instead of reusing the closed one
- Users cannot currently close an Inquiry through the product UI or a dedicated API; closed-status enforcement exists when status is set

**Reuse rules**

- At most one open Inquiry per client–accountant pair
- Service selection does not create or partition conversations; messaging from different services reuses the same open Inquiry
- Service context belongs on Booking for each consultation request

**Authorization**

- Only the two participants may read or send on the Inquiry
- Non-participants receive not-found responses on HTTP inquiry surfaces and are rejected on the chat WebSocket

**Invariants**

- `client_id ≠ accountant_id`
- At most one open Inquiry for a given `(client, accountant)` pair

**Fields**

```text
id, status, client_id, accountant_id,
created_at, updated_at
```

---

## Message

A Message is a communication event within an Inquiry. Most messages are ordinary chat; Booking lifecycle notices use the same model with `is_system=True` so they appear in the Inquiry timeline, reuse ConversationReadState unread rules, and survive refresh without a separate notification system.

**Relationships**

- Belongs to one Inquiry
- Has one sender (must be an Inquiry participant; for system notices, the acting participant)
- May have zero or more Attachments

**Lifecycle**

- Created with the Inquiry’s first message, or appended when an open Inquiry is reused
- Further messages may be sent over WebSocket or HTTP while the Inquiry is open
- Booking accept / decline / payment success / cancel may append a system timeline notice
- Messages are not edited or deleted in the current product

**Invariants**

- Content may be blank when the message has at least one attachment; text-only messages require non-blank content
- Sender is the Inquiry client or accountant
- `is_system` messages are not ordinary chat bubbles in the UI; clients cannot create them via chat send
- Closed inquiries reject new messages

**Fields**

```text
id, inquiry_id, sender_id, content, is_system, created_at
```

Inbox unread behavior may track last-read state; there is no separate Conversation entity.

---

## Attachment

An Attachment is an Inquiry-owned file shared between the engagement’s participants. Lifetime follows the Inquiry, not any Booking.

**Relationships**

- Belongs to one Inquiry
- Has one uploader (must be an Inquiry participant)
- May optionally reference one Message (chat timeline presentation); library uploads omit `message`

**Lifecycle**

- Created when a participant uploads via the Inquiry attachments API (no Message) or when sending a Message with files
- Downloadable by either participant while they can access the Inquiry; closed inquiries still allow download
- Not owned by Booking; booking status changes do not remove attachments

**Invariants**

- Uploader is the Inquiry client or accountant
- File type and size are validated at upload (PDF, JPEG, PNG, and common Office documents; per-file size limit)
- Authorization matches Inquiry participant rules

**Fields**

```text
id, inquiry_id, uploaded_by_id, message_id (nullable),
file, original_filename, uploaded_at
```

---

## Booking

A Booking is a scheduled consultation between the Inquiry’s client and accountant. It is an appointment inside the engagement, not a replacement for the Inquiry workspace.

**Relationships**

- Belongs to exactly one Inquiry
- Client and accountant match the Inquiry’s parties (derived from the Inquiry at creation)
- Optional Service selected for this consultation (fee/policy snapshotted from that Service)
- May have at most one Payment (paid consultations only)

**Lifecycle**

- Created as `pending` when a client requests a consultation (from profile/service/chat, or via API on an existing open Inquiry with no active booking)
- Duration is fixed at 30 minutes: `ends_at = starts_at + 30 minutes`
- On create, `consultation_fee` and `cancellation_policy` are snapshotted from the Service selected for that request (or free defaults when no service)
- Accountant may decline (`declined`) a pending booking
- Accountant may accept a pending booking:
  - Free fee snapshot → `confirmed`
  - Paid fee snapshot → `awaiting_payment` and a pending Payment is created from the snapshot amount
- Client demo payment success (or a future Stripe webhook calling the same domain service) moves Payment to `paid` and Booking to `confirmed`
- Either participant may cancel a pending, awaiting-payment, or confirmed booking (`cancelled`)
- After decline or cancel, another booking may be requested on the same Inquiry

**Invariants**

- At most one active booking per Inquiry (`pending`, `awaiting_payment`, or `confirmed`)
- Slot-held statuses for accountant overlap are `awaiting_payment` and `confirmed`
- Booking status changes do not close the Inquiry
- Payment amount is always derived from the Booking fee snapshot, never from a client-supplied amount

**Fields**

```text
id, status, inquiry_id, client_id, accountant_id,
service_id (nullable), starts_at, ends_at,
consultation_fee, cancellation_policy,
created_at, updated_at
```

---

## Payment

A Payment records consultation-fee collection for one Booking. It is intentionally separate from Booking status so a status change alone never implies money moved.

**Relationships**

- Belongs to exactly one Booking (one-to-one)

**Lifecycle**

- Created as `pending` when a paid consultation is accepted
- Demo completion (client-only) or a future processor webhook calls domain logic to mark payment succeeded → `paid` with `paid_at`, and confirms the Booking
- After the consultation ends (`now >= ends_at`), a paid Payment may become `payable` with `payable_at` (payout eligibility only; no transfer is performed)
- Optional `processor_reference` holds an opaque external id for a future processor; the core domain avoids provider-specific field names

**Invariants**

- Only the Booking’s client may complete the demo payment action
- Accountants and outsiders cannot mark client payment successful
- Amount and currency come from the Booking snapshot / Payment row, not request body overrides

**Fields**

```text
id, booking_id, amount, currency, status,
paid_at, payable_at, processor_reference,
created_at, updated_at
```

---

## Relationship diagram

```text
User
 ├── (optional) AccountantProfile
 ├── (as accountant) Service
 ├── (as client or accountant) Inquiry
 ├── (as sender) Message
 ├── (as uploader) Attachment
 └── (as client or accountant) Booking
      └── (optional) Payment

Inquiry → User (client), User (accountant)
Message → Inquiry
Attachment → Inquiry, Message?
Booking → Inquiry, Service?
Payment → Booking
```

---

## Entry flows

### Starting a conversation

Profile “Message accountant” and service-page messaging share one create/reuse path: required first message content, optional service only to identify the accountant, then navigation to `/chat/<inquiry_id>` (one open Inquiry per client–accountant pair).

### Requesting a consultation

From profile, service, or open chat, the client chooses a start time and supplies a brief note. The system creates or reuses an open Inquiry, stores the note as a message, creates a pending Booking with fee/policy snapshots, and opens the Inquiry chat. Accept/decline, payment required, and status appear in the conversation and on `/bookings`. Demo payment uses `/bookings/<id>/pay`.

---

## Authorization summary

| Surface | Rule |
| --- | --- |
| Inquiry list, detail, messages | Authenticated participant; others not found |
| Send message | Participant and open Inquiry (text and/or attachments) |
| Inquiry attachments list/upload/download | Authenticated participant; upload requires open Inquiry |
| Chat WebSocket | Authenticated participant; closed Inquiry rejects send |
| Bookings | Participant access; accept/decline restricted to accountant |
| Demo payment | Booking client only; amount from Booking snapshot |
| Service mutations | Accountant profile and ownership |
| Public directory, profile, active services | Public read with completeness / active filters above |
