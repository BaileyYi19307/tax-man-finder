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
from .lifecycle_messages import (
    MSG_ACCEPTED_FREE,
    MSG_ACCEPTED_PAID,
    MSG_CANCELLED,
    MSG_DECLINED,
    MSG_PAYMENT_COMPLETED,
)
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

    def _open_inquiry(self):
        inquiry = Inquiry.objects.create(
            client=self.client_user,
            accountant=self.accountant_user,
            status=Inquiry.StatusChoices.OPEN,
        )
        Message.objects.create(
            inquiry=inquiry, sender=self.client_user, content="Hello"
        )
        return inquiry

    def _request_booking(self, inquiry, service, starts_at=None):
        self._auth(self.client_user)
        response = self.api.post(
            reverse("bookings-list"),
            {
                "inquiry": inquiry.id,
                "service": service.id,
                "starts_at": (starts_at or self.starts).isoformat(),
            },
            format="json",
        )
        return response

    def test_free_consultation_accept_confirms_without_payment(self):
        inquiry = self._open_inquiry()
        created = self._request_booking(inquiry, self.free_service)
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        booking = Booking.objects.get()
        self.assertEqual(booking.consultation_fee, Decimal("0.00"))
        self.assertEqual(booking.service_id, self.free_service.id)
        self.assertEqual(booking.cancellation_policy, self.free_service.cancellation_policy)

        self._auth(self.accountant_user)
        accept = self.api.post(reverse("bookings-accept", args=[booking.id]))
        self.assertEqual(accept.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, BookingStatus.CONFIRMED)
        self.assertFalse(Payment.objects.filter(booking=booking).exists())

    def test_paid_consultation_accept_awaits_payment_then_demo_pay_confirms(self):
        inquiry = self._open_inquiry()
        created = self._request_booking(inquiry, self.paid_service)
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["consultation_fee"], "50.00")
        booking = Booking.objects.get()
        self.assertEqual(booking.service_id, self.paid_service.id)

        self._auth(self.accountant_user)
        accept = self.api.post(reverse("bookings-accept", args=[booking.id]))
        self.assertEqual(accept.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, BookingStatus.AWAITING_PAYMENT)
        payment = Payment.objects.get(booking=booking)
        self.assertEqual(payment.status, PaymentStatus.PENDING)
        self.assertEqual(payment.amount, Decimal("50.00"))

        self._auth(self.client_user)
        paid = self.api.post(
            reverse("bookings-complete-demo-payment", args=[booking.id])
        )
        self.assertEqual(paid.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        payment.refresh_from_db()
        self.assertEqual(booking.status, BookingStatus.CONFIRMED)
        self.assertEqual(payment.status, PaymentStatus.PAID)
        self.assertIsNotNone(payment.paid_at)

    def test_outsider_cannot_complete_demo_payment(self):
        inquiry = self._open_inquiry()
        created = self._request_booking(inquiry, self.paid_service)
        booking_id = created.data["id"]
        self._auth(self.accountant_user)
        self.api.post(reverse("bookings-accept", args=[booking_id]))

        self._auth(self.outsider)
        denied = self.api.post(
            reverse("bookings-complete-demo-payment", args=[booking_id])
        )
        self.assertEqual(denied.status_code, status.HTTP_404_NOT_FOUND)

    def test_fee_snapshot_ignores_later_service_edits(self):
        inquiry = self._open_inquiry()
        created = self._request_booking(inquiry, self.paid_service)
        booking = Booking.objects.get(pk=created.data["id"])
        self.assertEqual(booking.consultation_fee, Decimal("50.00"))
        self.assertEqual(
            booking.cancellation_policy, self.paid_service.cancellation_policy
        )

        self.paid_service.consultation_fee = Decimal("75.00")
        self.paid_service.cancellation_policy = "Changed later"
        self.paid_service.save(
            update_fields=["consultation_fee", "cancellation_policy", "updated_at"]
        )

        booking.refresh_from_db()
        self.assertEqual(booking.consultation_fee, Decimal("50.00"))
        self.assertEqual(
            booking.cancellation_policy, "Full refund if cancelled 24h before."
        )

    def test_accountant_cannot_complete_demo_payment(self):
        inquiry = self._open_inquiry()
        created = self._request_booking(inquiry, self.paid_service)
        booking_id = created.data["id"]
        self._auth(self.accountant_user)
        self.api.post(reverse("bookings-accept", args=[booking_id]))
        denied = self.api.post(
            reverse("bookings-complete-demo-payment", args=[booking_id])
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

    def test_demo_payment_rejected_when_not_awaiting(self):
        inquiry = self._open_inquiry()
        created = self._request_booking(inquiry, self.paid_service)
        booking_id = created.data["id"]
        self._auth(self.client_user)
        denied = self.api.post(
            reverse("bookings-complete-demo-payment", args=[booking_id])
        )
        self.assertEqual(denied.status_code, status.HTTP_400_BAD_REQUEST)

    def test_paid_payment_stays_paid_until_consultation_ends(self):
        inquiry = self._open_inquiry()
        created = self._request_booking(inquiry, self.paid_service)
        booking_id = created.data["id"]
        self._auth(self.accountant_user)
        self.api.post(reverse("bookings-accept", args=[booking_id]))
        self._auth(self.client_user)
        self.api.post(reverse("bookings-complete-demo-payment", args=[booking_id]))

        payment = Payment.objects.get(booking_id=booking_id)
        self.assertEqual(payment.status, PaymentStatus.PAID)
        # Before ends_at, listing should still report paid (not payable).
        listed = self.api.get(reverse("bookings-list"))
        row = next(b for b in listed.data if b["id"] == booking_id)
        self.assertEqual(row["payment"]["status"], PaymentStatus.PAID)

        booking = Booking.objects.get(pk=booking_id)
        booking.starts_at = timezone.now() - timedelta(hours=2)
        booking.ends_at = timezone.now() - timedelta(hours=1)
        booking.save(update_fields=["starts_at", "ends_at", "updated_at"])

        listed = self.api.get(reverse("bookings-list"))
        row = next(b for b in listed.data if b["id"] == booking_id)
        self.assertEqual(row["payment"]["status"], PaymentStatus.PAYABLE)

    def test_payment_becomes_payable_immediately_if_meeting_already_ended(self):
        inquiry = self._open_inquiry()
        past_start = timezone.now() - timedelta(hours=2)
        created = self._request_booking(
            inquiry, self.paid_service, starts_at=past_start
        )
        booking_id = created.data["id"]

        self._auth(self.accountant_user)
        self.api.post(reverse("bookings-accept", args=[booking_id]))
        self._auth(self.client_user)
        paid = self.api.post(
            reverse("bookings-complete-demo-payment", args=[booking_id])
        )
        self.assertEqual(paid.data["status"], BookingStatus.CONFIRMED)
        self.assertEqual(paid.data["payment"]["status"], PaymentStatus.PAYABLE)

    def _latest_system_message(self, inquiry):
        return (
            Message.objects.filter(inquiry=inquiry, is_system=True)
            .order_by("-created_at", "-id")
            .first()
        )

    def test_accept_posts_paid_and_free_system_messages(self):
        inquiry = self._open_inquiry()
        free_booking = Booking.objects.get(
            pk=self._request_booking(inquiry, self.free_service).data["id"]
        )
        self._auth(self.accountant_user)
        self.api.post(reverse("bookings-accept", args=[free_booking.id]))
        free_msg = self._latest_system_message(inquiry)
        self.assertIsNotNone(free_msg)
        self.assertEqual(free_msg.content, MSG_ACCEPTED_FREE)
        self.assertEqual(free_msg.sender_id, self.accountant_user.id)

        self._auth(self.client_user)
        self.api.post(reverse("bookings-cancel", args=[free_booking.id]))

        paid_booking = Booking.objects.get(
            pk=self._request_booking(
                inquiry,
                self.paid_service,
                starts_at=self.starts + timedelta(hours=2),
            ).data["id"]
        )
        self._auth(self.accountant_user)
        accept = self.api.post(reverse("bookings-accept", args=[paid_booking.id]))
        self.assertEqual(accept.status_code, status.HTTP_200_OK)
        paid_msg = self._latest_system_message(inquiry)
        self.assertIsNotNone(paid_msg)
        self.assertEqual(paid_msg.content, MSG_ACCEPTED_PAID)

    def test_decline_cancel_and_payment_post_system_messages(self):
        inquiry = self._open_inquiry()
        booking_id = self._request_booking(inquiry, self.paid_service).data["id"]

        self._auth(self.accountant_user)
        self.api.post(reverse("bookings-decline", args=[booking_id]))
        self.assertEqual(self._latest_system_message(inquiry).content, MSG_DECLINED)

        booking_id = self._request_booking(inquiry, self.paid_service).data["id"]
        self._auth(self.accountant_user)
        self.api.post(reverse("bookings-accept", args=[booking_id]))
        self._auth(self.client_user)
        self.api.post(reverse("bookings-complete-demo-payment", args=[booking_id]))
        self.assertEqual(
            self._latest_system_message(inquiry).content, MSG_PAYMENT_COMPLETED
        )

        self.api.post(reverse("bookings-cancel", args=[booking_id]))
        self.assertEqual(self._latest_system_message(inquiry).content, MSG_CANCELLED)

    def test_different_services_same_inquiry_snapshot_correctly(self):
        inquiry = self._open_inquiry()
        free = self._request_booking(inquiry, self.free_service)
        self.assertEqual(free.status_code, status.HTTP_201_CREATED)
        self.assertEqual(free.data["consultation_fee"], "0.00")
        self.assertEqual(free.data["service"], self.free_service.id)

        self._auth(self.client_user)
        self.api.post(reverse("bookings-cancel", args=[free.data["id"]]))

        paid = self._request_booking(
            inquiry, self.paid_service, starts_at=self.starts + timedelta(days=1)
        )
        self.assertEqual(paid.status_code, status.HTTP_201_CREATED)
        self.assertEqual(paid.data["consultation_fee"], "50.00")
        self.assertEqual(paid.data["service"], self.paid_service.id)
        self.assertEqual(Inquiry.objects.filter(status="open").count(), 1)
