"""Shared rules for sending chat messages (HTTP + WebSocket)."""

from inquiries.models import Inquiry


class MessageSendDenied(Exception):
    """Raised when a message cannot be stored on an inquiry."""

    def __init__(self, code, detail):
        self.code = code  # "closed" | "not_participant" | "blank"
        self.detail = detail
        super().__init__(detail)


def normalize_message_content(content):
    return (content or "").strip()


def clean_message_content(content):
    """Require non-blank text (WebSocket text-only path)."""
    cleaned = normalize_message_content(content)
    if not cleaned:
        raise MessageSendDenied("blank", "Message content cannot be blank.")
    return cleaned


def assert_message_has_payload(content, *, has_attachments=False):
    """Message is valid with non-blank text and/or at least one attachment."""
    cleaned = normalize_message_content(content)
    if not cleaned and not has_attachments:
        raise MessageSendDenied(
            "blank",
            "Message must include text or at least one attachment.",
        )
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


def assert_can_access_inquiry(user, inquiry):
    """Participant check for read paths (open or closed)."""
    if user not in (inquiry.client, inquiry.accountant):
        raise MessageSendDenied(
            "not_participant",
            "Only inquiry participants may access this inquiry.",
        )
