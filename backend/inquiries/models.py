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
    class Meta:
        constraints=[
            models.UniqueConstraint(fields=["client","service"],name="unique_client_service_inquiry")
        ]
            

class ConversationReadState(models.Model):
    inquiry = models.ForeignKey(
        "Inquiry",
        on_delete=models.CASCADE,
        related_name="read_states"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversation_reads"
    )
    last_read_at = models.DateTimeField()

    class Meta:
        unique_together = ("inquiry", "user") # only one row per user and inquiry