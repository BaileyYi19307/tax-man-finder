from rest_framework import serializers

from inquiries.models import Inquiry
from services.models import Service
from users.models import User
from .models import ACTIVE_BOOKING_STATUSES, Booking, BookingStatus
from django.utils import timezone


class BookingSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    accountant_email = serializers.CharField(source="accountant.email", read_only=True)
    client_email = serializers.CharField(source="client.email", read_only=True)
    inquiry_id = serializers.IntegerField(source="inquiry.id", read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id",
            "inquiry",
            "inquiry_id",
            "client",
            "client_email",
            "accountant",
            "accountant_email",
            "starts_at",
            "ends_at",
            "status",
            "status_label",
            "created_at",
            "updated_at",
            "name",
            "date",
            "service",
        ]
        read_only_fields = fields


class BookingCreateSerializer(serializers.Serializer):
    """Create a pending booking on an existing open inquiry."""

    inquiry = serializers.PrimaryKeyRelatedField(queryset=Inquiry.objects.all())
    starts_at = serializers.DateTimeField()
    note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_inquiry(self, inquiry):
        request = self.context["request"]
        if inquiry.client_id != request.user.id:
            raise serializers.ValidationError(
                "Only the inquiry client can request a consultation."
            )
        if inquiry.status != Inquiry.StatusChoices.OPEN:
            raise serializers.ValidationError(
                "Cannot request a consultation on a closed inquiry."
            )
        if Booking.objects.filter(
            inquiry=inquiry, status__in=ACTIVE_BOOKING_STATUSES
        ).exists():
            raise serializers.ValidationError(
                "This inquiry already has an active booking."
            )
        return inquiry

    def validate_starts_at(self, value):
        if timezone.is_naive(value):
            value = timezone.make_aware(value)
        return value

    def create(self, validated_data):
        inquiry = validated_data["inquiry"]
        starts_at = validated_data["starts_at"]
        ends_at = Booking.compute_ends_at(starts_at)
        note = (validated_data.get("note") or "").strip()

        booking = Booking.objects.create(
            inquiry=inquiry,
            client=inquiry.client,
            accountant=inquiry.accountant,
            starts_at=starts_at,
            ends_at=ends_at,
            status=BookingStatus.PENDING,
            name="",
            date=starts_at,
            service=inquiry.service,
        )

        if note:
            from chats.models import Message

            Message.objects.create(
                inquiry=inquiry,
                sender=self.context["request"].user,
                content=note,
            )
        return booking


class RequestConsultationSerializer(serializers.Serializer):
    inquiry = serializers.PrimaryKeyRelatedField(
        queryset=Inquiry.objects.all(), required=False, allow_null=True
    )
    service = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(),
        required=False,
        allow_null=True,
    )
    accountant = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
    )
    starts_at = serializers.DateTimeField()
    content = serializers.CharField()

    def validate_content(self, value):
        cleaned = (value or "").strip()
        if not cleaned:
            raise serializers.ValidationError("Message content cannot be blank.")
        return cleaned

    def validate_starts_at(self, value):
        if timezone.is_naive(value):
            value = timezone.make_aware(value)
        return value

    def validate(self, data):
        request = self.context["request"]
        inquiry = data.get("inquiry")

        if inquiry is not None:
            if inquiry.client_id != request.user.id:
                raise serializers.ValidationError(
                    {"inquiry": "Only the inquiry client can request a consultation."}
                )
            if inquiry.status != Inquiry.StatusChoices.OPEN:
                raise serializers.ValidationError(
                    {"inquiry": "Cannot request a consultation on a closed inquiry."}
                )
            if Booking.objects.filter(
                inquiry=inquiry, status__in=ACTIVE_BOOKING_STATUSES
            ).exists():
                raise serializers.ValidationError(
                    {"inquiry": "This inquiry already has an active booking."}
                )
            data["accountant"] = inquiry.accountant
            data["service"] = inquiry.service
            return data

        service = data.get("service")
        accountant = data.get("accountant")
        if service is not None:
            data["accountant"] = service.accountant
        elif accountant is None:
            raise serializers.ValidationError(
                {
                    "accountant": (
                        "Select an accountant when no service or inquiry is provided."
                    )
                }
            )

        accountant = data["accountant"]
        if accountant.id == request.user.id:
            raise serializers.ValidationError(
                {"accountant": "You cannot request a consultation with yourself."}
            )
        return data
