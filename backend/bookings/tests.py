from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.db import IntegrityError, transaction
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
from .models import ACTIVE_BOOKING_STATUSES, Booking, BookingStatus


class BookingDomainTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    @classmethod
    def setUpTestData(cls):
        cls.client_user = User.objects.create_user(
            email="client1@test.com",
            password="password123",
            is_accountant=False,
            is_verified=True,
        )
        cls.accountant_user = User.objects.create_user(
            email="acct1@test.com",
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
        cls.outsider = User.objects.create_user(
            email="outsider@test.com",
            password="password123",
            is_accountant=False,
            is_verified=True,
        )
        cls.service = Service.objects.create(
            name="Tax consultation",
            description="Tax consultation",
            indicative_price=100.00,
            accountant=cls.accountant_user,
        )
        cls.inquiry = Inquiry.objects.create(
            client=cls.client_user,
            accountant=cls.accountant_user,
            status=Inquiry.StatusChoices.OPEN,
        )
        Message.objects.create(
            inquiry=cls.inquiry,
            sender=cls.client_user,
            content="Hello",
        )
        cls.starts = timezone.now() + timedelta(days=1)
        cls.create_url = reverse("bookings-list")
        cls.consult_url = reverse("request-consultation")

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def test_create_booking_requires_inquiry_and_derives_parties(self):
        self._auth(self.client_user)
        response = self.client.post(
            self.create_url,
            {"inquiry": self.inquiry.id, "service": self.service.id, "starts_at": self.starts.isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        booking = Booking.objects.get()
        self.assertEqual(booking.inquiry_id, self.inquiry.id)
        self.assertEqual(booking.client_id, self.client_user.id)
        self.assertEqual(booking.accountant_id, self.accountant_user.id)
        self.assertEqual(booking.status, BookingStatus.PENDING)
        self.assertEqual(booking.ends_at, booking.starts_at + timedelta(minutes=30))

    def test_create_booking_rejects_client_accountant_override_payload(self):
        """Extra client/accountant fields are ignored; parties come from inquiry."""
        self._auth(self.client_user)
        response = self.client.post(
            self.create_url,
            {
                "inquiry": self.inquiry.id,
                "service": self.service.id,
                "starts_at": self.starts.isoformat(),
                "client": self.outsider.id,
                "accountant": self.outsider.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        booking = Booking.objects.get()
        self.assertEqual(booking.client_id, self.client_user.id)
        self.assertEqual(booking.accountant_id, self.accountant_user.id)

    def test_outsider_cannot_create_booking_on_inquiry(self):
        self._auth(self.outsider)
        response = self.client.post(
            self.create_url,
            {"inquiry": self.inquiry.id, "service": self.service.id, "starts_at": self.starts.isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Booking.objects.count(), 0)

    def test_closed_inquiry_cannot_receive_booking(self):
        self.inquiry.status = Inquiry.StatusChoices.CLOSED
        self.inquiry.save(update_fields=["status"])
        self._auth(self.client_user)
        response = self.client.post(
            self.create_url,
            {"inquiry": self.inquiry.id, "service": self.service.id, "starts_at": self.starts.isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Booking.objects.count(), 0)

    def test_second_active_booking_rejected(self):
        self._auth(self.client_user)
        first = self.client.post(
            self.create_url,
            {"inquiry": self.inquiry.id, "service": self.service.id, "starts_at": self.starts.isoformat()},
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        second = self.client.post(
            self.create_url,
            {
                "inquiry": self.inquiry.id,
                "service": self.service.id,
                "starts_at": (self.starts + timedelta(hours=2)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Booking.objects.count(), 1)

    def test_new_booking_allowed_after_decline(self):
        self._auth(self.client_user)
        create = self.client.post(
            self.create_url,
            {"inquiry": self.inquiry.id, "service": self.service.id, "starts_at": self.starts.isoformat()},
            format="json",
        )
        booking_id = create.data["id"]
        self._auth(self.accountant_user)
        decline = self.client.post(reverse("bookings-decline", args=[booking_id]))
        self.assertEqual(decline.status_code, status.HTTP_200_OK)
        self._auth(self.client_user)
        again = self.client.post(
            self.create_url,
            {
                "inquiry": self.inquiry.id,
                "service": self.service.id,
                "starts_at": (self.starts + timedelta(days=1)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(again.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Booking.objects.count(), 2)

    def test_accept_and_overlap_prevention(self):
        other_client = User.objects.create_user(
            email="client-overlap@test.com",
            password="password123",
            is_accountant=False,
            is_verified=True,
        )
        other_inquiry = Inquiry.objects.create(
            client=other_client,
            accountant=self.accountant_user,
            status=Inquiry.StatusChoices.OPEN,
        )
        Message.objects.create(
            inquiry=other_inquiry, sender=other_client, content="General"
        )
        self._auth(self.client_user)
        b1 = self.client.post(
            self.create_url,
            {
                "inquiry": self.inquiry.id,
                "service": self.service.id,
                "starts_at": self.starts.isoformat(),
            },
            format="json",
        )
        self._auth(other_client)
        b2 = self.client.post(
            self.create_url,
            {
                "inquiry": other_inquiry.id,
                "service": self.service.id,
                "starts_at": (self.starts + timedelta(minutes=15)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(b1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(b2.status_code, status.HTTP_201_CREATED)

        self._auth(self.accountant_user)
        accept1 = self.client.post(reverse("bookings-accept", args=[b1.data["id"]]))
        self.assertEqual(accept1.status_code, status.HTTP_200_OK)
        accept2 = self.client.post(reverse("bookings-accept", args=[b2.data["id"]]))
        self.assertEqual(accept2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_client_cannot_accept(self):
        self._auth(self.client_user)
        created = self.client.post(
            self.create_url,
            {"inquiry": self.inquiry.id, "service": self.service.id, "starts_at": self.starts.isoformat()},
            format="json",
        )
        deny = self.client.post(reverse("bookings-accept", args=[created.data["id"]]))
        self.assertEqual(deny.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_booking_requires_auth(self):
        response = self.client.post(
            self.create_url,
            {"inquiry": self.inquiry.id, "service": self.service.id, "starts_at": self.starts.isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_request_consultation_creates_inquiry_message_and_booking(self):
        self._auth(self.client_user)
        response = self.client.post(
            self.consult_url,
            {
                "service": self.service.id,
                "starts_at": self.starts.isoformat(),
                "content": "I'd like to discuss estimated taxes.",
            },
            format="json",
        )
        # Existing open inquiry for this service already exists from setUp —
        # reuse path should attach booking to that inquiry.
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["inquiry_id"], self.inquiry.id)
        self.assertEqual(Booking.objects.filter(inquiry=self.inquiry).count(), 1)
        self.assertTrue(
            Message.objects.filter(
                inquiry=self.inquiry, content="I'd like to discuss estimated taxes."
            ).exists()
        )

    def test_request_consultation_new_inquiry_with_service(self):
        Inquiry.objects.all().delete()
        Message.objects.all().delete()
        self._auth(self.client_user)
        response = self.client.post(
            self.consult_url,
            {
                "service": self.service.id,
                "starts_at": self.starts.isoformat(),
                "content": "Consult please",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        inquiry = Inquiry.objects.get()
        booking = Booking.objects.get()
        self.assertEqual(inquiry.accountant_id, self.accountant_user.id)
        self.assertEqual(booking.service_id, self.service.id)
        self.assertEqual(Message.objects.count(), 1)

    def test_request_consultation_on_inquiry_requires_service(self):
        self._auth(self.client_user)
        response = self.client.post(
            self.consult_url,
            {
                "inquiry": self.inquiry.id,
                "starts_at": self.starts.isoformat(),
                "content": "Missing service",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Booking.objects.count(), 0)

    def test_request_consultation_rejects_other_accountants_service(self):
        other_accountant = User.objects.create_user(
            email="other.acct@test.com",
            password="password123",
            is_accountant=True,
            is_verified=True,
        )
        AccountantProfile.objects.create(
            user=other_accountant,
            bio="Bio",
            credentials="EA",
            years_experience=3,
        )
        foreign_service = Service.objects.create(
            name="Foreign service",
            description="Not this accountant",
            accountant=other_accountant,
            consultation_fee=25,
        )
        self._auth(self.client_user)
        response = self.client.post(
            self.consult_url,
            {
                "inquiry": self.inquiry.id,
                "service": foreign_service.id,
                "starts_at": self.starts.isoformat(),
                "content": "Wrong service owner",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Booking.objects.count(), 0)

    def test_request_consultation_snapshots_free_and_paid_fees(self):
        free_service = Service.objects.create(
            name="Free chat consult",
            description="Free",
            accountant=self.accountant_user,
            consultation_fee=0,
            cancellation_policy="Flexible.",
        )
        paid_service = Service.objects.create(
            name="Paid chat consult",
            description="Paid",
            accountant=self.accountant_user,
            consultation_fee=50,
            cancellation_policy="24h notice.",
        )
        self._auth(self.client_user)
        free = self.client.post(
            self.consult_url,
            {
                "inquiry": self.inquiry.id,
                "service": free_service.id,
                "starts_at": self.starts.isoformat(),
                "content": "Free please",
            },
            format="json",
        )
        self.assertEqual(free.status_code, status.HTTP_201_CREATED)
        self.assertEqual(free.data["booking"]["consultation_fee"], "0.00")
        self.assertEqual(free.data["booking"]["cancellation_policy"], "Flexible.")
        self.assertEqual(free.data["booking"]["service"], free_service.id)

        booking_id = free.data["booking"]["id"]
        self.client.post(reverse("bookings-cancel", args=[booking_id]))

        paid = self.client.post(
            self.consult_url,
            {
                "inquiry": self.inquiry.id,
                "service": paid_service.id,
                "starts_at": (self.starts + timedelta(hours=2)).isoformat(),
                "content": "Paid please",
            },
            format="json",
        )
        self.assertEqual(paid.status_code, status.HTTP_201_CREATED)
        self.assertEqual(paid.data["booking"]["consultation_fee"], "50.00")
        self.assertEqual(paid.data["booking"]["cancellation_policy"], "24h notice.")
        self.assertEqual(paid.data["booking"]["service"], paid_service.id)

    def test_request_consultation_rejects_inactive_service(self):
        self.service.is_active = False
        self.service.save(update_fields=["is_active"])
        self._auth(self.client_user)
        response = self.client.post(
            self.consult_url,
            {
                "inquiry": self.inquiry.id,
                "service": self.service.id,
                "starts_at": self.starts.isoformat(),
                "content": "Inactive service",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Booking.objects.count(), 0)

    def test_decline_then_new_request_reuses_inquiry(self):
        self._auth(self.client_user)
        first = self.client.post(
            self.consult_url,
            {
                "inquiry": self.inquiry.id,
                "service": self.service.id,
                "starts_at": self.starts.isoformat(),
                "content": "First request",
            },
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self._auth(self.accountant_user)
        self.client.post(reverse("bookings-decline", args=[first.data["booking"]["id"]]))
        self._auth(self.client_user)
        second = self.client.post(
            self.consult_url,
            {
                "inquiry": self.inquiry.id,
                "service": self.service.id,
                "starts_at": (self.starts + timedelta(days=1)).isoformat(),
                "content": "Second request",
            },
            format="json",
        )
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.data["inquiry_id"], self.inquiry.id)
        self.assertEqual(Inquiry.objects.filter(status=Inquiry.StatusChoices.OPEN).count(), 1)
        self.assertEqual(Booking.objects.filter(inquiry=self.inquiry).count(), 2)

    def test_request_consultation_blank_content_rejected(self):
        self._auth(self.client_user)
        response = self.client.post(
            self.consult_url,
            {
                "service": self.service.id,
                "starts_at": self.starts.isoformat(),
                "content": "   ",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_request_consultation_rolls_back_on_booking_failure(self):
        Inquiry.objects.all().delete()
        Message.objects.all().delete()
        self._auth(self.client_user)
        with patch(
            "bookings.views.Booking.objects.create",
            side_effect=RuntimeError("fail"),
        ):
            with self.assertRaises(RuntimeError):
                self.client.post(
                    self.consult_url,
                    {
                        "service": self.service.id,
                        "starts_at": self.starts.isoformat(),
                        "content": "Hello",
                    },
                    format="json",
                )
        self.assertEqual(Inquiry.objects.count(), 0)
        self.assertEqual(Message.objects.count(), 0)
        self.assertEqual(Booking.objects.count(), 0)

    def test_request_consultation_inquiry_create_race_reuses_open_inquiry(self):
        """Open-inquiry uniqueness races reuse the winner instead of a booking error."""
        Inquiry.objects.all().delete()
        Message.objects.all().delete()
        winner = Inquiry.objects.create(
            client=self.client_user,
            accountant=self.accountant_user,
            status=Inquiry.StatusChoices.OPEN,
        )
        self._auth(self.client_user)
        miss = MagicMock()
        miss.first.return_value = None
        hit = MagicMock()
        hit.first.return_value = winner

        with (
            patch("bookings.views._open_inquiry_queryset", side_effect=[miss, hit]),
            patch(
                "bookings.views.Inquiry.objects.create",
                side_effect=IntegrityError("unique_open_inquiry_per_client_accountant"),
            ),
        ):
            response = self.client.post(
                self.consult_url,
                {
                    "service": self.service.id,
                    "starts_at": self.starts.isoformat(),
                    "content": "General consult please",
                },
                format="json",
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["inquiry_id"], winner.id)
        self.assertEqual(Inquiry.objects.count(), 1)
        self.assertEqual(Booking.objects.count(), 1)
        self.assertEqual(Message.objects.count(), 1)

    def test_request_consultation_inquiry_create_race_respects_active_booking(self):
        Inquiry.objects.all().delete()
        Message.objects.all().delete()
        Booking.objects.all().delete()
        winner = Inquiry.objects.create(
            client=self.client_user,
            accountant=self.accountant_user,
            status=Inquiry.StatusChoices.OPEN,
        )
        later = self.starts + timedelta(hours=3)
        Booking.objects.create(
            inquiry=winner,
            client=self.client_user,
            accountant=self.accountant_user,
            starts_at=later,
            ends_at=later + timedelta(minutes=30),
            status=BookingStatus.PENDING,
        )
        self._auth(self.client_user)
        miss = MagicMock()
        miss.first.return_value = None
        hit = MagicMock()
        hit.first.return_value = winner

        with (
            patch("bookings.views._open_inquiry_queryset", side_effect=[miss, hit]),
            patch(
                "bookings.views.Inquiry.objects.create",
                side_effect=IntegrityError("unique_open_inquiry_per_client_accountant"),
            ),
        ):
            response = self.client.post(
                self.consult_url,
                {
                    "service": self.service.id,
                    "starts_at": self.starts.isoformat(),
                    "content": "General consult please",
                },
                format="json",
            )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("active booking", response.data["detail"].lower())
        self.assertEqual(Inquiry.objects.count(), 1)
        self.assertEqual(Booking.objects.count(), 1)
        self.assertEqual(Message.objects.count(), 0)

    def test_request_consultation_booking_integrity_error_rolls_back_message(self):
        self._auth(self.client_user)
        with patch(
            "bookings.views.Booking.objects.create",
            side_effect=IntegrityError("unique_active_booking_per_inquiry"),
        ):
            response = self.client.post(
                self.consult_url,
                {
                    "inquiry": self.inquiry.id,
                    "service": self.service.id,
                    "starts_at": self.starts.isoformat(),
                    "content": "Please book me",
                },
                format="json",
            )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["detail"],
            "This inquiry already has an active booking.",
        )
        self.assertEqual(Booking.objects.count(), 0)
        self.assertFalse(Message.objects.filter(content="Please book me").exists())

    def test_database_rejects_second_active_booking_on_same_inquiry(self):
        self._auth(self.client_user)
        first = self.client.post(
            self.create_url,
            {"inquiry": self.inquiry.id, "service": self.service.id, "starts_at": self.starts.isoformat()},
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        later = self.starts + timedelta(hours=4)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Booking.objects.create(
                    inquiry=self.inquiry,
                    client=self.client_user,
                    accountant=self.accountant_user,
                    starts_at=later,
                    ends_at=later + timedelta(minutes=30),
                    status=BookingStatus.PENDING,
                )
        self.assertEqual(
            Booking.objects.filter(
                inquiry=self.inquiry, status__in=ACTIVE_BOOKING_STATUSES
            ).count(),
            1,
        )

    def _create_pending_booking(self):
        self._auth(self.client_user)
        response = self.client.post(
            self.create_url,
            {"inquiry": self.inquiry.id, "service": self.service.id, "starts_at": self.starts.isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data["id"]

    def test_client_can_cancel_pending_booking(self):
        booking_id = self._create_pending_booking()
        self._auth(self.client_user)
        response = self.client.post(reverse("bookings-cancel", args=[booking_id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], BookingStatus.CANCELLED)
        self.assertEqual(Booking.objects.get(pk=booking_id).status, BookingStatus.CANCELLED)

    def test_accountant_can_cancel_confirmed_booking(self):
        booking_id = self._create_pending_booking()
        self._auth(self.accountant_user)
        accept = self.client.post(reverse("bookings-accept", args=[booking_id]))
        self.assertEqual(accept.status_code, status.HTTP_200_OK)
        cancel = self.client.post(reverse("bookings-cancel", args=[booking_id]))
        self.assertEqual(cancel.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel.data["status"], BookingStatus.CANCELLED)

    def test_outsider_cannot_cancel_booking(self):
        booking_id = self._create_pending_booking()
        self._auth(self.outsider)
        response = self.client.post(reverse("bookings-cancel", args=[booking_id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(Booking.objects.get(pk=booking_id).status, BookingStatus.PENDING)

    def test_cancel_already_declined_booking_rejected(self):
        booking_id = self._create_pending_booking()
        self._auth(self.accountant_user)
        decline = self.client.post(reverse("bookings-decline", args=[booking_id]))
        self.assertEqual(decline.status_code, status.HTTP_200_OK)
        self._auth(self.client_user)
        cancel = self.client.post(reverse("bookings-cancel", args=[booking_id]))
        self.assertEqual(cancel.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Booking.objects.get(pk=booking_id).status, BookingStatus.DECLINED)
