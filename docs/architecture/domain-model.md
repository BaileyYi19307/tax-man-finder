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
| **Booking** | A scheduled consultation appointment belonging to an Inquiry |

A user may be a client in some engagements and an accountant in others, but never both parties on the same Inquiry or Booking.

Authorization for chat and participant booking actions is scoped to the Inquiry’s two participants.

---

## User

A User is the shared identity used for authentication and for participation in engagements.

**Relationships**

- May optionally have one AccountantProfile
- May own Services when acting as an accountant
- May appear as client or accountant on Inquiries and Bookings
- May send Messages

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

`years_experience`, `firm_name`, and `location` are stored and shown when present; they are not required for completeness. A Boolean `profile_complete` column exists in the database; APIs and listing logic use the computed completeness property instead.

**Public visibility**

- The directory lists complete profiles only
- Profile detail by id may return an incomplete profile if it exists

**Fields**

```text
id, user_id, years_experience, credentials, bio,
firm_name, location, profile_complete, created_at, updated_at
```

---

## Service

A Service is an offering listed by an accountant, with indicative (non-binding) pricing.

**Relationships**

- Owned by a User who has an AccountantProfile
- May optionally be referenced by an Inquiry

**Lifecycle**

- Created during onboarding or from My Services
- May be edited by the owning accountant
- Deactivation (`is_active = false`) hides the service from public list and retrieve; the owner can still see it in their managed list

**Invariants**

- `pricing_type` is one of `fixed`, `hourly`, or `consultation_required`
- `indicative_price` is required for fixed and hourly; optional for consultation-required
- Mutations are limited to the owning accountant; create always assigns the authenticated user as owner

**Fields**

```text
id, accountant_id, name, description, pricing_type,
indicative_price, is_active, created_at, updated_at
```

---

## Inquiry

An Inquiry represents the durable engagement between a client and an accountant. It is the conversation thread and the workspace for that relationship.

**Relationships**

- Belongs to one client User and one accountant User
- May reference one Service (optional)
- Contains Messages
- Contains Booking history
- Will contain shared attachments when file sharing is built ([decisions.md](./decisions.md))

**Lifecycle**

- Status is `open` (default) or `closed`
- Created when a client sends a non-blank first message from a profile or service entry point, or when a matching open Inquiry is reused and a new message is appended
- Opening a message composer without sending does not create an Inquiry
- Booking confirmation, decline, cancellation, and later booking requests do not change Inquiry status or end the engagement
- Closed inquiries reject new messages and new bookings; a later contact creates a new Inquiry instead of reusing the closed one
- Users cannot currently close an Inquiry through the product UI or a dedicated API; closed-status enforcement exists when status is set

**Reuse rules**

- At most one open general Inquiry per client–accountant pair (`service` null)
- At most one open Inquiry per client–accountant–service triple when a service is set
- Separate open inquiries are allowed for different services with the same accountant

**Authorization**

- Only the two participants may read or send on the Inquiry
- Non-participants receive not-found responses on HTTP inquiry surfaces and are rejected on the chat WebSocket

**Invariants**

- `client_id ≠ accountant_id`
- If `service` is set, it belongs to the Inquiry’s accountant

**Fields**

```text
id, status, client_id, accountant_id, service_id (nullable),
created_at, updated_at
```

---

## Message

A Message is a communication event within an Inquiry.

**Relationships**

- Belongs to one Inquiry
- Has one sender (must be an Inquiry participant)

**Lifecycle**

- Created with the Inquiry’s first message, or appended when an open Inquiry is reused
- Further messages may be sent over WebSocket or HTTP while the Inquiry is open
- Messages are not edited or deleted in the current product

**Invariants**

- Content is non-blank
- Sender is the Inquiry client or accountant
- Closed inquiries reject new messages

**Fields**

```text
id, inquiry_id, sender_id, content, created_at
```

Inbox unread behavior may track last-read state; there is no separate Conversation entity.

---

## Booking

A Booking is a scheduled consultation between the Inquiry’s client and accountant. It is an appointment inside the engagement, not a replacement for the Inquiry workspace.

**Relationships**

- Belongs to exactly one Inquiry
- Client and accountant match the Inquiry’s parties (derived from the Inquiry at creation)
- Optional service context is modeled on the Inquiry; a nullable `Booking.service` may still be copied from the Inquiry for historical reasons

**Lifecycle**

- Created as `pending` when a client requests a consultation (from profile/service, or via API on an existing open Inquiry with no active booking)
- Duration is fixed at 30 minutes: `ends_at = starts_at + 30 minutes`
- Accountant may accept (`confirmed`) or decline (`declined`) a pending booking
- Either participant may cancel a pending or confirmed booking (`cancelled`)
- After decline or cancel, another booking may be requested on the same Inquiry

**Invariants**

- At most one active booking per Inquiry (`pending` or `confirmed`)
- Confirmed bookings for the same accountant cannot overlap (enforced on accept)
- Booking status changes do not close the Inquiry

**Fields**

```text
id, status, inquiry_id, client_id, accountant_id,
service_id (nullable, legacy), starts_at, ends_at,
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
 └── (as client or accountant) Booking

Inquiry → User (client), User (accountant), Service? 
Message → Inquiry
Booking → Inquiry
```

---

## Entry flows

### Starting a conversation

Profile “Message accountant” and service-page messaging share one create/reuse path: required first message content, optional or implied service, then navigation to `/chat/<inquiry_id>`.

### Requesting a consultation

From profile or service, the client chooses a start time and supplies a brief note. The system creates or reuses an open Inquiry, stores the note as a message, creates a pending Booking, and opens the Inquiry chat. Accept/decline and status appear in the conversation and on `/bookings`.

---

## Authorization summary

| Surface | Rule |
| --- | --- |
| Inquiry list, detail, messages | Authenticated participant; others not found |
| Send message | Participant and open Inquiry |
| Chat WebSocket | Authenticated participant; closed Inquiry rejects send |
| Bookings | Participant access; accept/decline restricted to accountant |
| Service mutations | Accountant profile and ownership |
| Public directory, profile, active services | Public read with completeness / active filters above |
