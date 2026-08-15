"""Shared rules for sending chat messages (HTTP + WebSocket)."""

from inquiries.models import Inquiry


class MessageSendDenied(Exception):
    """Raised when a message cannot be stored on an inquiry."""

    def __init__(self, code, detail):
        self.code = code  # "closed" | "not_participant" | "blank"
        self.detail = detail
        super().__init__(detail)


def clean_message_content(content):
    cleaned = (content or "").strip()
    if not cleaned:
        raise MessageSendDenied("blank", "Message content cannot be blank.")
    return cleaned


def assert_can_send_message(user, inquiry):
    """Enforce participant + open-status rules before creating a Message."""
    if user not in (inquiry.client, inquiry.accountant):
        raise MessageSendDenied(
            "not_participant",
            "Only inquiry participants may send messages.",
        )
    if inquiry.status == Inquiry.StatusChoices.CLOSED:
        raise MessageSendDenied(
            "closed",
            "Cannot send messages to a closed inquiry.",
        )
