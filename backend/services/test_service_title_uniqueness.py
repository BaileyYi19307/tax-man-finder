from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accountants.models import AccountantProfile
from services.models import Service, ServiceCategory
from services.title_uniqueness import DUPLICATE_SERVICE_TITLE_MESSAGE
from users.models import User


class ServiceTitleUniquenessApiTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.list_url = reverse("service-list")
        cls.category = ServiceCategory.objects.get(slug="individual-tax-returns")
        cls.other_category = ServiceCategory.objects.get(slug="bookkeeping")

        cls.accountant = User.objects.create_user(
            email="title-owner@test.com",
            password="password123",
            is_verified=True,
        )
        AccountantProfile.objects.create(user=cls.accountant)

        cls.other_accountant = User.objects.create_user(
            email="title-other@test.com",
            password="password123",
            is_verified=True,
        )
        AccountantProfile.objects.create(user=cls.other_accountant)

        cls.existing = Service.objects.create(
            accountant=cls.accountant,
            name="Freelancer Tax Filing",
            description="Original offering",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category=cls.category,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.accountant)

    def _create_payload(self, **overrides):
        data = {
            "name": "New offering",
            "description": "Details",
            "pricing_type": "consultation_required",
            "consultation_is_paid": False,
            "category_id": self.category.id,
        }
        data.update(overrides)
        return data

    def test_exact_duplicate_rejected(self):
        resp = self.client.post(
            self.list_url,
            self._create_payload(name="Freelancer Tax Filing"),
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data["name"][0], DUPLICATE_SERVICE_TITLE_MESSAGE)
        self.assertEqual(
            Service.objects.filter(accountant=self.accountant).count(), 1
        )

    def test_case_insensitive_duplicate_rejected(self):
        resp = self.client.post(
            self.list_url,
            self._create_payload(name="freelancer tax filing"),
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data["name"][0], DUPLICATE_SERVICE_TITLE_MESSAGE)

    def test_surrounding_whitespace_duplicate_rejected(self):
        resp = self.client.post(
            self.list_url,
            self._create_payload(name="  Freelancer Tax Filing  "),
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data["name"][0], DUPLICATE_SERVICE_TITLE_MESSAGE)

    def test_same_title_allowed_for_different_accountants(self):
        self.client.force_authenticate(user=self.other_accountant)
        resp = self.client.post(
            self.list_url,
            self._create_payload(name="Freelancer Tax Filing"),
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["name"], "Freelancer Tax Filing")
        self.assertEqual(
            Service.objects.filter(accountant=self.other_accountant).count(), 1
        )

    def test_same_category_with_different_titles_allowed(self):
        resp = self.client.post(
            self.list_url,
            self._create_payload(
                name="Small Business Returns",
                category_id=self.category.id,
            ),
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            Service.objects.filter(
                accountant=self.accountant, category=self.category
            ).count(),
            2,
        )

    def test_update_same_service_unchanged_title_succeeds(self):
        url = reverse("service-detail", args=[self.existing.id])
        resp = self.client.patch(
            url,
            {
                "name": "Freelancer Tax Filing",
                "description": "Updated description only",
                "category_id": self.category.id,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.existing.refresh_from_db()
        self.assertEqual(self.existing.name, "Freelancer Tax Filing")
        self.assertEqual(self.existing.description, "Updated description only")

    def test_update_to_conflicting_title_rejected(self):
        other = Service.objects.create(
            accountant=self.accountant,
            name="Payroll Support",
            description="Second offering",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category=self.other_category,
        )
        url = reverse("service-detail", args=[other.id])
        resp = self.client.patch(
            url,
            {"name": "freelancer tax filing", "category_id": self.other_category.id},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data["name"][0], DUPLICATE_SERVICE_TITLE_MESSAGE)
        other.refresh_from_db()
        self.assertEqual(other.name, "Payroll Support")

    def test_conflict_with_inactive_service_rejected(self):
        self.existing.is_active = False
        self.existing.save(update_fields=["is_active"])

        resp = self.client.post(
            self.list_url,
            self._create_payload(name="FREELANCER TAX FILING"),
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data["name"][0], DUPLICATE_SERVICE_TITLE_MESSAGE)
        self.assertEqual(
            Service.objects.filter(accountant=self.accountant).count(), 1
        )
