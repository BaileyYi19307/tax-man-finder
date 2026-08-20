# Domain model

Source of truth for marketplace **domain rules as implemented** in this repository, plus a few accepted behaviors that the code already enforces even when a product UI is incomplete (called out explicitly).

For product scope (what to build next), see [`../product/current-requirements.md`](../product/current-requirements.md). For architecture decisions (including not-yet-built file sharing), see [`decisions.md`](./decisions.md).

---

## Overview

The platform connects clients and accountants.

- Every authenticated person is a **User**
- A **Client** is not a separate database model; it means a user acting as the client in a particular inquiry or booking
- An **Accountant** is a user who has an **AccountantProfile** and may offer **Services**
- An **Inquiry** is the durable client–accountant engagement: conversation **and** workspace
- A **Message** is a piece of communication in an inquiry
- A **Booking** is a scheduled consultation appointment tied to an inquiry

A user may act as both an accountant and a client in different inquiries or bookings, but cannot be both the client and the accountant in the same inquiry or booking.

**Implemented:** Inquiry participant identity (`client` or `accountant`) is the authorization boundary for reading/sending on that inquiry and for participant booking actions.

---

## User

### Purpose

- Authentication and shared identity for every person on the platform
- May participate in inquiries/bookings as a client
- May offer services only when an accountant profile exists

### Creation (implemented)

- Created through signup with email + password
- Email verification required before login
- Signup does **not** create an `AccountantProfile` or set a permanent role

### Rules

- Unique email
- No separate client profile model
- Accountant eligibility = presence of `AccountantProfile` (`User.has_accountant_profile()` / `IsAccountant`)
- `User.is_accountant` remains on the model as a **legacy** field; permissions and product routing do **not** use it as the source of truth

### Fields (implemented)

```text
User
-----
id
email
password
first_name
last_name
phone_number
is_active
is_verified
is_mobile_verified
is_accountant          # legacy; not product SoT
date_joined
updated_at
```

---

## AccountantProfile

### Purpose

- Professional information for users who offer accounting services
- Capability marker: having this profile makes the user eligible to act as an accountant

### Creation (implemented)

- Created/updated via authenticated onboarding (`POST /accountants/create/`) for `request.user`
- Upsert-safe; does not create a second profile for the same user
- May create a first service when `service_name` is provided and the user has no active services yet

### Completeness (implemented)

Public “complete” (directory listing) means:

- Non-empty `bio` and `credentials`
- At least one **active** service owned by the user

`years_experience`, `firm_name`, and `location` are collected in onboarding but are **not** required for `is_complete`. A Boolean DB column `profile_complete` exists but API/product completeness uses the computed `is_complete` property.

### Directory (implemented)

- Public directory lists only complete profiles
- Public profile detail may return an existing incomplete profile by id
- Payload includes name fields, firm, location, bio, credentials, years_experience, active services (`id`, `name`), and `profile_complete`

### Fields (implemented)

```text
AccountantProfile
-----------------
id
user_id
years_experience
credentials
bio
firm_name
location
profile_complete       # legacy DB flag; not the completeness SoT
created_at
updated_at
```

---

## Service

### Purpose

- What an accountant offers, with **indicative** (non-binding) pricing

### Rules (implemented)

- Owned by a user who has an accountant profile
- `pricing_type`: `fixed` | `hourly` | `consultation_required`
- `indicative_price` required for fixed and hourly; optional for consultation-required
- `is_active` defaults true; public list/retrieve only active services
- Accountants manage only their own services (`IsServiceOwner`); create binds `accountant=request.user`
- `GET /services/mine/` returns the owner’s services including inactive

### Fields (implemented)

```text
Service
-------
id
accountant_id          # User
name
description
pricing_type
indicative_price
is_active
created_at
updated_at
```

---

## Inquiry

### Purpose

**Inquiry is the durable client–accountant engagement/workspace.**

It is the long-lived thread between one client and one accountant. Messages and bookings hang off the Inquiry. Booking lifecycle (pending → confirmed / declined / cancelled, and later requests) does **not** end the Inquiry.

### Participants (implemented)

- Exactly one `client` and one `accountant` (different users)
- Only those participants may list, read, or message on the inquiry (outsiders → HTTP 404 on inquiry APIs; WS non-participants rejected)
- Optional `service` must belong to the inquiry’s accountant when set
- `service` null = general inquiry; `service` set = service-specific inquiry

### Statuses (implemented)

- `open` (default)
- `closed`

Closed inquiries reject new messages and new bookings. Matching a later Message Accountant / Request Consultation entry point does **not** reuse a closed row; a **new** Inquiry is created.

**Product gap:** there is no HTTP API or UI to set an inquiry to `closed` yet; enforcement exists when status is closed.

### Creation and reuse (implemented)

One operation: start conversation with required non-blank first message (`POST /api/inquiries/`).

1. Reject blank/whitespace-only content (no Inquiry created)
2. Find matching **open** inquiry:
   - General: same client + accountant + `service` null
   - Service: same client + accountant + that service
3. If found → append Message; return existing `inquiry_id` (HTTP 200)
4. Else → atomically create Inquiry + Message (HTTP 201)
5. Opening a composer without Send creates nothing

A client may have multiple open inquiries with the same accountant for **different** services, plus at most one open general inquiry.

### Relationships (implemented)

- Has many Messages
- Has many Bookings (at most one **active** booking at a time)
- Booking status changes do not change Inquiry status

### Fields (implemented)

```text
Inquiry
-------
id
status                 # open | closed
client_id
accountant_id
service_id             # nullable
created_at
updated_at
```

---

## Message

### Purpose

- Communication event on an Inquiry

### Rules (implemented)

- Belongs to exactly one Inquiry; sender must be a participant
- Content cannot be blank (HTTP and WebSocket)
- Cannot send to a closed inquiry (HTTP 403; WS close with domain code)
- Not editable/deletable in the current product
- Ordered by `created_at` (and `id` as tie-breaker in UI practice)
- First message is created with the Inquiry (or appended on reuse)

Unread / last-read tracking may exist for inbox UX; it is not a separate Conversation model.

### Fields (implemented)

```text
Message
-------
id
inquiry_id
sender_id
content
created_at
```

---

## Booking

### Purpose

- A scheduled **consultation** between the Inquiry’s client and accountant
- Not the entire accounting engagement; the Inquiry remains the workspace around it

### Creation (implemented)

- Always belongs to an Inquiry; client/accountant are derived from the Inquiry (not arbitrary payload IDs)
- User-facing path: `POST /bookings/request-consultation/` → get-or-create open Inquiry + message + pending Booking
- API also supports creating a booking on an existing open Inquiry (`POST /bookings/`) when there is no active booking
- Fixed duration: `ends_at = starts_at + 30 minutes`
- Starts as `pending`

### Statuses (implemented)

| Status | Meaning |
| --- | --- |
| `pending` | Requested; accountant has not accepted/declined |
| `confirmed` | Accountant accepted |
| `declined` | Accountant declined |
| `cancelled` | Cancelled while pending or confirmed |

**Active** = `pending` or `confirmed`. At most one active booking per Inquiry (DB-enforced). After decline or cancel, another booking may be requested on the **same** Inquiry.

Accept/decline: accountant only. Cancel: either participant. Confirmed bookings for the same accountant cannot overlap (checked on accept).

### Inquiry relationship (implemented)

- Booking cannot exist without an Inquiry
- Inquiry may exist without a booking
- Decline / cancel / confirm do **not** close the Inquiry
- Participants continue messaging while the Inquiry is open

### Service association

- Product rule: service context lives on the **Inquiry**
- Implementation note: a nullable `Booking.service` may still be populated from `inquiry.service` on create (legacy denormalization). Prefer Inquiry as the source of service context.

### Fields (implemented)

```text
Booking
-------
id
status
inquiry_id
client_id
accountant_id
service_id             # legacy nullable; prefer inquiry.service
starts_at
ends_at
created_at
updated_at
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

Inquiry → User (client)
Inquiry → User (accountant)
Inquiry → Service (optional)
Message → Inquiry
Booking → Inquiry
```

Consistency:

- For every inquiry and booking: `client_id ≠ accountant_id`
- If an inquiry has a service, that service belongs to the inquiry’s accountant
- Booking client/accountant match the related inquiry

---

## Starting a conversation (Message Accountant)

**Implemented** entry points share one backend operation (`POST /api/inquiries/` with required `content`, plus `service` and/or `accountant`):

- Profile: Message Accountant (optional service pick)
- Service page: message about that service

See Inquiry creation/reuse above. Client navigates to `/chat/<inquiry_id>`.

---

## Request consultation

**Implemented** from profile/service: client chooses start time and a brief note → Inquiry (create or reuse) + Message + pending Booking → `/chat/<inquiry_id>`. Accountant accept/decline; both parties see status on `/bookings` and in the conversation.

In-chat request UI is deferred; attaching a booking to an existing open Inquiry is available via API.

---

## Authorization summary (implemented)

| Surface | Rule |
| --- | --- |
| Inquiry list/detail/messages | Authenticated + participant; outsiders 404 |
| Send message | Participant + open inquiry |
| WebSocket chat | JWT; non-participant rejected; closed rejects send |
| Bookings | Participant queryset; accept/decline accountant-only |
| Services mutate | Accountant profile + ownership |
| Public directory/profile/services | AllowAny with completeness/active filters as above |
