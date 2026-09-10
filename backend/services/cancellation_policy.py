"""Platform-defined cancellation policy codes and display wording.

Backend is the single source of truth for customer-facing policy text.
Booking snapshots copy resolved wording at create time and are never rewritten.
"""

from __future__ import annotations

from typing import Optional

# Choices values (also used on Service.cancellation_policy_code).
FREE_24H = "free_24h"
FREE_48H = "free_48h"
NON_REFUNDABLE = "non_refundable"

CANCELLATION_POLICY_CODES = (FREE_24H, FREE_48H, NON_REFUNDABLE)

CANCELLATION_POLICY_LABELS = {
    FREE_24H: (
        "Full refund if cancelled at least 24 hours before the consultation. "
        "Cancellations within 24 hours are non-refundable."
    ),
    FREE_48H: (
        "Full refund if cancelled at least 48 hours before the consultation. "
        "Cancellations within 48 hours are non-refundable."
    ),
    NON_REFUNDABLE: "The consultation fee is non-refundable after booking.",
}

# Deterministic legacy text → code (exact match after whitespace normalize).
# Do not guess arbitrary prose.
_LEGACY_TEXT_TO_CODE = {
    CANCELLATION_POLICY_LABELS[FREE_24H]: FREE_24H,
    CANCELLATION_POLICY_LABELS[FREE_48H]: FREE_48H,
    CANCELLATION_POLICY_LABELS[NON_REFUNDABLE]: NON_REFUNDABLE,
    # Known demo seed values (reset_client_demo_accountants).
    (
        "Cancel at least 24 hours before the consultation for a full refund of the "
        "consultation fee. Later cancellations are non-refundable."
    ): FREE_24H,
    (
        "Consultation fee is refundable if cancelled 48 hours or more before the meeting."
    ): FREE_48H,
}


def normalize_policy_text(text: Optional[str]) -> str:
    if not text:
        return ""
    return " ".join(str(text).split()).strip()


def is_valid_cancellation_policy_code(code: Optional[str]) -> bool:
    return bool(code) and code in CANCELLATION_POLICY_LABELS


def label_for_cancellation_policy_code(code: Optional[str]) -> str:
    if not is_valid_cancellation_policy_code(code):
        return ""
    return CANCELLATION_POLICY_LABELS[code]


def match_legacy_cancellation_policy_text(text: Optional[str]) -> Optional[str]:
    """Return a code only when legacy text deterministically matches a known value."""
    normalized = normalize_policy_text(text)
    if not normalized:
        return None
    for legacy, code in _LEGACY_TEXT_TO_CODE.items():
        if normalize_policy_text(legacy) == normalized:
            return code
    return None


def resolve_cancellation_policy_text(
    *,
    code: Optional[str] = None,
    legacy_text: Optional[str] = "",
) -> str:
    """Customer-facing wording: canonical label for a valid code, else legacy text."""
    if is_valid_cancellation_policy_code(code):
        return CANCELLATION_POLICY_LABELS[code]
    return (legacy_text or "").strip()


def resolve_service_cancellation_policy_text(service) -> str:
    return resolve_cancellation_policy_text(
        code=getattr(service, "cancellation_policy_code", None) or None,
        legacy_text=getattr(service, "cancellation_policy", "") or "",
    )


def cancellation_policy_choices_payload():
    return [
        {"code": code, "label": CANCELLATION_POLICY_LABELS[code]}
        for code in CANCELLATION_POLICY_CODES
    ]
