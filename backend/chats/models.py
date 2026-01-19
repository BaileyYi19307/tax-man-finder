from django.db import models
from django.conf import settings
from services.models import Service


class Inquiry(models.Model):
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="client_inquiries",
        on_delete=models.CASCADE,
    )

    accountant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="accountant_inquiries",
        on_delete=models.CASCADE,
    )

    service = models.ForeignKey(
        Service,
        on_delete=models.CASCADE,
    )

    status = models.CharField(
        max_length=20,
        choices=[
            ("open", "Open"),
            ("responded", "Responded"),
            ("booked", "Booked"),
            ("closed", "Closed"),
        ],
        default="open",
    )

    created_at = models.DateTimeField(auto_now_add=True)

# Create your models here.
class Conversation(models.Model):
    inquiry = models.OneToOneField(
        Inquiry,
        related_name="conversation",
        on_delete=models.CASCADE,
    )


    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation,
        related_name="messages",
        on_delete=models.CASCADE,
    )

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
    )

    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
