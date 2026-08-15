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
            service=cls.service,
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
            {"inquiry": self.inquiry.id, "starts_at": self.starts.isoformat()},
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
            {"inquiry": self.inquiry.id, "starts_at": self.starts.isoformat()},
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
            {"inquiry": self.inquiry.id, "starts_at": self.starts.isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Booking.objects.count(), 0)

    def test_second_active_booking_rejected(self):
        self._auth(self.client_user)
        first = self.client.post(
            self.create_url,
            {"inquiry": self.inquiry.id, "starts_at": self.starts.isoformat()},
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        second = self.client.post(
            self.create_url,
            {
                "inquiry": self.inquiry.id,
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
            {"inquiry": self.inquiry.id, "starts_at": self.starts.isoformat()},
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
                "starts_at": (self.starts + timedelta(days=1)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(again.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Booking.objects.count(), 2)

    def test_accept_and_overlap_prevention(self):
        other_inquiry = Inquiry.objects.create(
            client=self.client_user,
            accountant=self.accountant_user,
            service=None,
            status=Inquiry.StatusChoices.OPEN,
        )
        Message.objects.create(
            inquiry=other_inquiry, sender=self.client_user, content="General"
        )
        self._auth(self.client_user)
        b1 = self.client.post(
            self.create_url,
            {"inquiry": self.inquiry.id, "starts_at": self.starts.isoformat()},
            format="json",
        )
        b2 = self.client.post(
            self.create_url,
            {
                "inquiry": other_inquiry.id,
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
            {"inquiry": self.inquiry.id, "starts_at": self.starts.isoformat()},
            format="json",
        )
        deny = self.client.post(reverse("bookings-accept", args=[created.data["id"]]))
        self.assertEqual(deny.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_booking_requires_auth(self):
        response = self.client.post(
            self.create_url,
            {"inquiry": self.inquiry.id, "starts_at": self.starts.isoformat()},
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

    def test_request_consultation_new_general_inquiry(self):
        Inquiry.objects.all().delete()
        Message.objects.all().delete()
        self._auth(self.client_user)
        response = self.client.post(
            self.consult_url,
            {
                "accountant": self.accountant_user.id,
                "starts_at": self.starts.isoformat(),
                "content": "General consult please",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        inquiry = Inquiry.objects.get()
        self.assertIsNone(inquiry.service)
        self.assertEqual(Booking.objects.count(), 1)
        self.assertEqual(Message.objects.count(), 1)

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
                        "accountant": self.accountant_user.id,
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
            service=None,
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
                side_effect=IntegrityError("unique_open_general_inquiry"),
            ),
        ):
            response = self.client.post(
                self.consult_url,
                {
                    "accountant": self.accountant_user.id,
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
            service=None,
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
                side_effect=IntegrityError("unique_open_general_inquiry"),
            ),
        ):
            response = self.client.post(
                self.consult_url,
                {
                    "accountant": self.accountant_user.id,
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
            {"inquiry": self.inquiry.id, "starts_at": self.starts.isoformat()},
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
