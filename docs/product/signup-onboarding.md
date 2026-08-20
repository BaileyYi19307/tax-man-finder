# Signup and onboarding

How accounts, intent, and accountant capability work. Product status: [current-requirements.md](./current-requirements.md). Domain model: [../architecture/domain-model.md](../architecture/domain-model.md).

## Goal

Signup creates a `User` account with minimal friction. Onboarding reflects what the visitor wants to do next—not a permanent client vs accountant identity. Accountant onboarding adds an `AccountantProfile` capability to that same user.

## Core user journeys

### Looking for tax help

1. Homepage → “Find an accountant” → browse public listings (no account required)
2. Open a profile (and optionally a service)
3. Sign up or log in only to message or request a consultation
4. Return to the same page (`next`) and continue
5. Without a deeper `next`, land on `/dashboard/client` after login

### Tax professional

1. Homepage → “Join as a tax professional” (tax-professional intent)
2. Create a normal `User` (email + password) if not already signed in
3. Verify email, log in → `/onboarding/accountant`
4. Complete profile and primary service → accountant dashboard
5. Incomplete profiles resume with fields prefilled; complete profiles go to the dashboard
6. Signed-in users may add accountant capability later without a second account

New accountants go through accountant onboarding directly. They are not routed through a client-profile step or defaulted to `/dashboard/client` first.

## Concepts

| Concept | Meaning |
| --- | --- |
| **User account** | Authentication and shared identity (email, password, name). Every authenticated person is a `User`. |
| **Client behavior** | Browsing, messaging, or requesting a consultation as the client on an Inquiry or Booking. Not a separate `ClientProfile`. |
| **Accountant profile** | At most one `AccountantProfile` per user. Presence of that profile is what makes the user eligible to offer services. Accountants remain normal users and can still act as clients in other engagements. |
| **Signup intent** | Temporary routing after “Looking for tax help” or “Tax professional,” stored in the browser (`localStorage`) and signup/login query params. Not written to the database as a role. |

`User.is_accountant` is a legacy field. Signup and onboarding do not set it; capability checks use AccountantProfile presence.

There is no client-profile onboarding. Visitors seeking tax help are never required to create a client profile.

## Landing-page intent

The public homepage uses two intent cards (not a Client/Accountant dropdown):

- Looking for tax help → accountant discovery (`/accountants`)
- Tax professional → accountant onboarding (`/onboarding/accountant`) after signup/login

Visitors can browse accountant profiles without an account. Messaging and consultation requests require authentication.

## Accountant onboarding flow

1. Select tax-professional intent
2. Create a `User` with email, password, and password confirmation
3. Verify email and log in
4. Complete `/onboarding/accountant` (name, firm, location, credentials, bio, primary service)
5. Create or update the `AccountantProfile` for the authenticated user
6. Redirect to the accountant dashboard

Account creation stays a small auth screen. Professional details are collected on `/onboarding/accountant`, not on `/signup`.

## Client / browsing flow

Landing → browse accountants → view profile → Message or Request consultation → if needed, create account / log in → return via `next`.

`/dashboard/client` is the authenticated home for people seeking help. It is not a client-profile form.

## Existing accountant profiles

- An authenticated user keeps a single `AccountantProfile`; onboarding upserts rather than duplicating
- Incomplete profiles prefill on `/onboarding/accountant`
- Complete profiles (`bio` + `credentials` + at least one active service) route to `/dashboard/accountant`

## Routing after login

Implemented in `resolvePostAuthPath`, in priority order:

1. **Return-to `next`** — a safe in-app path from the login URL (or a stored `next`). Paths that are themselves dashboards or onboarding (`/dashboard/client`, `/dashboard/accountant`, `/onboarding/accountant`) are not treated as return-to targets, so Message / Request consultation can still return to the profile or service page even for a complete accountant.
2. **Complete accountant** → `/dashboard/accountant` (leftover intent does not send them to `/dashboard/client`)
3. **Incomplete accountant profile** → `/onboarding/accountant`
4. **New accountant intent** with no profile yet → `/onboarding/accountant`
5. Default → `/dashboard/client`

`/dashboard/client`, `/dashboard/accountant`, `/dashboard/services`, and `/chat` require login. Opening `/dashboard/accountant` with an incomplete profile resumes onboarding; without a profile, the user is sent to `/dashboard/client`.

Email verification lands on `/login?verified=true` without an intent query param. Accountant intent is therefore also stored in `localStorage` in the same browser so verify + login can resume onboarding. A verify click from another device will not restore that intent.

## Accountant onboarding fields

| Field | Storage |
| --- | --- |
| Name | `User.first_name`, `User.last_name` |
| Firm / practice name | `AccountantProfile.firm_name` (optional) |
| Location / service area | `AccountantProfile.location` (optional) |
| Credentials | `AccountantProfile.credentials` (required) |
| Years of experience | `AccountantProfile.years_experience` |
| Short professional bio | `AccountantProfile.bio` (required) |
| Primary service | a `Service` (`name`, `description`) |

Public completeness is bio + credentials + at least one active service.

## Acceptance criteria

- Signup has no Client/Accountant dropdown; homepage shows two intent cards
- Looking for tax help does not create an AccountantProfile
- Tax professional path reaches accountant onboarding after signup/login without a client-profile step
- Completing onboarding creates or updates the authenticated user’s profile and redirects to the accountant dashboard
- An existing user can become an accountant without a second account
- Unauthenticated users can browse listings and profiles
- Messaging and consultation requests require authentication

## Open questions

- After login/signup from Message or Request consultation, should the composer reopen automatically? Today the product returns to the same page only.
- Extra accountant verification beyond email and profile fields is out of scope for the current product.

## Implementation notes

- `POST /accountants/create/` upserts the authenticated user’s profile and may create the first service when they have none. `GET /accountants/me/` returns the profile or 404.
- Login and me responses include `has_accountant_profile` and `accountant_profile_complete` for client-side routing.
