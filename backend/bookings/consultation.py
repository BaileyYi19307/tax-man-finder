"""Consultation fee helpers: snapshot from Service onto Booking."""

from __future__ import annotations

from decimal import Decimal
from typing import Optional, Tuple

from services.models import Service

ZERO = Decimal("0.00")


def normalize_consultation_fee(fee) -> Decimal:
    if fee is None:
        return ZERO
    value = Decimal(fee)
    return value if value > ZERO else ZERO


def snapshot_from_service(service: Optional[Service]) -> Tuple[Decimal, str]:
    """Return (consultation_fee, cancellation_policy) for a new Booking."""
    if service is None:
        return ZERO, ""
    return (
        normalize_consultation_fee(service.consultation_fee),
        (service.cancellation_policy or "").strip(),
    )


def booking_requires_payment(consultation_fee) -> bool:
    return normalize_consultation_fee(consultation_fee) > ZERO