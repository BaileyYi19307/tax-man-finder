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