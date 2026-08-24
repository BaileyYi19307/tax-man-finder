from django.db import models
from django.conf import settings
from django.db.models import Q

User = settings.AUTH_USER_MODEL


class Inquiry(models.Model):
    class StatusChoices(models.TextChoices):
        OPEN = "open"
        CLOSED = "closed"

    client = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="inquiries_sent"
    )
    accountant = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="inquiries_received"
    )

    status = models.CharField(
        max_length=20, choices=StatusChoices.choices, default="open"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["client", "accountant"],
                condition=Q(status="open"),
                name="unique_open_inquiry_per_client_accountant",
            ),
        ]


class ConversationReadState(models.Model):
    inquiry = models.ForeignKey(
        "Inquiry",
        on_delete=models.CASCADE,
        related_name="read_states",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversation_reads",
    )
    last_read_at = models.DateTimeField()

    class Meta:
        unique_together = ("inquiry", "user")
