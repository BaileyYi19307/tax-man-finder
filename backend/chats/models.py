from django.db import models
from django.conf import settings
from services.models import Service
from inquiries.models import Inquiry

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
