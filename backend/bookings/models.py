from datetime import timedelta

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from inquiries.models import Inquiry
from services.models import Service


class BookingStatus(models.TextChoices):
    PENDING = "pending", _("Pending")
    CONFIRMED = "confirmed", _("Confirmed")
    DECLINED = "declined", _("Declined")
    CANCELLED = "cancelled", _("Cancelled")


ACTIVE_BOOKING_STATUSES = (
    BookingStatus.PENDING,
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Legacy columns kept nullable during transition (Phase 10 may drop later).
    name = models.CharField(max_length=255, blank=True, default="")
    date = models.DateTimeField(null=True, blank=True)
    service = models.ForeignKey(
        Service,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=Q(ends_at__gt=models.F("starts_at")),
                name="booking_ends_after_starts",
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
