from django.db import models
from users.models import User

# Create your models here.

class AccountantProfile():
    user_id = models.ForeignKey(User, on_delete=models.CASCADE)
    years_experience = models.IntegerField()
    credentials = models.CharField()
    bio = models.CharField()
