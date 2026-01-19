# Models


# User
- id 
- email
- role (CLIENT|Accountant)


# AccountantProfile
- user (FK)
- years_experience
- credentials
- bio 

# Service
- accountant (FK) 
- title
- description
- price

# Booking
- date 
- accountant 
- user 
- status: 


# Inquiry
- client 
- accountant
- service
- status (open/responded/booked/closed)
- created_at 

# Conversation 
- inquiry (should be one to one field) - conversation is created exactly once per inquiry
- created_at

# Message
- conversation (FK)
- sender (User)
- body
- created_at

- for the permissions for messages in a conversation, sender can only be one of the two participants (same for reader)