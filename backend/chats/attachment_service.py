"""Helpers for Inquiry attachment HTTP views."""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError

from chats.file_validation import validate_uploaded_file
from chats.message_rules import (
    assert_can_send_message,
    assert_message_has_payload,
)
from chats.models import Attachment, Message
from chats.serializers import MessageSerializer
from inquiries.models import Inquiry


def get_participant_inquiry(user, inquiry_id):
    return get_object_or_404(
        Inquiry.objects.select_related("client", "accountant"),
        Q(client=user) | Q(accountant=user),
        id=inquiry_id,
    )


def collect_upload_files(request):
    files = list(request.FILES.getlist("files"))
    if not files and request.FILES.get("file"):
        files = [request.FILES["file"]]
    return files


def validate_upload_files(files):
    if not files:
        raise ValidationError({"files": "At least one file is required."})
    for uploaded in files:
        validate_uploaded_file(uploaded)
    return files


def create_attachments(*, inquiry, uploaded_by, files, message=None):
    created = []
    for uploaded in files:
        attachment = Attachment.objects.create(
            inquiry=inquiry,
            uploaded_by=uploaded_by,
            message=message,
            file=uploaded,
            original_filename=(uploaded.name or "upload")[:255],
        )
        created.append(attachment)
    return created


def create_message_with_attachments(*, inquiry, sender, content, files):
    """Atomically create a Message and optional Attachments; broadcast on the WS group."""
    assert_can_send_message(sender, inquiry)
    cleaned = assert_message_has_payload(content, has_attachments=bool(files))
    if files:
        validate_upload_files(files)

    with transaction.atomic():
        message = Message.objects.create(
            inquiry=inquiry,
            sender=sender,
            content=cleaned,
        )
        if files:
            create_attachments(
                inquiry=inquiry,
                uploaded_by=sender,
                files=files,
                message=message,
            )

    message = (
        Message.objects.select_related("sender")
        .prefetch_related("attachments", "attachments__uploaded_by")
        .get(pk=message.pk)
    )
    broadcast_chat_message(message)
    return message


def broadcast_chat_message(message):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    payload = MessageSerializer(message).data
    async_to_sync(channel_layer.group_send)(
        f"inquiry_{message.inquiry_id}",
        {
            "type": "chat.message",
            "id": payload["id"],
            "content": payload["content"],
            "sender_id": payload["sender_id"],
            "created_at": payload["created_at"],
            "attachments": payload.get("attachments") or [],
        },
    )
