from django.db import models
from django.conf import settings
from inquiries.models import Inquiry


class Message(models.Model):
    inquiry = models.ForeignKey(
        Inquiry,
        related_name = "inquiry",
        on_delete = models.CASCADE,
    )

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
    )

    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
