from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email must be set")

        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password) 
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)

# Create your models here.
class User(AbstractUser):
    #abstract user already has
    #id, username, email, password, last_login
    #is_active, is_staff, is_superuser, date_joined
    #first_name, last_name
    email = models.EmailField(unique=True,)
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

    objects = UserManager()  # <-- attach custom manager


    def __str__(self):
        return self.email

