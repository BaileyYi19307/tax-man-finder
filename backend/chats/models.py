from django.db import models
from django.conf import settings
from inquiries.models import Inquiry


def inquiry_attachment_upload_to(instance, filename):
    return f"inquiry_attachments/{instance.inquiry_id}/{filename}"


class Message(models.Model):
    inquiry = models.ForeignKey(
        Inquiry,
        related_name="messages",
        on_delete=models.CASCADE,
    )

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
    )

    # May be blank when the message has one or more attachments.
    content = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)


class Attachment(models.Model):
    """Inquiry-owned file; optionally linked to a Message for chat timeline display."""

    inquiry = models.ForeignKey(
        Inquiry,
        related_name="attachments",
        on_delete=models.CASCADE,
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="uploaded_attachments",
        on_delete=models.CASCADE,
    )
    message = models.ForeignKey(
        Message,
        related_name="attachments",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    file = models.FileField(upload_to=inquiry_attachment_upload_to)
    original_filename = models.CharField(max_length=255)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["uploaded_at", "id"]
