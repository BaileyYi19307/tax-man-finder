from django.db import models
from django.conf import settings


class ServiceCategory(models.Model):
    """Platform-managed searchable category for accountant offerings."""

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=64, unique=True)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name_plural = "service categories"

    def __str__(self):
        return self.name


class Service(models.Model):
    """Accountant-owned bookable offering (product term: offering)."""

    class PricingType(models.TextChoices):
        FIXED = "fixed", "Fixed"
        HOURLY = "hourly", "Hourly"
        CONSULTATION_REQUIRED = "consultation_required", "Consultation Required"

    name = models.CharField(max_length=255)
    description = models.TextField()
    accountant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="services",
    )
    # Nullable during foundation rollout; will become required later.
    category = models.ForeignKey(
        ServiceCategory,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="services",
    )

    pricing_type = models.CharField(
        max_length=32,
        choices=PricingType.choices,
        default=PricingType.FIXED,
    )
    indicative_price = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    # Consultation fee for booking this service (null/0 = free consultation).
    # Distinct from indicative_price (service work estimate, not a deposit).
    consultation_fee = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    cancellation_policy = models.TextField(blank=True, default="")

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
