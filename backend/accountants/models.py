from django.db import models
from users.models import User
from django.conf import settings


# Create your models here.

class AccountantProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL,
                                on_delete=models.CASCADE,
                                related_name="accountant_profile")

    years_experience = models.IntegerField(default=0)
    credentials = models.CharField()
    bio = models.CharField()

    def __str__(self):
        return f"AccountantProfile({self.user.email})"