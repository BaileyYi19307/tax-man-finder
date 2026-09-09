"""Stripe Checkout Session creation and webhook handling."""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Optional

import stripe
from django.conf import settings

from .models import Payment, PaymentStatus
from .payment_service import PaymentError, complete_consultation_payment

logger = logging.getLogger(__name__)

# Safe client-facing message for Stripe API / network failures (no SDK details).
STRIPE_UNAVAILABLE_DETAIL = (
    "Unable to start checkout with the payment provider. Please try again shortly."
)


class StripeConfigurationError(Exception):
    pass


def stripe_configured() -> bool:
    return bool(getattr(settings, "STRIPE_SECRET_KEY", ""))


def _require_stripe():
    if not stripe_configured():
        raise StripeConfigurationError("Stripe is not configured.")
    stripe.api_key = settings.STRIPE_SECRET_KEY


def _stripe_call(operation, *args, **kwargs):
    """Run a Stripe SDK call; map API/network errors to PaymentError."""
    try:
        return operation(*args, **kwargs)
    except stripe.StripeError as exc:
        logger.warning(
            "Stripe SDK error during %s: %s",
            getattr(operation, "__name__", "stripe_call"),
            type(exc).__name__,
        )
        raise PaymentError(STRIPE_UNAVAILABLE_DETAIL, "stripe_unavailable") from exc


def amount_to_cents(amount: Decimal) -> int:
    return int(normalize_currency_amount(amount) * 100)


def normalize_currency_amount(amount: Decimal) -> Decimal:
    return Decimal(amount).quantize(Decimal("0.01"))


def _checkout_success_url(booking_id: int) -> str:
    return (
        f"{settings.FRONTEND_URL}/bookings"
        f"?payment=success&booking_id={booking_id}"
    )


def _session_payload(session) -> dict:
    if isinstance(session, dict):
        return session
    to_dict = getattr(session, "to_dict", None)
    if callable(to_dict):
        return to_dict()
    return dict(session)


def _consultation_product_name(payment: Payment) -> str:
    booking = payment.booking
    if booking.service_id and booking.service:
        return f"Consultation fee — {booking.service.name}"
    return "Consultation fee"


def create_checkout_session_for_payment(payment: Payment) -> str:
    """
    Create (or reuse) a Stripe Checkout Session for a pending Payment.

    Returns the hosted Checkout URL. Amount comes from the Payment row only.
    """
    _require_stripe()
    booking = payment.booking

    if payment.checkout_session_id:
        existing = _stripe_call(
            stripe.checkout.Session.retrieve, payment.checkout_session_id
        )
        if existing.status == "open" and existing.url:
            return existing.url
        if existing.status == "complete":
            if payment.status == PaymentStatus.PENDING and existing.payment_status == "paid":
                handle_checkout_session_completed(_session_payload(existing))
                return _checkout_success_url(booking.id)
            if payment.status == PaymentStatus.PAID:
                return _checkout_success_url(booking.id)
            raise PaymentError(
                "This payment session is already complete.",
                "checkout_already_complete",
            )
        if existing.status == "expired":
            payment.checkout_session_id = ""
            payment.save(update_fields=["checkout_session_id", "updated_at"])

    session = _stripe_call(
        stripe.checkout.Session.create,
        mode="payment",
        line_items=[
            {
                "price_data": {
                    "currency": payment.currency.lower(),
                    "unit_amount": amount_to_cents(payment.amount),
                    "product_data": {
                        "name": _consultation_product_name(payment),
                        "description": (
                            f"Consultation with {booking.accountant.email} "
                            f"starting {booking.starts_at.isoformat()}"
                        ),
                    },
                },
                "quantity": 1,
            }
        ],
        metadata={
            "booking_id": str(booking.id),
            "payment_id": str(payment.id),
        },
        client_reference_id=str(booking.id),
        success_url=_checkout_success_url(booking.id),
        cancel_url=f"{settings.FRONTEND_URL}/bookings/{booking.id}/pay?cancelled=1",
    )
    payment.checkout_session_id = session.id
    payment.save(update_fields=["checkout_session_id", "updated_at"])
    if not session.url:
        raise PaymentError("Stripe did not return a checkout URL.", "stripe_error")
    return session.url


def _processor_reference_from_session(session) -> str:
    payment_intent = session.get("payment_intent")
    if payment_intent:
        if isinstance(payment_intent, str):
            return payment_intent
        return payment_intent.get("id") or session["id"]
    return session["id"]


def _verify_session_amount(session, payment: Payment) -> None:
    currency = (session.get("currency") or "").upper()
    if currency and currency != payment.currency.upper():
        raise PaymentError("Stripe currency does not match payment.", "currency_mismatch")

    amount_total = session.get("amount_total")
    if amount_total is None:
        raise PaymentError("Stripe session missing amount_total.", "stripe_error")

    expected = amount_to_cents(payment.amount)
    if int(amount_total) != expected:
        raise PaymentError(
            "Stripe charged amount does not match booking fee.",
            "amount_mismatch",
        )


def handle_checkout_session_completed(session_payload: dict) -> Optional[Payment]:
    """
    Apply domain payment success for a checkout.session.completed event.

    Idempotent for Stripe webhook retries.
    """
    if session_payload.get("payment_status") != "paid":
        return None

    metadata = session_payload.get("metadata") or {}
    payment_id = metadata.get("payment_id")
    if not payment_id:
        raise PaymentError("Stripe session missing payment_id metadata.", "stripe_error")

    payment = Payment.objects.select_related(
        "booking", "booking__client", "booking__inquiry"
    ).get(pk=int(payment_id))
    _verify_session_amount(session_payload, payment)

    processor_reference = _processor_reference_from_session(session_payload)
    updated, _ = complete_consultation_payment(
        payment,
        actor=payment.booking.client,
        processor_reference=processor_reference,
    )
    return updated


def construct_webhook_event(payload: bytes, sig_header: str):
    _require_stripe()
    secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", "")
    if not secret:
        raise StripeConfigurationError("STRIPE_WEBHOOK_SECRET is not configured.")
    return stripe.Webhook.construct_event(payload, sig_header, secret)
