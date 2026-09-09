from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accountants.models import AccountantProfile
from bookings.models import Booking
from inquiries.models import Inquiry
from users.models import User

from .category_assignment import UNCATEGORIZED_SLUG
from .models import Service, ServiceCategory


class ServiceCategoryListApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse("service-category-list")

    def test_lists_active_categories_in_sort_order(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        slugs = [row["slug"] for row in resp.data]
        self.assertEqual(
            slugs,
            [
                "individual-tax-returns",
                "small-business-tax-returns",
                "tax-planning",
                "bookkeeping",
                "payroll",
                "sales-tax",
                "business-formation",
                "irs-notices-and-tax-resolution",
            ],
        )
        for row in resp.data:
            self.assertEqual(set(row.keys()), {"id", "name", "slug"})

    def test_excludes_uncategorized_and_inactive(self):
        inactive = ServiceCategory.objects.get(slug="payroll")
        inactive.is_active = False
        inactive.save(update_fields=["is_active"])

        resp = self.client.get(self.url)
        slugs = {row["slug"] for row in resp.data}
        self.assertNotIn(UNCATEGORIZED_SLUG, slugs)
        self.assertNotIn("payroll", slugs)
        self.assertIn("bookkeeping", slugs)

    def test_anonymous_and_authenticated_can_read(self):
        anon = self.client.get(self.url)
        self.assertEqual(anon.status_code, status.HTTP_200_OK)

        user = User.objects.create_user(
            email="cat-reader@example.com",
            password="testpassword",
            is_verified=True,
        )
        self.client.force_authenticate(user=user)
        auth = self.client.get(self.url)
        self.assertEqual(auth.status_code, status.HTTP_200_OK)
        self.assertEqual(anon.data, auth.data)

    def test_no_category_mutation_endpoints(self):
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 405)
        self.assertEqual(self.client.put(self.url, {}, format="json").status_code, 405)
        self.assertEqual(self.client.patch(self.url, {}, format="json").status_code, 405)
        self.assertEqual(self.client.delete(self.url).status_code, 405)

        detail = f"{self.url}{ServiceCategory.objects.get(slug='bookkeeping').id}/"
        self.assertEqual(self.client.get(detail).status_code, 404)
        self.assertEqual(self.client.post(detail, {}, format="json").status_code, 404)


class ServiceCategoryWriteApiTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.list_url = reverse("service-list")
        cls.accountant = User.objects.create_user(
            email="cat-write@example.com",
            password="testpassword",
            is_verified=True,
        )
        AccountantProfile.objects.create(user=cls.accountant)
        cls.bookkeeping = ServiceCategory.objects.get(slug="bookkeeping")
        cls.tax_planning = ServiceCategory.objects.get(slug="tax-planning")
        cls.uncategorized = ServiceCategory.objects.get(slug="uncategorized")

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.accountant)

    def test_create_with_valid_category_returns_nested_object(self):
        resp = self.client.post(
            self.list_url,
            {
                "name": "Freelance books",
                "description": "Monthly bookkeeping",
                "pricing_type": Service.PricingType.CONSULTATION_REQUIRED,
                "category_id": self.bookkeeping.id,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            resp.data["category"],
            {
                "id": self.bookkeeping.id,
                "name": self.bookkeeping.name,
                "slug": "bookkeeping",
            },
        )
        self.assertNotIn("category_id", resp.data)
        self.assertIsInstance(resp.data["category"], dict)
        service = Service.objects.get(pk=resp.data["id"])
        self.assertEqual(service.category_id, self.bookkeeping.id)

    def test_create_missing_category_id_rejected(self):
        resp = self.client.post(
            self.list_url,
            {
                "name": "No category",
                "description": "Missing",
                "pricing_type": Service.PricingType.CONSULTATION_REQUIRED,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category_id", resp.data)
        self.assertEqual(Service.objects.filter(accountant=self.accountant).count(), 0)

    def test_create_nonexistent_category_rejected(self):
        resp = self.client.post(
            self.list_url,
            {
                "name": "Bad id",
                "description": "Missing category",
                "pricing_type": Service.PricingType.CONSULTATION_REQUIRED,
                "category_id": 999999,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category_id", resp.data)
        self.assertIn("does not exist", str(resp.data["category_id"]).lower())

    def test_create_inactive_category_rejected(self):
        inactive = ServiceCategory.objects.create(
            name="Inactive niche",
            slug="inactive-niche",
            is_active=False,
            sort_order=500,
        )
        resp = self.client.post(
            self.list_url,
            {
                "name": "Inactive cat",
                "description": "Nope",
                "pricing_type": Service.PricingType.CONSULTATION_REQUIRED,
                "category_id": inactive.id,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category_id", resp.data)
        self.assertIn("not active", str(resp.data["category_id"]).lower())

    def test_create_uncategorized_rejected(self):
        resp = self.client.post(
            self.list_url,
            {
                "name": "Legacy bucket",
                "description": "Nope",
                "pricing_type": Service.PricingType.CONSULTATION_REQUIRED,
                "category_id": self.uncategorized.id,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category_id", resp.data)
        self.assertIn("uncategorized", str(resp.data["category_id"]).lower())

    def test_patch_without_category_when_already_valid(self):
        service = Service.objects.create(
            accountant=self.accountant,
            name="Valid offering",
            description="Has category",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category=self.bookkeeping,
        )
        url = reverse("service-detail", args=[service.id])
        resp = self.client.patch(url, {"name": "Renamed offering"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["name"], "Renamed offering")
        self.assertEqual(resp.data["category"]["id"], self.bookkeeping.id)
        service.refresh_from_db()
        self.assertEqual(service.category_id, self.bookkeeping.id)

    def test_patch_null_category_requires_category_id(self):
        service = Service.objects.create(
            accountant=self.accountant,
            name="Null category",
            description="Legacy",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category=None,
        )
        url = reverse("service-detail", args=[service.id])
        missing = self.client.patch(url, {"name": "Still null"}, format="json")
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category_id", missing.data)

        fixed = self.client.patch(
            url,
            {"name": "Now categorized", "category_id": self.tax_planning.id},
            format="json",
        )
        self.assertEqual(fixed.status_code, status.HTTP_200_OK)
        self.assertEqual(fixed.data["category"]["slug"], "tax-planning")

    def test_patch_uncategorized_requires_active_category(self):
        service = Service.objects.create(
            accountant=self.accountant,
            name="Was uncategorized",
            description="Legacy",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category=self.uncategorized,
        )
        url = reverse("service-detail", args=[service.id])
        missing = self.client.patch(url, {"description": "Still bad"}, format="json")
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category_id", missing.data)

        keep_uncat = self.client.patch(
            url,
            {"category_id": self.uncategorized.id},
            format="json",
        )
        self.assertEqual(keep_uncat.status_code, status.HTTP_400_BAD_REQUEST)

        fixed = self.client.patch(
            url,
            {"category_id": self.bookkeeping.id},
            format="json",
        )
        self.assertEqual(fixed.status_code, status.HTTP_200_OK)
        self.assertEqual(fixed.data["category"]["slug"], "bookkeeping")

    def test_patch_inactive_category_requires_active_category(self):
        inactive = ServiceCategory.objects.create(
            name="Retired",
            slug="retired-category",
            is_active=False,
            sort_order=600,
        )
        service = Service.objects.create(
            accountant=self.accountant,
            name="On inactive",
            description="Legacy",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category=inactive,
        )
        url = reverse("service-detail", args=[service.id])
        missing = self.client.patch(url, {"name": "Needs category"}, format="json")
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category_id", missing.data)

        fixed = self.client.patch(
            url,
            {"category_id": self.bookkeeping.id},
            format="json",
        )
        self.assertEqual(fixed.status_code, status.HTTP_200_OK)
        self.assertEqual(fixed.data["category"]["id"], self.bookkeeping.id)


class OnboardingCategoryApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="onboard-cat@example.com",
            password="testpassword",
            is_verified=True,
        )
        self.client.force_authenticate(user=self.user)
        self.url = reverse("create_accountant")
        self.category = ServiceCategory.objects.get(slug="individual-tax-returns")

    def test_onboarding_with_valid_category_creates_service(self):
        resp = self.client.post(
            self.url,
            {
                "bio": "I prepare returns.",
                "credentials": "CPA",
                "service_name": "Individual tax returns",
                "service_description": "1040 help",
                "category_id": self.category.id,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        service = Service.objects.get(accountant=self.user)
        self.assertEqual(service.category_id, self.category.id)
        self.assertTrue(AccountantProfile.objects.filter(user=self.user).exists())

    def test_onboarding_missing_category_does_not_create_service(self):
        resp = self.client.post(
            self.url,
            {
                "bio": "I prepare returns.",
                "credentials": "CPA",
                "service_name": "Individual tax returns",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category_id", resp.data)
        # Invalid primary-service payload fails before writes.
        self.assertFalse(AccountantProfile.objects.filter(user=self.user).exists())
        self.assertEqual(Service.objects.filter(accountant=self.user).count(), 0)

    def test_onboarding_invalid_category_does_not_create_service(self):
        resp = self.client.post(
            self.url,
            {
                "bio": "I prepare returns.",
                "credentials": "CPA",
                "service_name": "Individual tax returns",
                "category_id": 999999,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category_id", resp.data)
        self.assertFalse(AccountantProfile.objects.filter(user=self.user).exists())
        self.assertEqual(Service.objects.filter(accountant=self.user).count(), 0)


class BookingServiceCategoryStabilityTest(TestCase):
    def test_category_assignment_preserves_booking_service_fk_and_snapshots(self):
        accountant = User.objects.create_user(
            email="book-cat-acct@example.com",
            password="testpassword",
            is_verified=True,
        )
        client = User.objects.create_user(
            email="book-cat-client@example.com",
            password="testpassword",
            is_verified=True,
        )
        AccountantProfile.objects.create(
            user=accountant, bio="Bio", credentials="CPA"
        )
        category = ServiceCategory.objects.get(slug="bookkeeping")
        service = Service.objects.create(
            accountant=accountant,
            name="Books consult",
            description="Consult",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            consultation_fee=Decimal("25.00"),
            cancellation_policy="24h notice",
            category=category,
        )
        service_id = service.id
        inquiry = Inquiry.objects.create(client=client, accountant=accountant)
        starts = timezone.now() + timedelta(days=3)
        booking = Booking.objects.create(
            inquiry=inquiry,
            client=client,
            accountant=accountant,
            service=service,
            starts_at=starts,
            ends_at=starts + timedelta(minutes=30),
            consultation_fee=Decimal("25.00"),
            cancellation_policy="24h notice",
        )
        booking_id = booking.id

        api = APIClient()
        api.force_authenticate(user=accountant)
        resp = api.patch(
            reverse("service-detail", args=[service_id]),
            {
                "name": "Books consult v2",
                "category_id": ServiceCategory.objects.get(slug="tax-planning").id,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        booking.refresh_from_db()
        self.assertEqual(booking.id, booking_id)
        self.assertEqual(booking.service_id, service_id)
        self.assertEqual(booking.consultation_fee, Decimal("25.00"))
        self.assertEqual(booking.cancellation_policy, "24h notice")
        self.assertTrue(Service.objects.filter(pk=service_id).exists())


class LegacyServiceDeactivateApiTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.accountant = User.objects.create_user(
            email="legacy-deact@example.com",
            password="testpassword",
            is_verified=True,
        )
        AccountantProfile.objects.create(user=cls.accountant)
        cls.bookkeeping = ServiceCategory.objects.get(slug="bookkeeping")
        cls.uncategorized = ServiceCategory.objects.get(slug="uncategorized")
        cls.inactive_category = ServiceCategory.objects.create(
            name="Retired legacy cat",
            slug="retired-legacy-cat",
            is_active=False,
            sort_order=700,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.accountant)

    def _detail(self, service_id):
        return reverse("service-detail", args=[service_id])

    def test_active_uncategorized_can_be_deactivated_without_category_id(self):
        service = Service.objects.create(
            accountant=self.accountant,
            name="Uncat active",
            description="Legacy",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category=self.uncategorized,
            is_active=True,
        )
        resp = self.client.patch(
            self._detail(service.id), {"is_active": False}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        service.refresh_from_db()
        self.assertFalse(service.is_active)
        self.assertEqual(service.category_id, self.uncategorized.id)

    def test_already_inactive_legacy_can_be_deactivated_again(self):
        service = Service.objects.create(
            accountant=self.accountant,
            name="Uncat inactive",
            description="Legacy",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category=self.uncategorized,
            is_active=False,
        )
        resp = self.client.patch(
            self._detail(service.id), {"is_active": False}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        service.refresh_from_db()
        self.assertFalse(service.is_active)

    def test_null_category_can_be_deactivated(self):
        service = Service.objects.create(
            accountant=self.accountant,
            name="Null cat",
            description="Legacy",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category=None,
            is_active=True,
        )
        resp = self.client.patch(
            self._detail(service.id), {"is_active": False}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        service.refresh_from_db()
        self.assertFalse(service.is_active)
        self.assertIsNone(service.category_id)

    def test_inactive_category_service_can_be_deactivated(self):
        service = Service.objects.create(
            accountant=self.accountant,
            name="Inactive cat svc",
            description="Legacy",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category=self.inactive_category,
            is_active=True,
        )
        resp = self.client.patch(
            self._detail(service.id), {"is_active": False}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        service.refresh_from_db()
        self.assertFalse(service.is_active)

    def test_legacy_cannot_reactivate_without_valid_category(self):
        service = Service.objects.create(
            accountant=self.accountant,
            name="Needs reclass",
            description="Legacy",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category=self.uncategorized,
            is_active=False,
        )
        resp = self.client.patch(
            self._detail(service.id), {"is_active": True}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category_id", resp.data)
        service.refresh_from_db()
        self.assertFalse(service.is_active)

    def test_legacy_cannot_edit_ordinary_fields_without_category(self):
        service = Service.objects.create(
            accountant=self.accountant,
            name="Legacy title",
            description="Legacy",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category=None,
            is_active=True,
        )
        resp = self.client.patch(
            self._detail(service.id),
            {"name": "Renamed without category", "is_active": False},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category_id", resp.data)
        service.refresh_from_db()
        self.assertEqual(service.name, "Legacy title")
        self.assertTrue(service.is_active)

    def test_legacy_can_reclassify_and_reactivate_with_valid_category(self):
        service = Service.objects.create(
            accountant=self.accountant,
            name="Reclass me",
            description="Legacy",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category=self.uncategorized,
            is_active=False,
        )
        resp = self.client.patch(
            self._detail(service.id),
            {
                "category_id": self.bookkeeping.id,
                "is_active": True,
                "name": "Reclassified books",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        service.refresh_from_db()
        self.assertTrue(service.is_active)
        self.assertEqual(service.category_id, self.bookkeeping.id)
        self.assertEqual(service.name, "Reclassified books")
        self.assertEqual(resp.data["category"]["slug"], "bookkeeping")

    def test_valid_categorized_service_update_behavior_unchanged(self):
        service = Service.objects.create(
            accountant=self.accountant,
            name="Valid books",
            description="Has category",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category=self.bookkeeping,
            is_active=True,
        )
        rename = self.client.patch(
            self._detail(service.id),
            {"name": "Valid books updated"},
            format="json",
        )
        self.assertEqual(rename.status_code, status.HTTP_200_OK)
        self.assertEqual(rename.data["category"]["id"], self.bookkeeping.id)

        deactivate = self.client.patch(
            self._detail(service.id), {"is_active": False}, format="json"
        )
        self.assertEqual(deactivate.status_code, status.HTTP_200_OK)
        service.refresh_from_db()
        self.assertFalse(service.is_active)

        reactivate = self.client.patch(
            self._detail(service.id), {"is_active": True}, format="json"
        )
        self.assertEqual(reactivate.status_code, status.HTTP_200_OK)
        service.refresh_from_db()
        self.assertTrue(service.is_active)
        self.assertEqual(service.category_id, self.bookkeeping.id)
