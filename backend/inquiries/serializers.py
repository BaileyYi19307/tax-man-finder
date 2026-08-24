# inquiries/serializers.py
from rest_framework import serializers

from chats.message_rules import MessageSendDenied, clean_message_content
from services.models import Service
from .models import Inquiry


class InquirySerializer(serializers.ModelSerializer):
    accountant_name = serializers.CharField(source="accountant.email", read_only=True)
    client_name = serializers.CharField(source="client.email", read_only=True)

    class Meta:
        model = Inquiry
        fields = [
            "id",
            "status",
            "created_at",
            "client",
            "accountant",
            "client_name",
            "accountant_name",
        ]


class InquiryCreateSerializer(serializers.ModelSerializer):
    # First message text — not stored on Inquiry.
    content = serializers.CharField(write_only=True)
    # Optional: resolve accountant from a service; not stored on Inquiry.
    service = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )

    def validate_content(self, value):
        try:
            return clean_message_content(value)
        except MessageSendDenied as exc:
            raise serializers.ValidationError(exc.detail) from exc

    def validate(self, data):
        service = data.get("service")
        if service is not None:
            data["accountant"] = service.accountant
        elif data.get("accountant") is None:
            raise serializers.ValidationError(
                {"accountant": "Select an accountant when no service is provided"}
            )

        client = self.context["request"].user
        if client == data.get("accountant"):
            raise serializers.ValidationError(
                {"accountant": "You can not start an inquiry with yourself"}
            )
        return data

    def create(self, validated_data):
        validated_data.pop("content", None)
        validated_data.pop("service", None)
        return super().create(validated_data)

    class Meta:
        model = Inquiry
        fields = [
            "id",
            "accountant",
            "client",
            "service",
            "created_at",
            "status",
            "content",
        ]
        read_only_fields = ["id", "client", "created_at", "status"]
        extra_kwargs = {
            "accountant": {"required": False},
        }
