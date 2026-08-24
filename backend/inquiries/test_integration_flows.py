"""End-to-end API flows for Message Accountant and Request Consultation."""

from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accountants.models import AccountantProfile
from chats.models import Message
from inquiries.models import Inquiry
from bookings.models import Booking, BookingStatus
from services.models import Service
from users.models import User


class MessagingAndConsultationIntegrationTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.client_user = User.objects.create_user(
            email="client-int@test.com",
            password="password123",
            is_accountant=False,
            is_verified=True,
        )
        self.accountant = User.objects.create_user(
            email="acct-int@test.com",
            password="password123",
            is_accountant=True,
            is_verified=True,
        )
        AccountantProfile.objects.create(
            user=self.accountant,
            bio="Tax help",
            credentials="CPA",
            years_experience=8,
        )
        self.service = Service.objects.create(
            accountant=self.accountant,
            name="Individual Tax Prep",
            description="Returns",
            indicative_price=200,
        )
        self.starts = timezone.now() + timedelta(days=2)
        self.api.force_authenticate(user=self.client_user)

    def test_message_accountant_service_flow(self):
        url = reverse("list-create-inquiries")
        create = self.api.post(
            url,
            {"service": self.service.id, "content": "Need help with W2s"},
            format="json",
        )
        self.assertEqual(create.status_code, status.HTTP_201_CREATED)
        inquiry_id = create.data["inquiry_id"]
        self.assertEqual(Inquiry.objects.count(), 1)
        self.assertEqual(Message.objects.count(), 1)

        reuse = self.api.post(
            url,
            {"service": self.service.id, "content": "Also have a 1099"},
            format="json",
        )
        self.assertEqual(reuse.status_code, status.HTTP_200_OK)
        self.assertEqual(reuse.data["inquiry_id"], inquiry_id)
        self.assertEqual(Inquiry.objects.count(), 1)
        self.assertEqual(Message.objects.count(), 2)

    def test_message_accountant_general_flow(self):
        url = reverse("list-create-inquiries")
        response = self.api.post(
            url,
            {"accountant": self.accountant.id, "content": "General question"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        inquiry = Inquiry.objects.get()
        self.assertEqual(inquiry.accountant_id, self.accountant.id)

    def test_service_then_general_message_reuses_inquiry(self):
        url = reverse("list-create-inquiries")
        first = self.api.post(
            url,
            {"service": self.service.id, "content": "About this service"},
            format="json",
        )
        second = self.api.post(
            url,
            {"accountant": self.accountant.id, "content": "General follow-up"},
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data["inquiry_id"], second.data["inquiry_id"])
        self.assertEqual(Inquiry.objects.count(), 1)
        self.assertEqual(Message.objects.count(), 2)

    def test_request_consultation_flow_end_to_end(self):
        url = reverse("request-consultation")
        response = self.api.post(
            url,
            {
                "service": self.service.id,
                "starts_at": self.starts.isoformat(),
                "content": "Discuss estimated payments",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        inquiry_id = response.data["inquiry_id"]
        booking = Booking.objects.get()
        self.assertEqual(booking.inquiry_id, inquiry_id)
        self.assertEqual(booking.status, BookingStatus.PENDING)
        self.assertEqual(booking.client_id, self.client_user.id)
        self.assertEqual(booking.accountant_id, self.accountant.id)
        self.assertTrue(
            Message.objects.filter(content="Discuss estimated payments").exists()
        )

        # Accountant accepts
        self.api.force_authenticate(user=self.accountant)
        accept = self.api.post(reverse("bookings-accept", args=[booking.id]))
        self.assertEqual(accept.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, BookingStatus.CONFIRMED)

        # Visible on inquiry bookings endpoint
        self.api.force_authenticate(user=self.client_user)
        listed = self.api.get(reverse("inquiry-bookings", args=[inquiry_id]))
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(len(listed.data), 1)
        self.assertEqual(listed.data[0]["status"], BookingStatus.CONFIRMED)

    def test_inquiry_list_includes_client_and_accountant_names(self):
        self.api.post(
            reverse("list-create-inquiries"),
            {"service": self.service.id, "content": "Hello"},
            format="json",
        )
        listed = self.api.get(reverse("list-create-inquiries"))
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(listed.data[0]["accountant_name"], self.accountant.email)
        self.assertEqual(listed.data[0]["client_name"], self.client_user.email)

        self.api.force_authenticate(user=self.accountant)
        as_accountant = self.api.get(reverse("list-create-inquiries"))
        self.assertEqual(as_accountant.status_code, status.HTTP_200_OK)
        self.assertEqual(as_accountant.data[0]["client_name"], self.client_user.email)
        self.assertEqual(as_accountant.data[0]["client"], self.client_user.id)
        self.assertEqual(as_accountant.data[0]["accountant"], self.accountant.id)
