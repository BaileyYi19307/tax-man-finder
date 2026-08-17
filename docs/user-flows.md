# User flows

## Shared identity

Every person who authenticates is a **User**. Looking for tax help does not require a separate client profile. Offering services requires an **AccountantProfile** on that same user.

Signup intent (looking for help vs tax professional) only chooses the next onboarding step. It is not a permanent `CLIENT` / `ACCOUNTANT` role.

## Looking for tax help

1. See homepage
2. Choose “Find an accountant”
3. Browse public listings (no account required)
4. Open a profile
5. Sign up or log in only to message or request a consultation
6. Return to the profile or service page and continue the action

## Signing up (looking for tax help)

1. User clicks Sign up, or is sent to signup from Message / Request consultation
2. Enter email, password, and password confirmation
3. If the email is already registered, signup fails
4. If not, a `User` is created (no accountant profile, no client profile)
5. After email verification and login, continue the intended page, or land on the client dashboard

## Tax professional / accountant

1. See homepage
2. Choose “Join as a tax professional”
3. Create a normal user account (email + password) if not already signed in
4. Complete accountant onboarding (name, firm, location, credentials, bio, primary service)
5. The `AccountantProfile` is created or updated for that user
6. Redirect to the accountant dashboard

A new accountant is never sent through client-profile onboarding first.

## Signing up (accountant)

1. Intent “tax professional” is stored through registration (`localStorage` + query params)
2. Signup creates only a `User`
3. After verify + login, route to `/onboarding/accountant` (not `/dashboard/client`)
4. If an incomplete accountant profile already exists, resume and prefill it
5. If the profile is already complete, go to the accountant dashboard
6. Do not create a second `AccountantProfile`

## Existing users

A signed-in user can add accountant capabilities later from the client dashboard or the homepage card without creating another account.
