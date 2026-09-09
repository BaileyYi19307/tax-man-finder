"""
Consultation payment domain logic.

Stripe webhooks and the optional demo endpoint both call the same
success/payable transitions. No card data is collected here.
"""

from typing import Tuple

from django.db import transaction
from django.utils import timezone

from .consultation import booking_requires_payment, normalize_consultation_fee
from .lifecycle_messages import MSG_PAYMENT_COMPLETED, post_booking_lifecycle_message
from .models import Booking, BookingStatus, Payment, PaymentStatus


class PaymentError(Exception):
    def __init__(self, detail, code="payment_error"):
        self.detail = detail
        self.code = code


def create_payment_for_booking(booking: Booking) -> Payment:
    """Create a pending Payment from the booking fee snapshot (paid consultations only)."""
    amount = normalize_consultation_fee(booking.consultation_fee)
    if not booking_requires_payment(amount):
        raise PaymentError("Free consultations do not create a payment.", "not_required")
    existing = Payment.objects.filter(booking=booking).first()
    if existing is not None:
        return existing
    return Payment.objects.create(
        booking=booking,
        amount=amount,
        currency="USD",
        status=PaymentStatus.PENDING,
    )


def mark_payment_succeeded(
    payment: Payment, *, processor_reference: str = ""
) -> Tuple[Payment, bool]:
    """
    Record successful client payment and confirm the booking.

    Returns (payment, transitioned). When transitioned is False the payment was
    already completed (idempotent retry with the same processor reference).
    """
    with transaction.atomic():
        locked = (
            Payment.objects.select_for_update()
            .select_related("booking")
            .get(pk=payment.pk)
        )
        booking = locked.booking

        if locked.status == PaymentStatus.PAID:
            if processor_reference and locked.processor_reference:
                if locked.processor_reference != processor_reference:
                    raise PaymentError(
                        "Payment already completed with a different processor reference.",
                        "processor_mismatch",
                    )
            return locked, False

        if booking.status != BookingStatus.AWAITING_PAYMENT:
            raise PaymentError(
                "Only bookings awaiting payment can be paid.",
                "invalid_booking_status",
            )
        if locked.status != PaymentStatus.PENDING:
            raise PaymentError("Payment is not pending.", "invalid_payment_status")

        amount = normalize_consultation_fee(booking.consultation_fee)
        if locked.amount != amount:
            raise PaymentError("Payment amount does not match booking fee.", "amount_mismatch")

        now = timezone.now()
        locked.status = PaymentStatus.PAID
        locked.paid_at = now
        if processor_reference:
            locked.processor_reference = processor_reference
        elif not locked.processor_reference:
            locked.processor_reference = f"demo_{locked.id}_{int(now.timestamp())}"
        locked.save(
            update_fields=[
                "status",
                "paid_at",
                "processor_reference",
                "updated_at",
            ]
        )
        booking.status = BookingStatus.CONFIRMED
        booking.save(update_fields=["status", "updated_at"])
        return locked, True


# Back-compat alias used by earlier call sites / tests.
def complete_payment(payment: Payment, *, processor_reference: str = "") -> Payment:
    updated, _ = mark_payment_succeeded(payment, processor_reference=processor_reference)
    return updated


def complete_consultation_payment(
    payment: Payment,
    *,
    actor,
    processor_reference: str = "",
) -> Tuple[Payment, bool]:
    """
    Domain payment success plus inquiry timeline notice.

    Stripe webhooks and authenticated demo completion should both call this.
    """
    updated, transitioned = mark_payment_succeeded(
        payment, processor_reference=processor_reference
    )
    if transitioned and actor is not None:
        post_booking_lifecycle_message(
            inquiry=updated.booking.inquiry,
            actor=actor,
            content=MSG_PAYMENT_COMPLETED,
        )
    return updated, transitioned


def mark_payable(payment: Payment) -> Payment:
    """
    Mark paid funds as payable to the accountant after the consultation ends.

    No bank transfer is performed — domain eligibility only. A future Stripe
    Connect transfer/payout step would run after this state.
    """
    if payment.status != PaymentStatus.PAID:
        return payment
    booking = payment.booking
    if booking.status != BookingStatus.CONFIRMED:
        return payment
    if timezone.now() < booking.ends_at:
        return payment

    payment.status = PaymentStatus.PAYABLE
    payment.payable_at = timezone.now()
    payment.save(update_fields=["status", "payable_at", "updated_at"])
    return payment


release_payable_if_due = mark_payable


def ensure_payment_payable_state(payment):
    if payment is None:
        return None
    return mark_payable(payment)
