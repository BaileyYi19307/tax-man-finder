import json
from datetime import timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accountants.models import AccountantProfile
from chats.models import Message
from inquiries.models import Inquiry
from services.models import Service
from users.models import User

from .lifecycle_messages import MSG_PAYMENT_COMPLETED
from .models import Booking, BookingStatus, Payment, PaymentStatus
from .stripe_service import STRIPE_UNAVAILABLE_DETAIL, handle_checkout_session_completed


@override_settings(
    STRIPE_SECRET_KEY="sk_test_fake",
    STRIPE_WEBHOOK_SECRET="whsec_fake",
    ALLOW_DEMO_PAYMENT=False,
    FRONTEND_URL="http://localhost:3000",
)
class StripeCheckoutTests(TestCase):
    """Stripe Checkout path: mocks SDK; demo payment stays disabled."""
    @classmethod
    def setUpTestData(cls):
        cls.client_user = User.objects.create_user(
            email="stripe.client@test.com",
            password="password123",
            is_accountant=False,
            is_verified=True,
        )
        cls.accountant_user = User.objects.create_user(
            email="stripe.acct@test.com",
            password="password123",
            is_accountant=True,
            is_verified=True,
        )
        AccountantProfile.objects.create(
            user=cls.accountant_user,
            bio="Bio",
            credentials="CPA",
            years_experience=5,
        )
        cls.service = Service.objects.create(
            name="Paid consult",
            description="Paid",
            accountant=cls.accountant_user,
            pricing_type=Service.PricingType.FIXED,
            consultation_fee=Decimal("50.00"),
            cancellation_policy="24h notice",
        )
        cls.starts = timezone.now() + timedelta(days=2)

    def setUp(self):
        self.api = APIClient()
        inquiry = Inquiry.objects.create(
            client=self.client_user,
            accountant=self.accountant_user,
            status=Inquiry.StatusChoices.OPEN,
        )
        self.api.force_authenticate(user=self.client_user)
        created = self.api.post(
            reverse("bookings-list"),
            {
                "inquiry": inquiry.id,
                "service": self.service.id,
                "starts_at": self.starts.isoformat(),
            },
            format="json",
        )
        self.booking_id = created.data["id"]
        self.api.force_authenticate(user=self.accountant_user)
        self.api.post(reverse("bookings-accept", args=[self.booking_id]))
        self.payment = Payment.objects.get(booking_id=self.booking_id)

    @patch("bookings.stripe_service.stripe.checkout.Session.create")
    def test_client_can_start_checkout(self, mock_create):
        mock_create.return_value = MagicMock(
            id="cs_test_123",
            url="https://checkout.stripe.test/session",
        )
        self.api.force_authenticate(user=self.client_user)
        response = self.api.post(reverse("bookings-checkout", args=[self.booking_id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["checkout_url"], "https://checkout.stripe.test/session")
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.checkout_session_id, "cs_test_123")
        mock_create.assert_called_once()
        call_kwargs = mock_create.call_args.kwargs
        self.assertEqual(call_kwargs["metadata"]["payment_id"], str(self.payment.id))
        self.assertEqual(call_kwargs["line_items"][0]["price_data"]["unit_amount"], 5000)

    @patch("bookings.stripe_service.stripe.checkout.Session.retrieve")
    def test_checkout_recovers_completed_session_when_webhook_missed(self, mock_retrieve):
        self.payment.checkout_session_id = "cs_test_done"
        self.payment.save(update_fields=["checkout_session_id", "updated_at"])
        mock_retrieve.return_value = MagicMock(
            status="complete",
            payment_status="paid",
            currency="usd",
            amount_total=5000,
            payment_intent="pi_test_recover",
            metadata={"payment_id": str(self.payment.id), "booking_id": str(self.booking_id)},
            to_dict=lambda: {
                "payment_status": "paid",
                "currency": "usd",
                "amount_total": 5000,
                "payment_intent": "pi_test_recover",
                "metadata": {
                    "payment_id": str(self.payment.id),
                    "booking_id": str(self.booking_id),
                },
            },
        )
        self.api.force_authenticate(user=self.client_user)
        response = self.api.post(reverse("bookings-checkout", args=[self.booking_id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("payment=success", response.data["checkout_url"])
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentStatus.PAID)
        booking = Booking.objects.get(pk=self.booking_id)
        self.assertEqual(booking.status, BookingStatus.CONFIRMED)

    @override_settings(STRIPE_SECRET_KEY="")
    def test_checkout_unavailable_without_stripe(self):
        self.api.force_authenticate(user=self.client_user)
        response = self.api.post(reverse("bookings-checkout", args=[self.booking_id]))
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    @patch("bookings.stripe_service.stripe.checkout.Session.create")
    def test_checkout_maps_stripe_api_errors_safely(self, mock_create):
        import stripe

        mock_create.side_effect = stripe.APIConnectionError("socket hang up to api.stripe.com")
        self.api.force_authenticate(user=self.client_user)
        response = self.api.post(reverse("bookings-checkout", args=[self.booking_id]))
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(response.data["detail"], STRIPE_UNAVAILABLE_DETAIL)
        body = str(response.data)
        self.assertNotIn("socket hang up", body)
        self.assertNotIn("api.stripe.com", body)

    @patch("bookings.stripe_service.stripe.checkout.Session.create")
    def test_checkout_maps_stripe_invalid_request_safely(self, mock_create):
        import stripe

        mock_create.side_effect = stripe.InvalidRequestError(
            "No such customer: cus_secret",
            param="customer",
        )
        self.api.force_authenticate(user=self.client_user)
        response = self.api.post(reverse("bookings-checkout", args=[self.booking_id]))
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(response.data["detail"], STRIPE_UNAVAILABLE_DETAIL)
        self.assertNotIn("cus_secret", str(response.data))

    @override_settings(ALLOW_DEMO_PAYMENT=False)
    def test_demo_payment_disabled_when_configured(self):
        self.api.force_authenticate(user=self.client_user)
        response = self.api.post(
            reverse("bookings-complete-demo-payment", args=[self.booking_id])
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_webhook_completes_payment(self):
        session = {
            "payment_status": "paid",
            "currency": "usd",
            "amount_total": 5000,
            "payment_intent": "pi_test_123",
            "metadata": {"payment_id": str(self.payment.id), "booking_id": str(self.booking_id)},
        }
        handle_checkout_session_completed(session)
        self.payment.refresh_from_db()
        booking = Booking.objects.get(pk=self.booking_id)
        self.assertEqual(booking.status, BookingStatus.CONFIRMED)
        self.assertEqual(self.payment.status, PaymentStatus.PAID)
        self.assertEqual(self.payment.processor_reference, "pi_test_123")
        msg = Message.objects.filter(inquiry=booking.inquiry, is_system=True).latest("created_at")
        self.assertEqual(msg.content, MSG_PAYMENT_COMPLETED)

    def test_webhook_idempotent(self):
        session = {
            "payment_status": "paid",
            "currency": "usd",
            "amount_total": 5000,
            "payment_intent": "pi_test_123",
            "metadata": {"payment_id": str(self.payment.id)},
        }
        handle_checkout_session_completed(session)
        handle_checkout_session_completed(session)
        self.assertEqual(
            Message.objects.filter(
                inquiry=self.payment.booking.inquiry_id,
                content=MSG_PAYMENT_COMPLETED,
            ).count(),
            1,
        )

    @patch("bookings.stripe_webhook.construct_webhook_event")
    def test_webhook_endpoint_accepts_checkout_completed(self, mock_construct):
        session = MagicMock()
        session.to_dict.return_value = {
            "payment_status": "paid",
            "currency": "usd",
            "amount_total": 5000,
            "payment_intent": "pi_test_456",
            "metadata": {"payment_id": str(self.payment.id)},
        }
        event = MagicMock()
        event.type = "checkout.session.completed"
        event.data.object = session
        mock_construct.return_value = event

        response = self.client.post(
            reverse("stripe-webhook"),
            data=b"{}",
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="sig",
        )
        self.assertEqual(response.status_code, 200)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentStatus.PAID)

    def test_webhook_rejects_amount_mismatch(self):
        session = {
            "payment_status": "paid",
            "currency": "usd",
            "amount_total": 1,
            "payment_intent": "pi_bad",
            "metadata": {"payment_id": str(self.payment.id)},
        }
        with self.assertRaises(Exception):
            handle_checkout_session_completed(session)
