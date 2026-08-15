# Domain Models

Source of truth for marketplace domain rules. This document describes intended business behavior, not the current repository implementation.

---

## Overview

The platform connects clients and accountants.

- Every authenticated person is a **User**
- A **Client** is not a separate database model; it means a user acting as the client in a particular inquiry or booking
- An **Accountant** is a user who has an **AccountantProfile** and may offer **Services**
- An **Inquiry** is one conversation between one client and one accountant
- A **Message** is a piece of communication in an inquiry
- A **Booking** is a scheduled consultation appointment tied to an inquiry

A user may act as both an accountant and a client in different inquiries or bookings, but cannot be both the client and the accountant in the same inquiry or booking.

---

## User

### Purpose

- Represents every authenticated person using the platform
- Stores authentication, identity, and information shared by all users
- A user may participate in an inquiry or booking as a client
- A user with an accountant profile may also provide accounting services

### Creation

- Users are created through the platform’s authentication / signup flows

### Participants or ownership

- A user acts as a client when referenced by the `client_id` field of an inquiry or booking
- A user is eligible to act as an accountant when they have an accountant profile
- The existence of an `AccountantProfile` is the source of truth for whether a user may provide accounting services
- `User.is_accountant` may remain temporarily during migration but must not remain a permanent second source of truth
- Existing dependencies on `User.is_accountant` should be removed incrementally before the field is deleted
- A user may have at most one accountant profile
- A user may act as both an accountant and a client in different inquiries or bookings
- A user cannot be both the client and accountant in the same inquiry or booking

### Relationships

- May act as a client in inquiries and bookings
- May optionally have one accountant profile

### Rules and validation

- Every user has one unique email address
- A separate client profile is not required because clients do not currently have any additional client-specific information

### Model fields

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
date_joined
updated_at
```

### Foreign-key relationships

- None as the root identity model
- Referenced by `AccountantProfile.user_id`, inquiry and booking client/accountant fields, and message senders

---

## AccountantProfile

### Purpose

- Stores professional information that applies only to users who provide accounting services
- Extends the general user account without placing accountant-specific fields on every user
- Identifies a user as an accountant within the marketplace

### Creation

- An accountant profile is created for a user who will provide accounting services

### Participants or ownership

- An accountant profile belongs to exactly one user
- A user may have at most one accountant profile
- A user without an accountant profile may still use the platform as a client
- A user with an accountant profile may provide services as an accountant
- A user with an accountant profile may also act as a client when contacting another accountant

### Relationships

- Belongs to exactly one user
- Contains the additional information required for that user to offer accounting services

### Rules and validation

- An accountant profile’s professional information is complete when all of the following are present:
  - `bio`
  - `credentials`
  - `years_experience`
- The accountant must also have at least one active service before the profile is considered complete and publicly available

### Model fields

```text
AccountantProfile
-----------------
id
user_id
years_experience
credentials
bio
created_at
updated_at
```

### Foreign-key relationships

```text
AccountantProfile.user_id → User.id
```

---

## Client (not a model)

### Purpose

- Refers to a user acting as the client in a particular inquiry or booking

### Rules and validation

- Is not a separate database model

### Examples

```text
Inquiry.client_id     → User.id
Inquiry.accountant_id → User.id
Booking.client_id     → User.id
Booking.accountant_id → User.id
```

For every inquiry and booking:

```text
client_id ≠ accountant_id
```

---

## Service

### Purpose

- Services describe what an accountant offers and provide indicative pricing
- Some services have a predictable fixed fee or hourly rate, while others require a consultation before the accountant can estimate the scope and provide a final quote

### Creation

- Created by an accountant as part of what they offer on the marketplace

### Participants or ownership

- Each service belongs to an accountant

### Relationships

- Owned by an accountant (user with an accountant profile)
- May be optionally attached to an inquiry

### Rules and validation

- Pricing is indicative and does not represent a binding final quote
- `pricing_type` supports:
  - `FIXED`
  - `HOURLY`
  - `CONSULTATION_REQUIRED`
- `indicative_price` is required for fixed and hourly services
- For a fixed service, `indicative_price` represents the indicative total price
- For an hourly service, `indicative_price` represents the indicative hourly rate
- For a consultation-required service, `indicative_price` may be blank
- Profile completeness requires at least one active service

### Model fields

```text
Service
-------
id
accountant
name
description
pricing_type
indicative_price
is_active
created_at
updated_at
```

### Foreign-key relationships

```text
Service.accountant → User.id
```

---

## Inquiry

### Purpose

- Allow a client to contact an accountant, ask questions, or express interest in a service
- An inquiry represents one conversation between one client and one accountant

### Creation

- Clients discover an **accountant / firm profile**, which owns professional info and a list of **Services**
- There are two UI entry points to start messaging (see **Starting a conversation** below); both use one backend operation
- An inquiry may be **service-specific** (`service` set) or **general** (`service` null)
- When started from a service page, that service is attached automatically
- When started from a profile, the client may optionally select one of that accountant’s services
- Opening the message composer does **not** create an inquiry
- The inquiry is created only when the client **sends** a non-blank first message (together with that message), or an existing matching **open** inquiry is reused and the message is appended

### Participants or ownership

- Every inquiry has exactly one client
- Every inquiry has exactly one accountant
- Only that client and accountant may send messages
- The client and accountant cannot be the same user

### Relationships

#### Service relationship

- A service is optional
- If a service is attached, it must belong to the inquiry’s accountant
- A general inquiry has no attached service

#### Messages relationship

- The user has to compose a first message, press send, then an inquiry is created
- A first message is created, so the system never ends up with an empty inquiry that contains no conversation

### Rules and validation

#### Duplicate rules

- A client may have multiple inquiries with the same accountant
- A client may have open inquiries for different services with the same accountant
- Only one open inquiry may exist for the same client, accountant, and service
- Only one open general inquiry may exist for the same client and accountant

### Statuses

- Open
- Closed

### Model fields

```text
Inquiry
-------
id
status (Open, Closed)
client_id
accountant_id
service_id [nullable]
created_at
updated_at
```

### Foreign-key relationships

```text
Inquiry.client_id     → User.id
Inquiry.accountant_id → User.id
Inquiry.service_id    → Service.id
```

---

## Message

### Purpose

- A message is a piece of communication sent by one of an inquiry’s two participants
- It records who sent the message, what they sent, and when they sent it

### Creation

- Created when a participant sends content in an inquiry
- The first message is created together with a new inquiry when the client presses send

### Participants or ownership

- A message has exactly one sender
- The sender must be either the inquiry’s client or accountant

### Relationships

- A message belongs to exactly one inquiry
- An inquiry can contain multiple messages

### Rules and validation

- Message content can’t be blank
- Messages are displayed in chronological order using `created_at`, with `id` as a tie-breaker
- Messages cannot be edited or deleted in the initial MVP
- Messages cannot be sent to a closed inquiry

### Model fields

```text
Message
-------
id
inquiry_id
sender_id
content
created_at
```

### Foreign-key relationships

```text
Message.inquiry_id → Inquiry.id
Message.sender_id  → User.id
```

---

## Booking

### Purpose

- A booking represents a scheduled consultation appointment between a client and an accountant
- A booking does not represent the accounting engagement itself
- The consultation may later lead to a separate agreement, final quote, or accounting engagement

### Creation

A consultation booking may be created in either of two ways:

- From an accountant profile (or service entry point), which creates a new inquiry, initial message, and pending booking
- From an existing open inquiry, which reuses the inquiry and creates a pending booking

When created from an accountant’s profile / Request Consultation flow:

- The client may optionally select one of the accountant’s services
- The client must choose a requested start date and time
- The client must provide a brief note describing what they would like to discuss
- Submitting the consultation request creates:
  - An inquiry between the client and accountant
  - An initial message using the client’s brief note
  - A booking with a status of Pending
- The client is taken to the newly created inquiry so the client and accountant can continue communicating
- The pending booking request is displayed within the inquiry conversation

When created from an existing inquiry:

- The inquiry must be open
- The inquiry participants must match the booking participants
- The inquiry must not already have an active booking
- A booking-related message should be added to the inquiry
- A closed inquiry cannot receive a booking request
- After a booking is declined or cancelled, another booking request may be created within the same inquiry

### Participants or ownership

- Every booking has exactly one client
- Every booking has exactly one accountant
- The client and accountant cannot be the same user
- The booking’s client must match the related inquiry’s client
- The booking’s accountant must match the related inquiry’s accountant

### Relationships

#### Inquiry relationship

- Every booking must belong to exactly one inquiry
- An inquiry may exist without a booking
- A booking cannot exist without an inquiry
- An inquiry may have at most one active booking
- A booking is considered active when its status is `Pending` or `Confirmed`
- A booking is not considered active when its status is `Declined` or `Cancelled`
- If a booking request is declined or cancelled, the inquiry remains open and the participants may continue messaging
- After a booking is declined or cancelled, another booking request may be created within the same inquiry

#### Service relationship

- A service is optional
- The selected service is stored on the inquiry rather than duplicated on the booking
- If a service is attached to the inquiry, it must belong to the booking’s accountant
- A consultation may be requested without selecting a service

### Rules and validation

#### Scheduling rules

- The client selects a consultation start date and time
- Consultations use a fixed duration of 30 minutes for the initial MVP
- `ends_at` is calculated automatically as `ends_at = starts_at + 30 minutes`
- The client does not select an end time
- A booking must have a start date and time
- A booking must have an end date and time
- The end time must be later than the start time
- A newly created booking begins with a status of Pending
- A pending booking becomes Confirmed when the accountant accepts it
- A pending booking becomes Declined when the accountant declines it
- A confirmed or pending booking may become Cancelled
- Confirmed bookings for the same accountant cannot overlap

#### Consistency rules

- `Booking.client_id` must equal `Booking.inquiry.client_id`
- `Booking.accountant_id` must equal `Booking.inquiry.accountant_id`
- The backend should derive the client and accountant from the inquiry when creating the booking
- The frontend should not be allowed to assign arbitrary client or accountant IDs

### Statuses

- **Pending:** The client has requested the consultation, but the accountant has not responded
- **Confirmed:** The accountant has accepted the consultation request
- **Declined:** The accountant has declined the consultation request
- **Cancelled:** The consultation was cancelled after the request was created

### Model fields

```text
Booking
-------
id
status (Pending, Confirmed, Declined, Cancelled)
inquiry_id
client_id
accountant_id
starts_at
ends_at
created_at
updated_at
```

### Foreign-key relationships

```text
Booking.inquiry_id     → Inquiry.id
Booking.client_id      → User.id
Booking.accountant_id  → User.id
```

---

## Relationships among the models

```text
User
 ├── (optional) AccountantProfile
 ├── (as accountant) Service
 ├── (as client or accountant) Inquiry
 ├── (as sender) Message
 └── (as client or accountant) Booking

AccountantProfile → User

Service → User (accountant)

Inquiry → User (client)
Inquiry → User (accountant)
Inquiry → Service (optional)

Message → Inquiry
Message → User (sender)

Booking → Inquiry
Booking → User (client)
Booking → User (accountant)
```

Consistency rules that cut across models:

- For every inquiry and booking: `client_id ≠ accountant_id`
- If an inquiry has a service, that service must belong to the inquiry’s accountant
- Booking client and accountant must match the related inquiry’s client and accountant
- Service for a consultation request is stored on the inquiry, not duplicated on the booking

---

## Starting a conversation (Message Accountant)

### Why the model looks like this

Clients find an **accountant / firm profile** first. That profile lists **Services** (offerings such as Individual Tax Preparation or Bookkeeping). Messaging is about talking to that accountant; a service is optional context for the conversation.

So the domain uses one conversation type (**Inquiry**) with an optional `service`:

- `service = null` → general contact with the accountant
- `service` set → contact about that specific offering

Two buttons in the product are only **entry points**. They should not invent two different backend APIs.

### One domain operation

Both UI flows call the same operation conceptually:

`start_conversation(accountant, optional service, first_message)`

Implementation today: authenticated `POST /api/inquiries/` with `content` required, plus either `service` or `accountant` (when general).

Behavior:

1. Reject blank / whitespace-only `first_message`
2. Find a matching **open** inquiry (see reuse rules below)
3. If found → reuse it and **append** the message; return that `inquiry_id`
4. If not → **atomically** create Inquiry + first Message; return new `inquiry_id`
5. Client navigates to `/chat/<inquiry_id>`

Opening a composer or clicking Message without Send must never create an Inquiry.

### Entry point 1 — General contact (accountant / firm profile)

```text
[Message Accountant]
  → message form
  → optional Service selection
  → required first message
  → [Send]
```

- No service selected → general inquiry: `client + accountant + service = null`
- Service selected → same outcome as starting from that service page (`service` set)

*(Profile Message UI may land after the service-page composer; the domain rule is the same.)*

### Entry point 2 — Service-specific contact (service card / detail)

```text
[Message about this service] / [Message accountant]
  → message composer
  → service already implied (do not ask again)
  → required first message
  → [Send]
```

Creates or reuses: `client + accountant + service`.

### Existing open inquiry (reuse)

Before creating a new Inquiry, look for a matching **open** row:

| Kind | Match |
|------|--------|
| General | `client` + `accountant` + `service` is null + Open |
| Service | `client` + `accountant` + `service` + Open |

If matched: do **not** create another Inquiry; append the new Message; navigate to that conversation.

A client may have **separate open** inquiries with the same accountant for **different** services, plus at most one open general inquiry.

### Closed inquiry

- Closed inquiries accept **no** further messages
- Later contact via the same profile/service entry point does **not** reuse the closed row
- Create a **new** Inquiry + first Message instead

---

## Request Consultation flow

On an accountant’s profile (example: Jane):

```text
[Request Consultation]

Service
[ Select a service — optional ]

Date and time
[ Choose a time ]

Brief note
[ What would you like to discuss? ]

[ Request Consultation ]
```

Submitting creates:

- An inquiry
- An initial message using the brief note
- A pending booking request

Details:

- The client selects a start date and time only; `ends_at` is set to start plus 30 minutes
- The client is taken to the newly created inquiry so the client and accountant can continue communicating
- The pending booking request is displayed within the inquiry conversation
- The selected service, if any, is stored on the inquiry rather than on the booking

A consultation booking may also be requested from an existing open inquiry (reuse inquiry, add a booking-related message, create a pending booking), subject to the creation rules above

---

## Resolved Product Decisions

These decisions are confirmed and supersede earlier open questions.

### Service pricing

- `Service.pricing_type` supports `FIXED`, `HOURLY`, and `CONSULTATION_REQUIRED`
- `indicative_price` is required for fixed and hourly services
- For a fixed service, `indicative_price` is the indicative total price
- For an hourly service, `indicative_price` is the indicative hourly rate
- For a consultation-required service, `indicative_price` may be blank
- Indicative pricing does not represent a binding final quote

### Accountant profile completion

- Required professional fields: `bio`, `credentials`, `years_experience`
- The accountant must also have at least one active service before the profile is considered complete and publicly available

### Consultation duration

- Client selects start date and time only
- Fixed duration of 30 minutes for the initial MVP
- `ends_at = starts_at + 30 minutes`

### Active booking requests

- Active statuses: `Pending`, `Confirmed`
- Not active: `Declined`, `Cancelled`
- An inquiry may have at most one active booking
- After decline or cancel, another booking request may be created in the same inquiry

### Accountant identification

- `AccountantProfile` existence is the source of truth for providing accounting services
- `User.is_accountant` may remain temporarily during migration
- Dependencies on `User.is_accountant` should be removed incrementally before the field is deleted

### Conversation read state

- Unread-message tracking and `ConversationReadState` are not required for the initial MVP
- Existing read-state functionality may remain temporarily if removing it would interfere with the model migration
- Unread badges and last-read behavior can be addressed after core inquiry and messaging flows are stable

### Booking and inquiry creation

- From an accountant profile: create a new inquiry, initial message, and pending booking
- From an existing open inquiry: reuse the inquiry and create a pending booking
- When reusing an inquiry: it must be open, participants must match, it must not already have an active booking, a booking-related message should be added, and a closed inquiry cannot receive a booking request

### Starting a messaging conversation

- Accountant/firm profile owns services and is the discovery surface; services are offerings under that profile
- Two UI entry points (profile Message Accountant; service-page message) share one `start_conversation` operation
- `service = null` means a general inquiry with that accountant
- Inquiry rows are created only on Send of a non-blank first message (or an open match is reused and the message is appended)
- Open-inquiry reuse and closed-inquiry non-reuse follow the **Starting a conversation** section above

---

## Open Design Questions

None remaining for the decisions listed above. New questions should be added here if they arise during implementation.
