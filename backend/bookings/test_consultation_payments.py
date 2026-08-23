from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accountants.models import AccountantProfile
from chats.models import Message
from inquiries.models import Inquiry
from services.models import Service
from users.models import User
from .models import Booking, BookingStatus, Payment, PaymentStatus
from .payment_service import mark_payable


class ConsultationPaymentTests(TestCase):
    def setUp(self):
        self.api = APIClient()

    @classmethod
    def setUpTestData(cls):
        cls.client_user = User.objects.create_user(
            email="pay.client@test.com",
            password="password123",
            is_accountant=False,
            is_verified=True,
        )
        cls.accountant_user = User.objects.create_user(
            email="pay.acct@test.com",
            password="password123",
            is_accountant=True,
            is_verified=True,
        )
        cls.outsider = User.objects.create_user(
            email="pay.outsider@test.com",
            password="password123",
            is_accountant=False,
            is_verified=True,
        )
        AccountantProfile.objects.create(
            user=cls.accountant_user,
            bio="Bio",
            credentials="CPA",
            years_experience=5,
        )
        cls.free_service = Service.objects.create(
            name="Free intro consult",
            description="No consultation fee",
            accountant=cls.accountant_user,
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            consultation_fee=Decimal("0.00"),
            cancellation_policy="Cancel anytime before the meeting.",
        )
        cls.paid_service = Service.objects.create(
            name="Paid strategy consult",
            description="Paid consultation",
            accountant=cls.accountant_user,
            pricing_type=Service.PricingType.FIXED,
            indicative_price=Decimal("350.00"),
            consultation_fee=Decimal("50.00"),
            cancellation_policy="Full refund if cancelled 24h before.",
        )
        cls.starts = timezone.now() + timedelta(days=2)

    def _auth(self, user):
        self.api.force_authenticate(user=user)

    def _open_inquiry(self, service):
        inquiry = Inquiry.objects.create(
            client=self.client_user,
            accountant=self.accountant_user,
            service=service,
            status=Inquiry.StatusChoices.OPEN,
        )
        Message.objects.create(
            inquiry=inquiry, sender=self.client_user, content="Hello"
        )
        return inquiry

    def _request_booking(self, inquiry, starts_at=None):
        self._auth(self.client_user)
        response = self.api.post(
            reverse("bookings-list"),
            {
                "inquiry": inquiry.id,
                "starts_at": (starts_at or self.starts).isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response

    def test_free_consultation_accept_confirms_without_payment(self):
        inquiry = self._open_inquiry(self.free_service)
        created = self._request_booking(inquiry)
        booking = Booking.objects.get(pk=created.data["id"])
        self.assertEqual(booking.consultation_fee, Decimal("0.00"))
        self.assertEqual(booking.cancellation_policy, self.free_service.cancellation_policy)

        self._auth(self.accountant_user)
        accept = self.api.post(reverse("bookings-accept", args=[booking.id]))
        self.assertEqual(accept.status_code, status.HTTP_200_OK)
        self.assertEqual(accept.data["status"], BookingStatus.CONFIRMED)
        self.assertIsNone(accept.data["payment"])
        self.assertFalse(Payment.objects.filter(booking=booking).exists())

    def test_paid_consultation_accept_awaits_payment_then_demo_pay_confirms(self):
        inquiry = self._open_inquiry(self.paid_service)
        created = self._request_booking(inquiry)
        booking_id = created.data["id"]
        self.assertEqual(created.data["consultation_fee"], "50.00")

        self._auth(self.accountant_user)
        accept = self.api.post(reverse("bookings-accept", args=[booking_id]))
        self.assertEqual(accept.status_code, status.HTTP_200_OK)
        self.assertEqual(accept.data["status"], BookingStatus.AWAITING_PAYMENT)
        self.assertIsNotNone(accept.data["payment"])
        self.assertEqual(accept.data["payment"]["status"], PaymentStatus.PENDING)
        self.assertEqual(accept.data["payment"]["amount"], "50.00")

        payment = Payment.objects.get(booking_id=booking_id)
        self.assertEqual(payment.amount, Decimal("50.00"))
        self.assertEqual(payment.status, PaymentStatus.PENDING)

        self._auth(self.client_user)
        paid = self.api.post(
            reverse("bookings-complete-demo-payment", args=[booking_id]),
            {"amount": "1.00", "status": "payable"},
            format="json",
        )
        self.assertEqual(paid.status_code, status.HTTP_200_OK)
        self.assertEqual(paid.data["status"], BookingStatus.CONFIRMED)
        self.assertEqual(paid.data["payment"]["status"], PaymentStatus.PAID)
        self.assertEqual(paid.data["payment"]["amount"], "50.00")

        payment.refresh_from_db()
        self.assertEqual(payment.status, PaymentStatus.PAID)
        self.assertIsNotNone(payment.paid_at)
        self.assertIsNone(payment.payable_at)

    def test_only_client_can_complete_demo_payment(self):
        inquiry = self._open_inquiry(self.paid_service)
        created = self._request_booking(inquiry)
        booking_id = created.data["id"]
        self._auth(self.accountant_user)
        self.api.post(reverse("bookings-accept", args=[booking_id]))

        self._auth(self.accountant_user)
        deny_acct = self.api.post(
            reverse("bookings-complete-demo-payment", args=[booking_id])
        )
        self.assertEqual(deny_acct.status_code, status.HTTP_403_FORBIDDEN)

        self._auth(self.outsider)
        deny_out = self.api.post(
            reverse("bookings-complete-demo-payment", args=[booking_id])
        )
        self.assertEqual(deny_out.status_code, status.HTTP_404_NOT_FOUND)

        booking = Booking.objects.get(pk=booking_id)
        self.assertEqual(booking.status, BookingStatus.AWAITING_PAYMENT)
        self.assertEqual(booking.payment.status, PaymentStatus.PENDING)

    def test_fee_snapshot_ignores_later_service_price_change(self):
        inquiry = self._open_inquiry(self.paid_service)
        created = self._request_booking(inquiry)
        booking = Booking.objects.get(pk=created.data["id"])
        self.assertEqual(booking.consultation_fee, Decimal("50.00"))

        self.paid_service.consultation_fee = Decimal("75.00")
        self.paid_service.save(update_fields=["consultation_fee", "updated_at"])

        booking.refresh_from_db()
        self.assertEqual(booking.consultation_fee, Decimal("50.00"))

        self._auth(self.accountant_user)
        accept = self.api.post(reverse("bookings-accept", args=[booking.id]))
        self.assertEqual(accept.data["payment"]["amount"], "50.00")

        self._auth(self.client_user)
        paid = self.api.post(
            reverse("bookings-complete-demo-payment", args=[booking.id])
        )
        self.assertEqual(paid.data["payment"]["amount"], "50.00")
        self.assertEqual(Payment.objects.get(booking=booking).amount, Decimal("50.00"))

    def test_decline_still_works_for_paid_service_pending(self):
        inquiry = self._open_inquiry(self.paid_service)
        created = self._request_booking(inquiry)
        self._auth(self.accountant_user)
        decline = self.api.post(
            reverse("bookings-decline", args=[created.data["id"]])
        )
        self.assertEqual(decline.status_code, status.HTTP_200_OK)
        self.assertEqual(decline.data["status"], BookingStatus.DECLINED)
        self.assertFalse(Payment.objects.exists())

    def test_cancel_from_awaiting_payment(self):
        inquiry = self._open_inquiry(self.paid_service)
        created = self._request_booking(inquiry)
        booking_id = created.data["id"]
        self._auth(self.accountant_user)
        self.api.post(reverse("bookings-accept", args=[booking_id]))
        self._auth(self.client_user)
        cancel = self.api.post(reverse("bookings-cancel", args=[booking_id]))
        self.assertEqual(cancel.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel.data["status"], BookingStatus.CANCELLED)

    def test_paid_payment_stays_paid_until_consultation_ends(self):
        inquiry = self._open_inquiry(self.paid_service)
        created = self._request_booking(inquiry)
        booking_id = created.data["id"]

        self._auth(self.accountant_user)
        self.api.post(reverse("bookings-accept", args=[booking_id]))
        self._auth(self.client_user)
        paid = self.api.post(
            reverse("bookings-complete-demo-payment", args=[booking_id])
        )
        self.assertEqual(paid.data["payment"]["status"], PaymentStatus.PAID)
        self.assertIsNone(paid.data["payment"]["payable_at"])

        payment = Payment.objects.get(booking_id=booking_id)
        self.assertEqual(payment.status, PaymentStatus.PAID)

        # Simulate meeting end, then release.
        booking = Booking.objects.get(pk=booking_id)
        booking.starts_at = timezone.now() - timedelta(hours=2)
        booking.ends_at = timezone.now() - timedelta(hours=1)
        booking.save(update_fields=["starts_at", "ends_at", "updated_at"])

        mark_payable(payment)
        payment.refresh_from_db()
        self.assertEqual(payment.status, PaymentStatus.PAYABLE)
        self.assertIsNotNone(payment.payable_at)

        self._auth(self.accountant_user)
        listed = self.api.get(reverse("bookings-list"))
        row = next(b for b in listed.data if b["id"] == booking_id)
        self.assertEqual(row["payment"]["status"], PaymentStatus.PAYABLE)

    def test_payment_becomes_payable_immediately_if_meeting_already_ended(self):
        inquiry = self._open_inquiry(self.paid_service)
        past_start = timezone.now() - timedelta(hours=2)
        created = self._request_booking(inquiry, starts_at=past_start)
        booking_id = created.data["id"]

        self._auth(self.accountant_user)
        self.api.post(reverse("bookings-accept", args=[booking_id]))
        self._auth(self.client_user)
        paid = self.api.post(
            reverse("bookings-complete-demo-payment", args=[booking_id])
        )
        self.assertEqual(paid.data["status"], BookingStatus.CONFIRMED)
        self.assertEqual(paid.data["payment"]["status"], PaymentStatus.PAYABLE)
