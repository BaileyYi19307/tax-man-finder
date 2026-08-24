"""
Inquiry timeline notices for Booking lifecycle changes.

Reuses Message + ConversationReadState so the other participant sees unread
and the event survives refresh. is_system distinguishes these from chat.
"""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from chats.models import Message
from chats.serializers import MessageSerializer


# User-facing copy (marketplace tone).
MSG_ACCEPTED_FREE = "Consultation accepted. Your consultation is confirmed."
MSG_ACCEPTED_PAID = (
    "Consultation accepted. Payment is required to confirm this booking."
)
MSG_DECLINED = "Consultation declined."
MSG_PAYMENT_COMPLETED = "Payment completed. Consultation confirmed."
MSG_CANCELLED = "Consultation cancelled."


def post_booking_lifecycle_message(*, inquiry, actor, content: str) -> Message:
    """
    Persist a system timeline message and broadcast to the inquiry chat group.

    sender is the acting participant so existing unread rules notify the other party.
    """
    message = Message.objects.create(
        inquiry=inquiry,
        sender=actor,
        content=content,
        is_system=True,
    )
    _broadcast(message)
    return message


def _broadcast(message: Message) -> None:
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
            "is_system": True,
        },
    )
