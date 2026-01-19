## Phase 1: Core marketplace functionaties
- User signup (client vs accountant)
    - Create users app to define user model + role
    - Unauthenticated
    - Creates a user
    - Has to -> 
        1) validate input
        2) hash passwords
        3) set roles correctly 

- When accountant user signs up 
    - create User(is_accountant=True)
    - create AccountantProfile(user=user)


What properties should a User have?
- 

1) Create a custom user model 

- Security, token JWT? 


- Login
    - vertifies credentials
    - establishes authentication state 
        - Use modern token-based authentication system 
- Accountant Profile creation 
    - create accountants app for accountant-specific profile + listing 
    - Accountant profile is only complete when 
        - Profile info has been filled out 
        - Has atleast one service 
        - Else, incomplete 
- Service listing model 
- Public browsing of accountants


## Phase 2: Booking and Messaging
- Booking requests
    - Need a bookings app for booking logic 
    - 
- Messaging between users
- Availability management

## Phase 3 - Payments & Reviews
- Strip integration 
- Reviews and Ratings
- Admin moderation 


## Apps created
- Users
- Accountants
- Listings 
- Bookings (requests + scheduling + status)

- Later include reviews, payments