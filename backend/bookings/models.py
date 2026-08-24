from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from inquiries.models import Inquiry
from services.models import Service


class BookingStatus(models.TextChoices):
    PENDING = "pending", _("Pending")
    AWAITING_PAYMENT = "awaiting_payment", _("Awaiting payment")
    CONFIRMED = "confirmed", _("Confirmed")
    DECLINED = "declined", _("Declined")
    CANCELLED = "cancelled", _("Cancelled")


# One active booking per inquiry (slot held through payment).
ACTIVE_BOOKING_STATUSES = (
    BookingStatus.PENDING,
    BookingStatus.AWAITING_PAYMENT,
    BookingStatus.CONFIRMED,
)

# Accountant calendar: accepted slots that block overlap.
SLOT_HELD_STATUSES = (
    BookingStatus.AWAITING_PAYMENT,
    BookingStatus.CONFIRMED,
)


class Booking(models.Model):
    inquiry = models.ForeignKey(
        Inquiry,
        on_delete=models.CASCADE,
        related_name="bookings",
    )
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bookings_as_client",
    )
    accountant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bookings_as_accountant",
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    status = models.CharField(
        max_length=20,
        choices=BookingStatus.choices,
        default=BookingStatus.PENDING,
    )
    # Snapshot of Service consultation fee at booking creation (USD).
    consultation_fee = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    # Snapshot of Service cancellation policy text at booking creation.
    cancellation_policy = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Service selected for this consultation (fee/policy snapshotted below).
    service = models.ForeignKey(
        Service,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    # Legacy display columns kept nullable during transition.
    name = models.CharField(max_length=255, blank=True, default="")
    date = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=Q(ends_at__gt=models.F("starts_at")),
                name="booking_ends_after_starts",
            ),
            models.UniqueConstraint(
                fields=["inquiry"],
                condition=Q(
                    status__in=[
                        "pending",
                        "awaiting_payment",
                        "confirmed",
                    ]
                ),
                name="unique_active_booking_per_inquiry",
            ),
        ]

    def __str__(self):
        return (
            f"Booking({self.id}) inquiry={self.inquiry_id} "
            f"{self.client.email} / {self.accountant.email} [{self.status}]"
        )

    @property
    def is_active(self):
        return self.status in ACTIVE_BOOKING_STATUSES

    @staticmethod
    def compute_ends_at(starts_at):
        return starts_at + timedelta(minutes=30)


class PaymentStatus(models.TextChoices):
    PENDING = "pending", _("Pending")
    PAID = "paid", _("Paid")
    PAYABLE = "payable", _("Payable")


class Payment(models.Model):
    """
    Consultation-fee payment for a Booking.

    Client payment and accountant payout readiness are separate:
    paid = client completed payment; payable = funds available after consultation.
    """

    booking = models.OneToOneField(
        Booking,
        on_delete=models.CASCADE,
        related_name="payment",
    )
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    payable_at = models.DateTimeField(null=True, blank=True)
    # Future Stripe PaymentIntent / charge id; demo uses a local reference.
    processor_reference = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return (
            f"Payment({self.id}) booking={self.booking_id} "
            f"{self.amount} {self.currency} [{self.status}]"
        )
