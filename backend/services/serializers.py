from decimal import Decimal, InvalidOperation

from rest_framework import serializers

from .models import Service


class ServiceSerializer(serializers.ModelSerializer):
    """Validates and creates a service."""

    # Write-only: Free vs Paid consultation. Maps onto consultation_fee.
    # Paid requires a positive fee; Free stores 0.00.
    consultation_is_paid = serializers.BooleanField(
        required=False, allow_null=True, write_only=True
    )

    def validate_consultation_fee(self, value):
        if value is None:
            return value
        try:
            amount = Decimal(value)
        except (InvalidOperation, TypeError) as exc:
            raise serializers.ValidationError(
                "Consultation fee must be a valid amount."
            ) from exc
        if amount < 0:
            raise serializers.ValidationError(
                "Consultation fee cannot be negative."
            )
        return amount

    def validate(self, data):
        pricing_type = data.get("pricing_type")
        if pricing_type is None and self.instance is not None:
            pricing_type = self.instance.pricing_type
        if pricing_type in (
            Service.PricingType.FIXED,
            Service.PricingType.HOURLY,
        ):
            price = data.get("indicative_price", serializers.empty)
            if price is serializers.empty and self.instance is not None:
                price = self.instance.indicative_price
            if not price:
                raise serializers.ValidationError(
                    "Indicative price is required for fixed/hourly pricing"
                )

        is_paid = data.pop("consultation_is_paid", None)
        if is_paid is True:
            fee = data.get("consultation_fee", serializers.empty)
            if fee is serializers.empty and self.instance is not None:
                fee = self.instance.consultation_fee
            if fee is None or fee == serializers.empty or Decimal(fee) <= 0:
                raise serializers.ValidationError(
                    {
                        "consultation_fee": (
                            "A positive consultation fee is required for paid consultations."
                        )
                    }
                )
        elif is_paid is False:
            data["consultation_fee"] = Decimal("0.00")

        return data

    class Meta:
        model = Service
        fields = "__all__"
        # Set from request.user in ServicesViewSet.perform_create — not from the client body
        read_only_fields = ["accountant"]


