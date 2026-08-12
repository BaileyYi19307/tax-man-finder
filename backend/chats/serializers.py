
from rest_framework import serializers
from .models import Message

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
        # Field-level validation: reject empty / whitespace-only bodies
        cleaned = (value or "").strip()
        if not cleaned:
            raise serializers.ValidationError("Message content cannot be blank.")
        return cleaned
