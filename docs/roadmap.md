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

- create a User
- create a default AccountantProfile 



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
 - Flow:
    - User A can select from a list of users - selects user B
        - User A can send a message to user B 
        - User B receives that message, and can send a message back 

    - User can see who is online
    - User sends a message to user B 
    - System shows it to user B, even if they are not online - preserves the history 

    Functional Requirements:
    1. One on one chat
    2. Read receipt
    3. Online status
    4. Notifications
    5. Share multimedia 

    System Requirements:
    1. Low Latency
    2. High Reliability
    3. High Availability
    4. Mobile & Desktop
    5. Chat History 
    6. High BLOB Store
    7. E2E Encryption
    8. Web Sockets

    API Endpoints:
    1. send_message:
        (sender_userID,receiver_userID,text)
    2. get_message:
        (user_Id, screen_size, before_timestamp)

    User A estabishes connection to messsaging service
        - connection stored in a database
    User A sends request to messaging service with user id of 

    Messaging service identifies User B via session service
    Messaging service sends message to User B 

    if User B is offline, messaging service forwards to relay service - stores unsent in database






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