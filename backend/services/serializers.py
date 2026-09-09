from decimal import Decimal, InvalidOperation

from rest_framework import serializers

from .category_assignment import category_is_assignable, resolve_assignable_category
from .models import Service, ServiceCategory
from .title_uniqueness import (
    DUPLICATE_SERVICE_TITLE_MESSAGE,
    find_conflicting_service,
)


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

    def validate_name(self, value):
        # Strip surrounding whitespace only; keep the accountant's capitalization.
        cleaned = str(value or "").strip()
        if not cleaned:
            raise serializers.ValidationError("Name is required.")
        return cleaned

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

    def _accountant_for_title_check(self):
        if self.instance is not None:
            return self.instance.accountant
        request = self.context.get("request")
        if request is not None and getattr(request, "user", None) is not None:
            user = request.user
            if getattr(user, "is_authenticated", False):
                return user
        return None

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
            # Narrow exception: is_active=false-only PATCH may hide legacy
            # offerings without reclassification. Reactivation and any other
            # field edits still require a valid active category.
            if not self._is_deactivate_only_patch():
                raise serializers.ValidationError(
                    {
                        "category_id": (
                            "A valid active category is required when the "
                            "service has no category, Uncategorized, or an "
                            "inactive category."
                        )
                    }
                )

        name = data.get("name", serializers.empty)
        if name is serializers.empty and self.instance is not None:
            name = self.instance.name
        if name is not serializers.empty and name is not None:
            accountant = self._accountant_for_title_check()
            if accountant is not None:
                conflict = find_conflicting_service(
                    accountant=accountant,
                    name=name,
                    exclude_pk=self.instance.pk if self.instance else None,
                )
                if conflict is not None:
                    raise serializers.ValidationError(
                        {"name": DUPLICATE_SERVICE_TITLE_MESSAGE}
                    )

        return data

    def _is_deactivate_only_patch(self) -> bool:
        """True only for partial updates whose sole payload field is is_active=false."""
        if self.instance is None or not getattr(self, "partial", False):
            return False
        if set(self.initial_data.keys()) != {"is_active"}:
            return False
        value = self.initial_data.get("is_active")
        return value is False

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
