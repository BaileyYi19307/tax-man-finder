from django.db import models
from django.conf import settings
# Create your models here.
class Service(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField()
    price = models.DecimalField(max_digits=8,decimal_places=2)
    accountant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="services")

    def __str__(self):
        return self.name