from django.db import models

# Create your models here.
class User(models.Model):
    email = models.CharField()
    password = models.CharField()
    user_id = models.IntegerField()
    is_accountant = models.BooleanField(default=False)

