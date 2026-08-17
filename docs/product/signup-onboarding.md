# Signup & Onboarding

## Goal

Reduce signup friction and make onboarding reflect the user's **intent**, not a permanent identity. Signup creates a `User` account. Accountant onboarding adds an `AccountantProfile` capability to that same user.

## Architectural distinction

| Concept | What it is | What it is not |
| --- | --- | --- |
| **User account** | Authentication and shared identity (email, password, name). Every authenticated person is a `User`. | A mutually exclusive Client vs Accountant role. |
| **Client behavior** | Using the product to browse accountants, message, or request a consultation. Implemented as a `User` acting as the client on an inquiry/booking. | A separate `ClientProfile` or required onboarding step. Visitors can browse without an account. Authentication is required only to message or request a consultation. |
| **Accountant profile / capability** | A `User` who has an `AccountantProfile` (at most one). That profile is the source of truth for offering services. | A different account type. Accountants remain normal users and can still act as clients in other inquiries. |
| **Signup intent** | Temporary routing after the visitor chooses “Looking for tax help” or “Tax professional.” Stored in the browser (`localStorage`) plus signup/login query params. | Permanent identity. It is not written to the database and is not a `CLIENT` / `ACCOUNTANT` role. |

`User.is_accountant` is a legacy field and is **not** set by signup or onboarding.

There is **no client-profile onboarding**. People looking for tax help are never required to create a client profile. New accountants must **not** be sent through a client dashboard or client-profile step before accountant onboarding.

## User intents

1. Looking for tax help
2. Tax professional / accountant

## UX requirements

- Do not use a generic Client/Accountant dropdown during signup.
- Use two large intent cards with descriptive copy (on the public landing page `/`).
- The intent choice describes what the user wants to do next, not a permanent identity.
- Users looking for tax help should be directed toward accountant discovery.
- Tax professionals should be directed into accountant profile onboarding, then the accountant dashboard.
- Accountant profiles are an additional capability on a user account.
- Visitors can browse accountant profiles without creating an account.
- Authentication is required to message an accountant or request a consultation.

## Accountant flow (source of truth)

**Select “Tax professional / accountant”**
→ Create a normal `User` with email + password (and password confirmation on the signup form)
→ Verify email, then log in
→ Accountant-specific onboarding (name, firm, location, credentials, bio, primary service)
→ Create or update the `AccountantProfile` linked to that authenticated user
→ Redirect to the accountant dashboard

At no point is a new accountant sent through client-profile onboarding or defaulted to `/dashboard/client`.

Account creation stays a small auth screen. Professional details are collected on `/onboarding/accountant`, not on `/signup`.

## Client / browsing flow

Landing page
→ Browse accountants (no account)
→ View profile
→ Message / Request consultation
→ If unauthenticated: create account / log in
→ Return to the same page (`next` query param)

After login, looking-for-help users without a deeper `next` land on `/dashboard/client` (authenticated home for seeking help). That dashboard is not a client-profile form.

## Existing users

If an authenticated user already has an accountant profile:

- Do not create a duplicate `AccountantProfile`.
- If the profile is incomplete, `/onboarding/accountant` prefills existing fields so they can finish.
- If the profile is already complete (`bio` + `credentials` + at least one active service), selecting the accountant path goes to `/dashboard/accountant`.

A user remains a normal authenticated user whether or not their accountant profile is complete.

## Routing after login

Priority:

1. Explicit `next` from the current login URL when it is a safe in-app path and is **not** `/dashboard/client` or accountant onboarding (this preserves Message / Request consultation return-to).
2. Accountant intent (URL, or `localStorage` after email verification) → incomplete or missing profile goes to `/onboarding/accountant`; a complete profile goes to `/dashboard/accountant`.
3. Any other stored `next`.
4. Default `/dashboard/client`.

Email verification currently lands on `/login?verified=true` with no `intent` query param. Accountant intent is therefore also stored in `localStorage` in the same browser so verify + login can resume onboarding. A verify click from another device will not restore that intent.

## Accountant onboarding fields (MVP)

Reused from existing models (no extra verification workflow):

- **Name** — `User.first_name`, `User.last_name`
- **Firm / practice name** — `AccountantProfile.firm_name` (optional)
- **Location / service area** — `AccountantProfile.location` (optional)
- **Credentials** — `AccountantProfile.credentials` (required)
- **Years of experience** — `AccountantProfile.years_experience`
- **Short professional bio** — `AccountantProfile.bio` (required)
- **Primary service** — a `Service` row (`name`, `description`). Specialties are services, not a separate concept.

Public “profile complete” still means bio + credentials + at least one active service.

## Acceptance criteria

- No Client/Accountant dropdown appears in signup.
- Two intent cards are displayed on the landing page.
- Choosing “Looking for tax help” does not create an `AccountantProfile`.
- Choosing “I’m a tax professional” routes the user to accountant onboarding after signup/login, never through a client-profile step.
- Completing onboarding creates or updates the profile for the authenticated user and redirects to the accountant dashboard.
- A user may later become an accountant without creating a separate account.
- Unauthenticated users can browse accountant listings and profiles.
- Messaging and consultation requests require authentication.

## Open questions

- After login/signup from “Message” or “Request consultation,” should the composer reopen automatically? MVP returns to the same page only.
- Extra accountant verification beyond email + profile is out of scope for this MVP.

## Implementation notes

- Intent cards live on `/`. **Looking for tax help** → `/accountants`. **Tax professional** → `/onboarding/accountant`.
- Signup creates a `User` only. It does **not** create an `AccountantProfile`.
- `POST /accountants/create/` upserts the authenticated user’s profile and may create the first service if they do not already have one. `GET /accountants/me/` returns the existing profile or 404.
- Signup/login include `has_accountant_profile` and `accountant_profile_complete` so the client can route without guessing.
- The looking-for-help and accountant-intent cards do not invent a new role field.
