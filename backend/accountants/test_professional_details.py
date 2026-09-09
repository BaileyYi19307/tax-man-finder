import importlib

from django.apps import apps
from django.db import connection
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from accountants.field_utils import normalize_string_list
from accountants.models import AccountantProfile
from accountants.serializers import AccountantProfileSerializer
from services.models import Service, ServiceCategory
from users.models import User

_backfill_mod = importlib.import_module(
    "accountants.migrations.0009_backfill_availability_from_service_scope"
)
backfill_availability_from_service_scope = (
    _backfill_mod.backfill_availability_from_service_scope
)


class NormalizeStringListTest(TestCase):
    def test_trims_deduplicates_and_drops_blanks(self):
        result = normalize_string_list(
            [" English ", "english", "  ", "Spanish", "SPANISH"],
            field_name="languages",
        )
        self.assertEqual(result, ["English", "Spanish"])

    def test_rejects_non_list(self):
        with self.assertRaises(ValidationError) as ctx:
            normalize_string_list("English", field_name="languages")
        self.assertIn("languages", ctx.exception.detail)

    def test_rejects_non_string_entries(self):
        with self.assertRaises(ValidationError) as ctx:
            normalize_string_list(["English", 2], field_name="languages")
        self.assertIn("languages", ctx.exception.detail)

    def test_enforces_item_length_limit(self):
        with self.assertRaises(ValidationError):
            normalize_string_list(["x" * 101], field_name="languages")

    def test_enforces_item_count_limit(self):
        with self.assertRaises(ValidationError):
            normalize_string_list([f"lang-{i}" for i in range(21)], field_name="languages")


class AccountantProfileSerializerTest(TestCase):
    def test_normalizes_languages_and_industries(self):
        serializer = AccountantProfileSerializer(
            data={
                "bio": "Bio",
                "credentials": "CPA",
                "languages": [" English ", "english", "Spanish"],
                "industries": [" Startups ", "startups", "Retail"],
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["languages"], ["English", "Spanish"])
        self.assertEqual(
            serializer.validated_data["industries"], ["Startups", "Retail"]
        )

    def test_headline_max_length(self):
        serializer = AccountantProfileSerializer(
            data={
                "bio": "Bio",
                "credentials": "CPA",
                "headline": "x" * 161,
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("headline", serializer.errors)

    def test_website_must_be_valid_url(self):
        serializer = AccountantProfileSerializer(
            data={
                "bio": "Bio",
                "credentials": "CPA",
                "website": "not-a-url",
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("website", serializer.errors)


class ProfessionalDetailsModelDefaultsTest(TestCase):
    def test_defaults_are_empty_or_false(self):
        user = User.objects.create_user(
            email="defaults@test.com",
            password="password123",
            is_verified=True,
        )
        profile = AccountantProfile.objects.create(user=user)
        self.assertEqual(profile.headline, "")
        self.assertEqual(profile.languages, [])
        self.assertFalse(profile.offers_remote)
        self.assertFalse(profile.offers_in_person)
        self.assertEqual(profile.industries, [])
        self.assertEqual(profile.website, "")
        self.assertEqual(profile.license_information, "")


class ProfessionalDetailsApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="pro-details@test.com",
            password="password123",
            is_verified=True,
        )
        self.client.force_authenticate(user=self.user)
        self.create_url = reverse("create_accountant")
        self.me_url = reverse("my-accountant-profile")
        self.category = ServiceCategory.objects.get(slug="individual-tax-returns")

    def test_create_and_read_expose_professional_details(self):
        resp = self.client.post(
            self.create_url,
            {
                "first_name": "Ada",
                "last_name": "Accountant",
                "bio": "Helps founders with taxes.",
                "credentials": "CPA",
                "location": "Austin, TX",
                "headline": "Startup tax specialist",
                "languages": [" English ", "english", "Spanish"],
                "offers_remote": True,
                "offers_in_person": False,
                "industries": [" Startups ", "startups"],
                "website": "https://example.com",
                "license_information": "TX CPA #12345",
                "service_name": "Individual returns",
                "service_description": "1040 prep",
                "category_id": self.category.id,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["headline"], "Startup tax specialist")
        self.assertEqual(resp.data["languages"], ["English", "Spanish"])
        self.assertTrue(resp.data["offers_remote"])
        self.assertFalse(resp.data["offers_in_person"])
        self.assertEqual(resp.data["industries"], ["Startups"])
        self.assertEqual(resp.data["website"], "https://example.com")
        self.assertEqual(resp.data["license_information"], "TX CPA #12345")
        self.assertIn("service_scope", resp.data)

        me = self.client.get(self.me_url)
        self.assertEqual(me.status_code, status.HTTP_200_OK)
        self.assertEqual(me.data["headline"], "Startup tax specialist")
        self.assertEqual(me.data["languages"], ["English", "Spanish"])

    def test_partial_update_preserves_existing_professional_details(self):
        profile = AccountantProfile.objects.create(
            user=self.user,
            bio="Existing bio",
            credentials="CPA",
            location="Boston, MA",
            headline="Existing headline",
            languages=["English"],
            offers_remote=True,
        )
        Service.objects.create(
            accountant=self.user,
            name="Returns",
            description="1040",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            category=self.category,
        )
        resp = self.client.post(
            self.create_url,
            {
                "bio": "Updated bio",
                "credentials": "CPA",
                "location": "Boston, MA",
                "headline": "Updated headline",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        profile.refresh_from_db()
        self.assertEqual(profile.headline, "Updated headline")
        self.assertEqual(profile.languages, ["English"])
        self.assertTrue(profile.offers_remote)

    def test_invalid_languages_returns_field_error(self):
        resp = self.client.post(
            self.create_url,
            {
                "bio": "Bio",
                "credentials": "CPA",
                "location": "Austin, TX",
                "languages": "English",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("languages", resp.data)


class AvailabilityBackfillMigrationTest(TestCase):
    def test_backfill_maps_service_scope_without_inferring_both(self):
        local_user = User.objects.create_user(
            email="local-mig@test.com",
            password="password123",
            is_verified=True,
        )
        remote_user = User.objects.create_user(
            email="remote-mig@test.com",
            password="password123",
            is_verified=True,
        )
        nationwide_user = User.objects.create_user(
            email="nation-mig@test.com",
            password="password123",
            is_verified=True,
        )
        local = AccountantProfile.objects.create(
            user=local_user,
            service_scope=AccountantProfile.ServiceScope.LOCAL,
        )
        remote = AccountantProfile.objects.create(
            user=remote_user,
            service_scope=AccountantProfile.ServiceScope.REMOTE,
        )
        nationwide = AccountantProfile.objects.create(
            user=nationwide_user,
            service_scope=AccountantProfile.ServiceScope.NATIONWIDE,
        )

        backfill_availability_from_service_scope(apps, connection.schema_editor())

        local.refresh_from_db()
        remote.refresh_from_db()
        nationwide.refresh_from_db()
        self.assertTrue(local.offers_in_person)
        self.assertFalse(local.offers_remote)
        self.assertTrue(remote.offers_remote)
        self.assertFalse(remote.offers_in_person)
        self.assertTrue(nationwide.offers_remote)
        self.assertFalse(nationwide.offers_in_person)
