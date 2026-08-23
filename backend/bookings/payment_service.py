"""
Consultation payment domain logic.

Demo completion and a future Stripe webhook should both call the same
success/payable transitions. No card data is collected here.
"""

from django.db import transaction
from django.utils import timezone

from .consultation import booking_requires_payment, normalize_consultation_fee
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


def mark_payment_succeeded(payment: Payment, *, processor_reference: str = "") -> Payment:
    """
    Record successful client payment and confirm the booking.

    Today the demo endpoint calls this after Complete Demo Payment.
    Later a Stripe webhook (or Checkout success handler) should call the same
    function after authoritative payment success — without changing Booking
    status anywhere else.
    """
    booking = payment.booking
    if booking.status != BookingStatus.AWAITING_PAYMENT:
        raise PaymentError(
            "Only bookings awaiting payment can be paid.",
            "invalid_booking_status",
        )
    if payment.status != PaymentStatus.PENDING:
        raise PaymentError("Payment is not pending.", "invalid_payment_status")

    amount = normalize_consultation_fee(booking.consultation_fee)
    if payment.amount != amount:
        raise PaymentError("Payment amount does not match booking fee.", "amount_mismatch")

    now = timezone.now()
    with transaction.atomic():
        payment.status = PaymentStatus.PAID
        payment.paid_at = now
        if processor_reference:
            payment.processor_reference = processor_reference
        elif not payment.processor_reference:
            payment.processor_reference = f"demo_{payment.id}_{int(now.timestamp())}"
        payment.save(
            update_fields=[
                "status",
                "paid_at",
                "processor_reference",
                "updated_at",
            ]
        )
        booking.status = BookingStatus.CONFIRMED
        booking.save(update_fields=["status", "updated_at"])
    return payment


# Back-compat alias used by earlier call sites / tests.
complete_payment = mark_payment_succeeded


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
