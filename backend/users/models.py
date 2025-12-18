from django.db import models

# Create your models here.
class User(models.Model):
    email = models.CharField()
    password = models.CharField()
    is_accountant = models.BooleanField(default=False)

    def __str__(self):
        return self.email

