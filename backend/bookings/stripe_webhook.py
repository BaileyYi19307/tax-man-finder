"""Stripe webhook endpoint (no JWT; signature verified)."""

import json
import logging

import stripe
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt

from .models import Payment
from .payment_service import PaymentError
from .stripe_service import (
    StripeConfigurationError,
    construct_webhook_event,
    handle_checkout_session_completed,
)

logger = logging.getLogger(__name__)


@csrf_exempt
def stripe_webhook_view(request):
    if request.method != "POST":
        return HttpResponse(status=405)

    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")

    try:
        event = construct_webhook_event(payload, sig_header)
    except StripeConfigurationError as exc:
        logger.warning("Stripe webhook misconfigured: %s", exc)
        return HttpResponse(str(exc), status=503)
    except ValueError as exc:
        logger.warning("Invalid Stripe webhook payload: %s", exc)
        return HttpResponse("Invalid payload", status=400)
    except stripe.error.SignatureVerificationError:
        logger.warning("Invalid Stripe webhook signature")
        return HttpResponse("Invalid signature", status=400)

    if event.type == "checkout.session.completed":
        session = event.data.object
        try:
            handle_checkout_session_completed(session.to_dict())
        except Payment.DoesNotExist:
            logger.exception("Payment not found for Stripe session")
            return HttpResponse("Payment not found", status=404)
        except PaymentError as exc:
            logger.warning("Stripe checkout completion rejected: %s", exc.detail)
            return HttpResponse(json.dumps({"detail": exc.detail}), status=400)

    return HttpResponse(status=200)
