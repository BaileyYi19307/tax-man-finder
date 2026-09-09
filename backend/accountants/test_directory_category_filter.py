from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accountants.models import AccountantProfile
from services.models import Service, ServiceCategory
from users.models import User


def _published_accountant(
    *,
    email,
    category_slug,
    service_name="Offering",
    latitude=None,
    longitude=None,
    service_active=True,
    extra_category_slug=None,
):
    user = User.objects.create_user(
        email=email,
        password="password123",
        is_verified=True,
        first_name="Dir",
        last_name="Pro",
    )
    AccountantProfile.objects.create(
        user=user,
        bio="Public-ready bio",
        credentials="CPA",
        location="Austin, TX",
        years_experience=3,
        firm_name="Dir Tax",
        latitude=Decimal(str(latitude)) if latitude is not None else None,
        longitude=Decimal(str(longitude)) if longitude is not None else None,
        publication_status=AccountantProfile.PublicationStatus.PUBLISHED,
    )
    Service.objects.create(
        accountant=user,
        name=service_name,
        description=service_name,
        pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
        is_active=service_active,
        category=ServiceCategory.objects.get(slug=category_slug),
    )
    if extra_category_slug:
        Service.objects.create(
            accountant=user,
            name=f"{service_name} extra",
            description="Second offering",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            is_active=True,
            category=ServiceCategory.objects.get(slug=extra_category_slug),
        )
    return user


class DirectoryCategoryFilterApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse("accountant-directory")
        self.bookkeeping = _published_accountant(
            email="book@test.com",
            category_slug="bookkeeping",
            service_name="Books",
            latitude=39.95,
            longitude=-75.16,
        )
        self.payroll = _published_accountant(
            email="payroll@test.com",
            category_slug="payroll",
            service_name="Payroll",
            latitude=34.05,
            longitude=-118.24,
        )
        self.multi = _published_accountant(
            email="multi@test.com",
            category_slug="bookkeeping",
            service_name="Books primary",
            extra_category_slug="payroll",
            latitude=39.96,
            longitude=-75.17,
        )
        self.inactive_only = _published_accountant(
            email="inactive-svc@test.com",
            category_slug="bookkeeping",
            service_name="Old books",
            service_active=False,
        )
        # Keep publicly_visible by also giving an active publishable service
        # in another category; bookkeeping filter must still exclude them.
        Service.objects.create(
            accountant=self.inactive_only,
            name="Active tax planning",
            description="Planning",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            is_active=True,
            category=ServiceCategory.objects.get(slug="tax-planning"),
        )

    def test_no_category_param_preserves_current_directory(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = {row["user_id"] for row in resp.data}
        self.assertEqual(
            ids,
            {self.bookkeeping.id, self.payroll.id, self.multi.id, self.inactive_only.id},
        )

    def test_filters_by_active_category_slug(self):
        resp = self.client.get(self.url, {"category": "bookkeeping"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = [row["user_id"] for row in resp.data]
        self.assertEqual(set(ids), {self.bookkeeping.id, self.multi.id})
        self.assertEqual(len(ids), len(set(ids)))

    def test_excludes_inactive_service_in_requested_category(self):
        resp = self.client.get(self.url, {"category": "bookkeeping"})
        ids = {row["user_id"] for row in resp.data}
        self.assertNotIn(self.inactive_only.id, ids)

    def test_unknown_category_returns_400(self):
        resp = self.client.get(self.url, {"category": "not-a-real-category"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category", resp.data)

    def test_inactive_category_returns_400(self):
        inactive = ServiceCategory.objects.create(
            name="Inactive niche",
            slug="inactive-niche-dir",
            is_active=False,
            sort_order=900,
        )
        resp = self.client.get(self.url, {"category": inactive.slug})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category", resp.data)

    def test_uncategorized_returns_400(self):
        resp = self.client.get(self.url, {"category": "uncategorized"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category", resp.data)

    def test_category_and_geo_filters_combine(self):
        resp = self.client.get(
            self.url,
            {
                "category": "bookkeeping",
                "latitude": "39.9526",
                "longitude": "-75.1652",
                "radius_miles": "25",
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = {row["user_id"] for row in resp.data}
        self.assertEqual(ids, {self.bookkeeping.id, self.multi.id})
        self.assertNotIn(self.payroll.id, ids)
