from django.db import models

# Create your models here.
from django.conf import settings
from services.models import Service
from django.db.models import Q

User = settings.AUTH_USER_MODEL

class Inquiry(models.Model):
    class StatusChoices(models.TextChoices):
        OPEN = "open"
        CLOSED = "closed"

    client = models.ForeignKey(User, on_delete=models.CASCADE, related_name="inquiries_sent")
    accountant = models.ForeignKey(User, on_delete=models.CASCADE, related_name="inquiries_received")
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="inquiries", null=True, blank=True)

    status = models.CharField(max_length=20, choices=StatusChoices.choices, default="open")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints=[
            models.UniqueConstraint(
                fields=["client","accountant","service"],
                condition=Q(status="open") & Q(service__isnull=False),
                name="unique_open_inquiry_with_service"
            ),
            models.UniqueConstraint(
                fields=["client", "accountant"],
                condition=Q(status="open") & Q(service__isnull=True),
                name="unique_open_general_inquiry",
            )
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