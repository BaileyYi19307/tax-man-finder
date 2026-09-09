from decimal import Decimal, InvalidOperation

from rest_framework import serializers

from .category_assignment import category_is_assignable, resolve_assignable_category
from .models import Service, ServiceCategory


class ServiceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCategory
        fields = ("id", "name", "slug")


class ServiceSerializer(serializers.ModelSerializer):
    """Validates and creates a service."""

    category = ServiceCategorySerializer(read_only=True)
    category_id = serializers.IntegerField(write_only=True, required=False)

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

        category_id = data.pop("category_id", serializers.empty)
        if category_id is not serializers.empty:
            # resolve_assignable_category raises {"category_id": ...}
            data["category"] = resolve_assignable_category(category_id)
        elif self.instance is None:
            raise serializers.ValidationError(
                {"category_id": "A valid active category is required."}
            )
        elif not category_is_assignable(self.instance.category):
            raise serializers.ValidationError(
                {
                    "category_id": (
                        "A valid active category is required when the "
                        "service has no category, Uncategorized, or an "
                        "inactive category."
                    )
                }
            )

        return data

    class Meta:
        model = Service
        fields = [
            "id",
            "name",
            "description",
            "accountant",
            "category",
            "category_id",
            "pricing_type",
            "indicative_price",
            "consultation_fee",
            "consultation_is_paid",
            "cancellation_policy",
            "is_active",
            "created_at",
            "updated_at",
        ]
        # Set from request.user in ServicesViewSet.perform_create — not from the client body
        read_only_fields = ["accountant", "category", "created_at", "updated_at"]
