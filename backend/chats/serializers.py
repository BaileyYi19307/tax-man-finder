
from rest_framework import serializers
from .models import Message
from .message_rules import MessageSendDenied, clean_message_content

class MessageSerializer(serializers.ModelSerializer):
    sender_email = serializers.EmailField(source="sender.email", read_only=True)

    class Meta:
        model = Message
        fields = ["id", "sender_id","sender_email", "content", "created_at"]


class MessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["id", "content", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_content(self, value):
        try:
            return clean_message_content(value)
        except MessageSendDenied as exc:
            raise serializers.ValidationError(exc.detail) from exc
