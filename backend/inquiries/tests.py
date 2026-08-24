from django.test import TestCase
from unittest.mock import patch

from users.models import User
from services.models import Service
from inquiries.models import Inquiry
from chats.models import Message
from rest_framework.test import APIClient
from django.urls import reverse
from rest_framework import status


class InquirySerializerTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.accountant = User.objects.create_user(
            email="acct@test.com",
            password="password123",
            is_accountant=True,
        )
        cls.other_accountant = User.objects.create_user(
            email="acct2@test.com",
            password="password123",
            is_accountant=True,
        )

        cls.client_user = User.objects.create_user(
            email="client@test.com",
            password="password123",
            is_accountant=False,
        )

        cls.service = Service.objects.create(
            accountant=cls.accountant,
            name="Tax Filing",
            description="File taxes",
            indicative_price=100,
        )
        cls.other_service = Service.objects.create(
            accountant=cls.accountant,
            name="Bookkeeping",
            description="Books",
            indicative_price=50,
        )

        cls.create_inquiry_url = reverse("list-create-inquiries")

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.client_user)

    def test_create_inquiry_with_service_specified(self):
        response = self.client.post(
            self.create_inquiry_url,
            {
                "service": self.service.id,
                "content": "Hello",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Inquiry.objects.count(), 1)
        self.assertEqual(Message.objects.count(), 1)
        inquiry = Inquiry.objects.get()
        self.assertEqual(inquiry.accountant_id, self.accountant.id)
        self.assertEqual(Message.objects.get().content, "Hello")

    def test_create_existing_inquiry(self):
        existing_inquiry = self.client.post(
            self.create_inquiry_url,
            {
                "service": self.service.id,
                "content": "Hello",
            },
            format="json",
        )

        response = self.client.post(
            self.create_inquiry_url,
            {
                "service": self.service.id,
                "content": "Following up",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["inquiry_id"], existing_inquiry.data["inquiry_id"])
        self.assertEqual(Inquiry.objects.count(), 1)
        self.assertEqual(Message.objects.count(), 2)
        self.assertEqual(
            Message.objects.order_by("created_at").last().content,
            "Following up",
        )

    def test_create_inquiry_with_accountant(self):
        response = self.client.post(
            self.create_inquiry_url,
            {
                "accountant": self.accountant.id,
                "content": "Hello",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Inquiry.objects.count(), 1)
        self.assertEqual(Message.objects.count(), 1)
        self.assertEqual(Inquiry.objects.get().accountant_id, self.accountant.id)

    def test_create_self_inquiry(self):
        response = self.client.post(
            self.create_inquiry_url,
            {
                "accountant": self.client_user.id,
                "content": "Hello",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Inquiry.objects.count(), 0)

    def test_create_new_inquiry_after_closing_existing(self):
        existing_inquiry = self.client.post(
            self.create_inquiry_url,
            {
                "service": self.service.id,
                "content": "Hello",
            },
            format="json",
        )

        inquiry_id = existing_inquiry.data["inquiry_id"]
        Inquiry.objects.filter(id=inquiry_id).update(status=Inquiry.StatusChoices.CLOSED)

        new_inquiry = self.client.post(
            self.create_inquiry_url,
            {
                "service": self.service.id,
                "content": "Starting again",
            },
            format="json",
        )

        self.assertEqual(new_inquiry.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Inquiry.objects.count(), 2)
        self.assertEqual(Message.objects.count(), 2)
        self.assertNotEqual(new_inquiry.data["inquiry_id"], inquiry_id)

    def test_different_services_reuse_same_open_inquiry(self):
        first = self.client.post(
            self.create_inquiry_url,
            {"service": self.service.id, "content": "About tax filing"},
            format="json",
        )
        second = self.client.post(
            self.create_inquiry_url,
            {"service": self.other_service.id, "content": "About bookkeeping"},
            format="json",
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data["inquiry_id"], second.data["inquiry_id"])
        self.assertEqual(
            Inquiry.objects.filter(status=Inquiry.StatusChoices.OPEN).count(), 1
        )
        self.assertEqual(Message.objects.count(), 2)

    def test_general_then_service_message_reuses_inquiry(self):
        general = self.client.post(
            self.create_inquiry_url,
            {"accountant": self.accountant.id, "content": "General hello"},
            format="json",
        )
        service_msg = self.client.post(
            self.create_inquiry_url,
            {"service": self.service.id, "content": "About tax filing"},
            format="json",
        )
        self.assertEqual(general.status_code, status.HTTP_201_CREATED)
        self.assertEqual(service_msg.status_code, status.HTTP_200_OK)
        self.assertEqual(general.data["inquiry_id"], service_msg.data["inquiry_id"])
        self.assertEqual(Inquiry.objects.count(), 1)

    def test_different_accountants_get_separate_inquiries(self):
        first = self.client.post(
            self.create_inquiry_url,
            {"accountant": self.accountant.id, "content": "Hi Maya"},
            format="json",
        )
        second = self.client.post(
            self.create_inquiry_url,
            {"accountant": self.other_accountant.id, "content": "Hi Jordan"},
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertNotEqual(first.data["inquiry_id"], second.data["inquiry_id"])
        self.assertEqual(Inquiry.objects.count(), 2)

    def test_blank_first_message_rejected(self):
        response = self.client.post(
            self.create_inquiry_url,
            {"service": self.service.id, "content": ""},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Inquiry.objects.count(), 0)
        self.assertEqual(Message.objects.count(), 0)

    def test_whitespace_first_message_rejected(self):
        response = self.client.post(
            self.create_inquiry_url,
            {"service": self.service.id, "content": "   \n\t  "},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Inquiry.objects.count(), 0)
        self.assertEqual(Message.objects.count(), 0)

    def test_message_create_failure_rolls_back_inquiry(self):
        with patch(
            "inquiries.views.Message.objects.create",
            side_effect=RuntimeError("message write failed"),
        ):
            with self.assertRaises(RuntimeError):
                self.client.post(
                    self.create_inquiry_url,
                    {"service": self.service.id, "content": "Hello"},
                    format="json",
                )

        self.assertEqual(Inquiry.objects.count(), 0)
        self.assertEqual(Message.objects.count(), 0)


class SendMessageTest(TestCase):
    """HTTP POST .../messages/ rules."""

    @classmethod
    def setUpTestData(cls):
        cls.accountant = User.objects.create_user(
            email="acct-msg@test.com",
            password="password123",
            is_accountant=True,
        )
        cls.client_user = User.objects.create_user(
            email="client-msg@test.com",
            password="password123",
            is_accountant=False,
        )
        cls.outsider = User.objects.create_user(
            email="outsider-msg@test.com",
            password="password123",
            is_accountant=False,
        )
        cls.inquiry = Inquiry.objects.create(
            client=cls.client_user,
            accountant=cls.accountant,
            status=Inquiry.StatusChoices.OPEN,
        )
        cls.send_url = reverse("send-message", args=[cls.inquiry.id])

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.client_user)
        Inquiry.objects.filter(pk=self.inquiry.pk).update(status=Inquiry.StatusChoices.OPEN)
        Message.objects.filter(inquiry=self.inquiry).delete()
        self.inquiry.refresh_from_db()

    def test_blank_message_is_rejected(self):
        response = self.client.post(
            self.send_url,
            {"content": "   "},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Message.objects.count(), 0)

    def test_message_to_closed_inquiry_is_forbidden(self):
        self.inquiry.status = Inquiry.StatusChoices.CLOSED
        self.inquiry.save(update_fields=["status"])

        response = self.client.post(
            self.send_url,
            {"content": "Are you still available?"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Message.objects.count(), 0)

    def test_non_participant_cannot_send_message(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.post(
            self.send_url,
            {"content": "Hello from outsider"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(Message.objects.count(), 0)

    def test_participant_can_send_message_to_open_inquiry(self):
        response = self.client.post(
            self.send_url,
            {"content": "Hello"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Message.objects.count(), 1)
        self.assertEqual(Message.objects.get().content, "Hello")
