"""Inquiry attachment authorization, validation, and booking independence."""

import io
import tempfile
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accountants.models import AccountantProfile
from bookings.models import Booking, BookingStatus
from chats.file_validation import MAX_ATTACHMENT_BYTES
from chats.models import Attachment, Message
from inquiries.models import Inquiry
from services.models import Service
from users.models import User

MEDIA_ROOT = tempfile.mkdtemp()


def _pdf(name="doc.pdf", content=b"%PDF-1.4 fake"):
    return SimpleUploadedFile(name, content, content_type="application/pdf")


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class InquiryAttachmentTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.accountant = User.objects.create_user(
            email="acct-attach@test.com",
            password="password123",
            is_verified=True,
        )
        AccountantProfile.objects.create(
            user=cls.accountant,
            credentials="CPA",
            bio="Tax help",
        )
        cls.client_user = User.objects.create_user(
            email="client-attach@test.com",
            password="password123",
            is_verified=True,
        )
        cls.outsider = User.objects.create_user(
            email="outsider-attach@test.com",
            password="password123",
            is_verified=True,
        )
        cls.other_client = User.objects.create_user(
            email="other-client-attach@test.com",
            password="password123",
            is_verified=True,
        )
        cls.service = Service.objects.create(
            accountant=cls.accountant,
            name="Tax Filing",
            description="File taxes",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
        )
        cls.inquiry = Inquiry.objects.create(
            client=cls.client_user,
            accountant=cls.accountant,
            status=Inquiry.StatusChoices.OPEN,
        )
        cls.other_inquiry = Inquiry.objects.create(
            client=cls.other_client,
            accountant=cls.accountant,
            status=Inquiry.StatusChoices.OPEN,
        )
        cls.list_url = reverse("inquiry-attachments", args=[cls.inquiry.id])
        cls.send_url = reverse("send-message", args=[cls.inquiry.id])

    def setUp(self):
        self.client = APIClient()
        self.inquiry.status = Inquiry.StatusChoices.OPEN
        self.inquiry.save(update_fields=["status"])
        Attachment.objects.filter(inquiry=self.inquiry).delete()
        Message.objects.filter(inquiry=self.inquiry).delete()

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def test_client_can_upload_via_attachments_endpoint(self):
        self._auth(self.client_user)
        resp = self.client.post(
            self.list_url,
            {"files": _pdf()},
            format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(resp.data), 1)
        attachment = Attachment.objects.get()
        self.assertEqual(attachment.inquiry_id, self.inquiry.id)
        self.assertEqual(attachment.uploaded_by_id, self.client_user.id)
        self.assertIsNone(attachment.message_id)
        self.assertEqual(attachment.original_filename, "doc.pdf")

    def test_accountant_can_upload(self):
        self._auth(self.accountant)
        resp = self.client.post(
            self.list_url,
            {"files": _pdf("acct.pdf")},
            format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Attachment.objects.get().uploaded_by_id, self.accountant.id)

    def test_outsider_cannot_upload_list_or_download(self):
        self._auth(self.client_user)
        created = self.client.post(
            self.list_url,
            {"files": _pdf()},
            format="multipart",
        )
        attachment_id = created.data[0]["id"]
        download = reverse(
            "inquiry-attachment-download",
            args=[self.inquiry.id, attachment_id],
        )

        self._auth(self.outsider)
        self.assertEqual(
            self.client.post(self.list_url, {"files": _pdf()}, format="multipart").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(self.client.get(self.list_url).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.get(download).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(Attachment.objects.count(), 1)

    def test_closed_inquiry_can_list_and_download_but_not_upload(self):
        self._auth(self.client_user)
        created = self.client.post(
            self.list_url,
            {"files": _pdf()},
            format="multipart",
        )
        attachment_id = created.data[0]["id"]
        self.inquiry.status = Inquiry.StatusChoices.CLOSED
        self.inquiry.save(update_fields=["status"])

        list_resp = self.client.get(self.list_url)
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_resp.data), 1)

        download = reverse(
            "inquiry-attachment-download",
            args=[self.inquiry.id, attachment_id],
        )
        self.assertEqual(self.client.get(download).status_code, status.HTTP_200_OK)

        upload = self.client.post(
            self.list_url,
            {"files": _pdf("more.pdf")},
            format="multipart",
        )
        self.assertEqual(upload.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Attachment.objects.count(), 1)

    def test_text_only_message_still_works(self):
        self._auth(self.client_user)
        resp = self.client.post(self.send_url, {"content": "Hello"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Message.objects.get().content, "Hello")
        self.assertEqual(Attachment.objects.count(), 0)

    def test_attachment_only_message_works(self):
        self._auth(self.client_user)
        resp = self.client.post(
            self.send_url,
            {"content": "", "files": _pdf()},
            format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        message = Message.objects.get()
        self.assertEqual(message.content, "")
        self.assertEqual(message.attachments.count(), 1)
        self.assertEqual(message.attachments.get().message_id, message.id)

    def test_text_plus_attachment_works(self):
        self._auth(self.client_user)
        resp = self.client.post(
            self.send_url,
            {"content": "See attached", "files": _pdf()},
            format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        message = Message.objects.get()
        self.assertEqual(message.content, "See attached")
        self.assertEqual(message.attachments.count(), 1)

    def test_blank_text_and_no_attachments_fails(self):
        self._auth(self.client_user)
        resp = self.client.post(self.send_url, {"content": "   "}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Message.objects.count(), 0)

    def test_multiple_files_on_one_message(self):
        self._auth(self.client_user)
        resp = self.client.post(
            self.send_url,
            {
                "content": "Docs",
                "files": [_pdf("a.pdf"), _pdf("b.pdf", b"%PDF-1.4 b")],
            },
            format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Message.objects.count(), 1)
        self.assertEqual(Attachment.objects.filter(message=Message.objects.get()).count(), 2)

    def test_participant_cannot_access_other_inquiry_files(self):
        self._auth(self.other_client)
        other_url = reverse("inquiry-attachments", args=[self.other_inquiry.id])
        created = self.client.post(other_url, {"files": _pdf()}, format="multipart")
        attachment_id = created.data[0]["id"]

        self._auth(self.client_user)
        self.assertEqual(self.client.get(other_url).status_code, status.HTTP_404_NOT_FOUND)
        download = reverse(
            "inquiry-attachment-download",
            args=[self.other_inquiry.id, attachment_id],
        )
        self.assertEqual(self.client.get(download).status_code, status.HTTP_404_NOT_FOUND)
        # Wrong inquiry id with attachment id from other inquiry
        cross = reverse(
            "inquiry-attachment-download",
            args=[self.inquiry.id, attachment_id],
        )
        self.assertEqual(self.client.get(cross).status_code, status.HTTP_404_NOT_FOUND)

    def test_invalid_file_type_rejected(self):
        self._auth(self.client_user)
        bad = SimpleUploadedFile("note.exe", b"MZ", content_type="application/octet-stream")
        resp = self.client.post(self.list_url, {"files": bad}, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Attachment.objects.count(), 0)

    def test_oversized_file_rejected(self):
        self._auth(self.client_user)
        big = SimpleUploadedFile(
            "big.pdf",
            b"x" * (MAX_ATTACHMENT_BYTES + 1),
            content_type="application/pdf",
        )
        resp = self.client.post(self.list_url, {"files": big}, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Attachment.objects.count(), 0)

    def _create_attachment(self):
        self._auth(self.client_user)
        resp = self.client.post(self.list_url, {"files": _pdf()}, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        return resp.data[0]["id"]

    def _assert_attachment_still_accessible(self, attachment_id):
        self._auth(self.client_user)
        self.assertEqual(self.client.get(self.list_url).status_code, status.HTTP_200_OK)
        download = reverse(
            "inquiry-attachment-download",
            args=[self.inquiry.id, attachment_id],
        )
        self.assertEqual(self.client.get(download).status_code, status.HTTP_200_OK)

    def _make_booking(self, **kwargs):
        starts = timezone.now() + timedelta(days=2)
        return Booking.objects.create(
            inquiry=self.inquiry,
            client=self.client_user,
            accountant=self.accountant,
            starts_at=starts,
            ends_at=starts + timedelta(minutes=30),
            status=kwargs.get("status", BookingStatus.PENDING),
        )

    def test_attachments_survive_booking_confirm_decline_cancel_and_new_request(self):
        attachment_id = self._create_attachment()

        booking = self._make_booking(status=BookingStatus.PENDING)
        booking.status = BookingStatus.CONFIRMED
        booking.save(update_fields=["status", "updated_at"])
        self._assert_attachment_still_accessible(attachment_id)

        booking.status = BookingStatus.CANCELLED
        booking.save(update_fields=["status", "updated_at"])
        self._assert_attachment_still_accessible(attachment_id)

        declined = self._make_booking(status=BookingStatus.DECLINED)
        self.assertEqual(declined.status, BookingStatus.DECLINED)
        self._assert_attachment_still_accessible(attachment_id)

        later = self._make_booking(status=BookingStatus.PENDING)
        self.assertEqual(later.status, BookingStatus.PENDING)
        self._assert_attachment_still_accessible(attachment_id)
        self.assertEqual(Attachment.objects.filter(inquiry=self.inquiry).count(), 1)
