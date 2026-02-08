from django.db import models

# Create your models here.
from django.conf import settings
from services.models import Service

User = settings.AUTH_USER_MODEL

class Inquiry(models.Model):
    STATUS_CHOICES = [
        ("open", "Open"),
        ("responded", "Responded"),
        ("booked", "Booked"),
        ("closed", "Closed"),
    ]

    client = models.ForeignKey(User, on_delete=models.CASCADE, related_name="inquiries_sent")
    accountant = models.ForeignKey(User, on_delete=models.CASCADE, related_name="inquiries_received")
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="inquiries")

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="open")
    created_at = models.DateTimeField(auto_now_add=True)
