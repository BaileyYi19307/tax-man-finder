from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from unittest import mock

from accountants.models import AccountantProfile
from bookings.models import Booking, BookingStatus
from services.cancellation_policy import (
    CANCELLATION_POLICY_LABELS,
    FREE_24H,
    FREE_48H,
    NON_REFUNDABLE,
)
from services.models import Service, ServiceCategory
from users.models import User


class CancellationPolicyServiceApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.list_url = reverse("service-list")
        cls.policies_url = reverse("service-cancellation-policy-list")
        cls.accountant = User.objects.create_user(
            email="policy.acct@example.com",
            password="testpassword",
            is_accountant=True,
            is_verified=True,
            first_name="Pol",
            last_name="Acct",
        )
        AccountantProfile.objects.create(
            user=cls.accountant,
            bio="Policy accountant",
            credentials="CPA",
            location="Austin, TX",
            languages=["English"],
            offers_remote=True,
            publication_status=AccountantProfile.PublicationStatus.PUBLISHED,
        )
        cls.category_id = ServiceCategory.objects.get(slug="bookkeeping").id

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(user=self.accountant)

    def _create_payload(self, **overrides):
        body = {
            "name": "Books",
            "description": "Monthly",
            "pricing_type": Service.PricingType.CONSULTATION_REQUIRED,
            "consultation_is_paid": False,
            "category_id": self.category_id,
            "cancellation_policy_code": FREE_24H,
        }
        body.update(overrides)
        return body

    def test_list_cancellation_policies(self):
        resp = self.api.get(self.policies_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        codes = [row["code"] for row in resp.data]
        self.assertEqual(codes, [FREE_24H, FREE_48H, NON_REFUNDABLE])
        for row in resp.data:
            self.assertEqual(row["label"], CANCELLATION_POLICY_LABELS[row["code"]])

    def test_each_accepted_policy_code_creates_and_returns_canonical_wording(self):
        for code in (FREE_24H, FREE_48H, NON_REFUNDABLE):
            with self.subTest(code=code):
                resp = self.api.post(
                    self.list_url,
                    self._create_payload(
                        name=f"Service {code}",
                        cancellation_policy_code=code,
                    ),
                    format="json",
                )
                self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
                self.assertEqual(resp.data["cancellation_policy_code"], code)
                self.assertEqual(
                    resp.data["cancellation_policy"],
                    CANCELLATION_POLICY_LABELS[code],
                )
                service = Service.objects.get(pk=resp.data["id"])
                self.assertEqual(service.cancellation_policy_code, code)
                self.assertEqual(
                    service.cancellation_policy, CANCELLATION_POLICY_LABELS[code]
                )

    def test_missing_code_on_create_rejected(self):
        payload = self._create_payload()
        del payload["cancellation_policy_code"]
        resp = self.api.post(self.list_url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cancellation_policy_code", resp.data)

    def test_unknown_code_on_create_rejected(self):
        resp = self.api.post(
            self.list_url,
            self._create_payload(cancellation_policy_code="flexible_forever"),
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cancellation_policy_code", resp.data)

    def test_custom_policy_text_rejected(self):
        resp = self.api.post(
            self.list_url,
            self._create_payload(cancellation_policy="Whatever I want"),
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cancellation_policy", resp.data)

    def test_valid_service_update_without_resending_code(self):
        created = self.api.post(
            self.list_url, self._create_payload(cancellation_policy_code=FREE_48H), format="json"
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        service_id = created.data["id"]
        updated = self.api.patch(
            reverse("service-detail", args=[service_id]),
            {"description": "Updated description only"},
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["cancellation_policy_code"], FREE_48H)
        self.assertEqual(
            updated.data["cancellation_policy"], CANCELLATION_POLICY_LABELS[FREE_48H]
        )

    def test_legacy_service_edit_requires_code(self):
        service = Service.objects.create(
            accountant=self.accountant,
            name="Legacy",
            description="Old",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category_id=self.category_id,
            cancellation_policy="Some custom prose about cancellations.",
            cancellation_policy_code=None,
        )
        detail = reverse("service-detail", args=[service.id])
        rejected = self.api.patch(
            detail, {"description": "Still legacy"}, format="json"
        )
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cancellation_policy_code", rejected.data)

        fixed = self.api.patch(
            detail,
            {
                "description": "Now coded",
                "cancellation_policy_code": NON_REFUNDABLE,
            },
            format="json",
        )
        self.assertEqual(fixed.status_code, status.HTTP_200_OK)
        self.assertEqual(fixed.data["cancellation_policy_code"], NON_REFUNDABLE)
        self.assertEqual(
            fixed.data["cancellation_policy"],
            CANCELLATION_POLICY_LABELS[NON_REFUNDABLE],
        )

    def test_legacy_reactivation_requires_code(self):
        service = Service.objects.create(
            accountant=self.accountant,
            name="Inactive legacy",
            description="Old",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category_id=self.category_id,
            is_active=False,
            cancellation_policy_code=None,
        )
        detail = reverse("service-detail", args=[service.id])
        rejected = self.api.patch(detail, {"is_active": True}, format="json")
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cancellation_policy_code", rejected.data)

        ok = self.api.patch(
            detail,
            {"is_active": True, "cancellation_policy_code": FREE_24H},
            format="json",
        )
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        self.assertTrue(ok.data["is_active"])
        self.assertEqual(ok.data["cancellation_policy_code"], FREE_24H)

    def test_legacy_deactivate_without_code_allowed(self):
        service = Service.objects.create(
            accountant=self.accountant,
            name="Hide me",
            description="Old",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category_id=self.category_id,
            cancellation_policy_code=None,
            cancellation_policy="Custom leftover text",
        )
        resp = self.api.patch(
            reverse("service-detail", args=[service.id]),
            {"is_active": False},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data["is_active"])
        self.assertIsNone(resp.data["cancellation_policy_code"])
        self.assertEqual(resp.data["cancellation_policy"], "Custom leftover text")


class CancellationPolicyBookingSnapshotTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.client_user = User.objects.create_user(
            email="policy.client@example.com",
            password="testpassword",
            is_verified=True,
        )
        cls.accountant = User.objects.create_user(
            email="policy.book.acct@example.com",
            password="testpassword",
            is_accountant=True,
            is_verified=True,
            first_name="Book",
            last_name="Acct",
        )
        AccountantProfile.objects.create(
            user=cls.accountant,
            bio="Book acct",
            credentials="CPA",
            location="Austin, TX",
            languages=["English"],
            offers_remote=True,
            publication_status=AccountantProfile.PublicationStatus.PUBLISHED,
        )
        cls.category = ServiceCategory.objects.get(slug="tax-planning")

    def setUp(self):
        self.api = APIClient()

    def _make_inquiry(self):
        from chats.models import Message
        from inquiries.models import Inquiry

        inquiry = Inquiry.objects.create(
            client=self.client_user,
            accountant=self.accountant,
            status=Inquiry.StatusChoices.OPEN,
        )
        Message.objects.create(
            inquiry=inquiry, sender=self.client_user, content="Hello"
        )
        return inquiry

    def _request_booking(self, inquiry, service):
        self.api.force_authenticate(user=self.client_user)
        return self.api.post(
            reverse("bookings-list"),
            {
                "inquiry": inquiry.id,
                "service": service.id,
                "starts_at": "2030-06-01T15:00:00Z",
            },
            format="json",
        )

    def test_new_booking_snapshots_canonical_text_from_code(self):
        service = Service.objects.create(
            accountant=self.accountant,
            name="Paid consult",
            description="Desc",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category=self.category,
            consultation_fee="40.00",
            cancellation_policy_code=FREE_24H,
            cancellation_policy=CANCELLATION_POLICY_LABELS[FREE_24H],
        )
        inquiry = self._make_inquiry()
        resp = self._request_booking(inquiry, service)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        booking = Booking.objects.get(pk=resp.data["id"])
        self.assertEqual(
            booking.cancellation_policy, CANCELLATION_POLICY_LABELS[FREE_24H]
        )

        service.cancellation_policy_code = NON_REFUNDABLE
        service.cancellation_policy = CANCELLATION_POLICY_LABELS[NON_REFUNDABLE]
        service.save(
            update_fields=[
                "cancellation_policy_code",
                "cancellation_policy",
                "updated_at",
            ]
        )
        booking.refresh_from_db()
        self.assertEqual(
            booking.cancellation_policy, CANCELLATION_POLICY_LABELS[FREE_24H]
        )

    def test_legacy_service_without_code_snapshots_existing_text(self):
        legacy_text = "Custom office policy about weather delays."
        service = Service.objects.create(
            accountant=self.accountant,
            name="Legacy",
            description="Desc",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category=self.category,
            consultation_fee="0.00",
            cancellation_policy_code=None,
            cancellation_policy=legacy_text,
        )
        inquiry = self._make_inquiry()
        resp = self._request_booking(inquiry, service)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        booking = Booking.objects.get(pk=resp.data["id"])
        self.assertEqual(booking.cancellation_policy, legacy_text)

    def test_cancel_does_not_call_stripe_refund(self):
        service = Service.objects.create(
            accountant=self.accountant,
            name="Cancel me",
            description="Desc",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category=self.category,
            consultation_fee="25.00",
            cancellation_policy_code=FREE_24H,
            cancellation_policy=CANCELLATION_POLICY_LABELS[FREE_24H],
        )
        inquiry = self._make_inquiry()
        created = self._request_booking(inquiry, service)
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        booking_id = created.data["id"]
        refund_mock = mock.Mock()
        with mock.patch.dict(
            "sys.modules",
            {"stripe": mock.Mock(Refund=mock.Mock(create=refund_mock))},
        ):
            cancel = self.api.post(reverse("bookings-cancel", args=[booking_id]))
        self.assertEqual(cancel.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel.data["status"], BookingStatus.CANCELLED)
        refund_mock.assert_not_called()


class CancellationPolicyMigrationMatchTests(TestCase):
    def test_deterministic_legacy_mapping_only(self):
        from services.cancellation_policy import match_legacy_cancellation_policy_text

        self.assertEqual(
            match_legacy_cancellation_policy_text(
                CANCELLATION_POLICY_LABELS[FREE_24H]
            ),
            FREE_24H,
        )
        self.assertEqual(
            match_legacy_cancellation_policy_text(
                "Consultation fee is refundable if cancelled 48 hours or more before the meeting."
            ),
            FREE_48H,
        )
        self.assertIsNone(
            match_legacy_cancellation_policy_text(
                "Free consultations can be cancelled any time before the meeting."
            )
        )
        self.assertIsNone(match_legacy_cancellation_policy_text(""))
        self.assertIsNone(match_legacy_cancellation_policy_text("Totally custom prose"))
