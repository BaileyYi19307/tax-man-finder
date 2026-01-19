from django.db import models
from users.models import User
from django.conf import settings


# Create your models here.

class AccountantProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL,
                                on_delete=models.CASCADE,
                                related_name="accountant_profile")

    years_experience = models.IntegerField(default=0)
    credentials = models.TextField(blank=True, default="")
    bio = models.CharField(blank=True, default="")
    profile_complete = models.BooleanField(default=False)

    def __str__(self):
        return f"AccountantProfile({self.user.email})"
    
    @property
    def is_profile_info_complete(self):
        return bool(self.credentials and self.bio)
    
    @property 
    def has_services(self):
        return self.services.exists()
    
    @property
    def is_complete(self):
        return self.is_profile_info_complete and self.has_services