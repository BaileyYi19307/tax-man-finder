from django.contrib.auth.models import AbstractUser
from django.db import models

# Create your models here.
class User(AbstractUser):
    #abstract user already has
    #id, username, email, password, last_login
    #is_active, is_staff, is_superuser, date_joined
    #first_name, last_name
    email = models.EmailField(unique=True,blank=True)
    username = None # want email only identity
    USERNAME_FIELD="email"
    REQUIRED_FIELDS=[]

    is_accountant = models.BooleanField(default=False)

    #have to implement is_active on the chosen auth backend
    is_verified = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now = True)
    #updates the field with current date and time every time the model instance's save() method is called

    phone_number = models.CharField(max_length=20,blank=True)# field is not required in forms 
    # profile_photo = models.ImageField()


    def __str__(self):
        return self.email

