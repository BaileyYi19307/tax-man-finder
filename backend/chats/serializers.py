from rest_framework import serializers
from .models import Message, Attachment
from .message_rules import MessageSendDenied, clean_message_content


class AttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_email = serializers.EmailField(source="uploaded_by.email", read_only=True)

    class Meta:
        model = Attachment
        fields = [
            "id",
            "inquiry_id",
            "message_id",
            "uploaded_by_id",
            "uploaded_by_email",
            "original_filename",
            "uploaded_at",
        ]
        read_only_fields = fields


class MessageSerializer(serializers.ModelSerializer):
    sender_email = serializers.EmailField(source="sender.email", read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Message
        fields = [
            "id",
            "sender_id",
            "sender_email",
            "content",
            "created_at",
            "attachments",
        ]


class MessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["id", "content", "created_at"]
        read_only_fields = ["id", "created_at"]
        extra_kwargs = {"content": {"required": False, "allow_blank": True}}

    def validate_content(self, value):
        # Text-only JSON create still requires non-blank content; multipart
        # create validates payload (text and/or files) in the view.
        if self.context.get("allow_blank_content"):
            return (value or "").strip()
        try:
            return clean_message_content(value)
        except MessageSendDenied as exc:
            raise serializers.ValidationError(exc.detail) from exc
