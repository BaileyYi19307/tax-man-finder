from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from unittest.mock import patch

from accountants.models import AccountantProfile
from services.models import Service, ServiceCategory
from users.models import User


class DraftProfileSaveApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="draft@test.com",
            password="password123",
            is_verified=True,
        )
        self.client.force_authenticate(user=self.user)
        self.create_url = reverse("create_accountant")
        self.category = ServiceCategory.objects.get(slug="individual-tax-returns")

    def test_create_minimal_empty_draft(self):
        resp = self.client.post(self.create_url, {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(AccountantProfile.objects.filter(user=self.user).count(), 1)
        self.assertEqual(resp.data["publication_status"], "draft")
        self.assertFalse(resp.data["is_publish_ready"])
        self.assertFalse(resp.data["is_public"])
        self.assertEqual(Service.objects.filter(accountant=self.user).count(), 0)
        errors = resp.data["publish_readiness_errors"]
        for key in (
            "first_name",
            "last_name",
            "bio",
            "location",
            "credentials",
            "languages",
            "availability",
            "services",
        ):
            self.assertIn(key, errors)

    def test_save_basic_profile_section_independently(self):
        self.client.post(self.create_url, {}, format="json")
        resp = self.client.post(
            self.create_url,
            {
                "first_name": "Ada",
                "last_name": "Lovelace",
                "bio": "Helps founders.",
                "location": "Austin, TX",
                "headline": "Startup tax help",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["first_name"], "Ada")
        self.assertEqual(resp.data["last_name"], "Lovelace")
        self.assertEqual(resp.data["bio"], "Helps founders.")
        self.assertEqual(resp.data["location"], "Austin, TX")
        self.assertEqual(resp.data["headline"], "Startup tax help")
        self.assertEqual(AccountantProfile.objects.filter(user=self.user).count(), 1)

    def test_save_professional_details_section_independently(self):
        self.client.post(
            self.create_url,
            {"bio": "Bio", "credentials": "CPA"},
            format="json",
        )
        resp = self.client.post(
            self.create_url,
            {
                "languages": ["English", "Spanish"],
                "offers_remote": True,
                "offers_in_person": False,
                "industries": ["Startups"],
                "website": "https://example.com",
                "license_information": "TX CPA",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        profile = AccountantProfile.objects.get(user=self.user)
        self.assertEqual(profile.bio, "Bio")
        self.assertEqual(profile.credentials, "CPA")
        self.assertEqual(profile.languages, ["English", "Spanish"])
        self.assertTrue(profile.offers_remote)
        self.assertFalse(profile.offers_in_person)

    def test_update_existing_draft_is_idempotent_upsert(self):
        first = self.client.post(self.create_url, {"bio": "One"}, format="json")
        second = self.client.post(self.create_url, {"bio": "Two"}, format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(AccountantProfile.objects.filter(user=self.user).count(), 1)
        self.assertEqual(second.data["bio"], "Two")

    def test_omitted_fields_are_not_erased(self):
        self.client.post(
            self.create_url,
            {
                "bio": "Keep me",
                "credentials": "CPA",
                "location": "Boston, MA",
                "languages": ["English"],
                "offers_remote": True,
                "headline": "Keep headline",
            },
            format="json",
        )
        resp = self.client.post(
            self.create_url,
            {"years_experience": 7},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        profile = AccountantProfile.objects.get(user=self.user)
        self.assertEqual(profile.bio, "Keep me")
        self.assertEqual(profile.credentials, "CPA")
        self.assertEqual(profile.location, "Boston, MA")
        self.assertEqual(profile.languages, ["English"])
        self.assertTrue(profile.offers_remote)
        self.assertEqual(profile.headline, "Keep headline")
        self.assertEqual(profile.years_experience, 7)

    def test_first_and_last_name_updates(self):
        self.client.post(self.create_url, {}, format="json")
        resp = self.client.post(
            self.create_url,
            {"first_name": "Grace", "last_name": "Hopper"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Grace")
        self.assertEqual(self.user.last_name, "Hopper")
        # Partial name update does not blank the other.
        resp = self.client.post(
            self.create_url,
            {"first_name": "Admiral"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Admiral")
        self.assertEqual(self.user.last_name, "Hopper")

    def test_blank_name_when_provided_is_rejected(self):
        resp = self.client.post(
            self.create_url,
            {"first_name": "   "},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("first_name", resp.data)
        self.assertFalse(AccountantProfile.objects.filter(user=self.user).exists())

    def test_no_service_created_when_service_name_absent(self):
        resp = self.client.post(
            self.create_url,
            {
                "bio": "Bio",
                "credentials": "CPA",
                "category_id": self.category.id,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Service.objects.filter(accountant=self.user).count(), 0)

    def test_invalid_partial_service_data_does_not_create_service_or_profile(self):
        resp = self.client.post(
            self.create_url,
            {
                "first_name": "Ada",
                "last_name": "Lovelace",
                "bio": "Bio",
                "service_name": "Individual returns",
                # missing category_id
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category_id", resp.data)
        self.assertFalse(AccountantProfile.objects.filter(user=self.user).exists())
        self.assertEqual(Service.objects.filter(accountant=self.user).count(), 0)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "")
        self.assertEqual(self.user.last_name, "")

    def test_invalid_service_category_rolls_back_name_and_profile_changes(self):
        # Existing draft so we can assert names are not updated on failure.
        AccountantProfile.objects.create(user=self.user, bio="Existing")
        self.user.first_name = "Original"
        self.user.last_name = "Name"
        self.user.save(update_fields=["first_name", "last_name"])

        resp = self.client.post(
            self.create_url,
            {
                "first_name": "Changed",
                "last_name": "Person",
                "bio": "Updated bio",
                "service_name": "New offering",
                "category_id": 999999,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category_id", resp.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Original")
        self.assertEqual(self.user.last_name, "Name")
        self.user.accountant_profile.refresh_from_db()
        self.assertEqual(self.user.accountant_profile.bio, "Existing")
        self.assertEqual(Service.objects.filter(accountant=self.user).count(), 0)

    @patch("accountants.views.Service.objects.create")
    def test_service_create_failure_rolls_back_profile_and_names(self, mock_create):
        mock_create.side_effect = RuntimeError("boom")
        with self.assertRaises(RuntimeError):
            self.client.post(
                self.create_url,
                {
                    "first_name": "Ada",
                    "last_name": "Lovelace",
                    "bio": "Bio",
                    "service_name": "Returns",
                    "category_id": self.category.id,
                },
                format="json",
            )
        self.assertFalse(AccountantProfile.objects.filter(user=self.user).exists())
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "")
        self.assertEqual(self.user.last_name, "")


class DraftPublicationReadinessApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="ready-draft@test.com",
            password="password123",
            is_verified=True,
            first_name="Ready",
            last_name="Pro",
        )
        self.client.force_authenticate(user=self.user)
        self.profile = AccountantProfile.objects.create(
            user=self.user,
            bio="I prepare returns.",
            credentials="CPA",
            location="Boston, MA",
            languages=["English"],
            offers_remote=True,
        )
        self.category = ServiceCategory.objects.get(slug="individual-tax-returns")
        self.service = Service.objects.create(
            accountant=self.user,
            name="Returns",
            description="1040",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            is_active=True,
            category=self.category,
        )

    def test_successful_readiness_with_all_required_fields(self):
        self.assertTrue(self.profile.is_publish_ready)
        self.assertEqual(self.profile.publish_readiness_errors(), {})

    def test_published_profile_becomes_non_public_when_language_missing(self):
        self.profile.publication_status = AccountantProfile.PublicationStatus.PUBLISHED
        self.profile.save(update_fields=["publication_status"])
        self.assertTrue(self.profile.is_public)

        self.profile.languages = []
        self.profile.save(update_fields=["languages"])
        self.profile.refresh_from_db()
        self.assertEqual(
            self.profile.publication_status,
            AccountantProfile.PublicationStatus.PUBLISHED,
        )
        self.assertFalse(self.profile.is_publish_ready)
        self.assertFalse(self.profile.is_public)
        self.assertIn("languages", self.profile.publish_readiness_errors())
        self.assertFalse(
            AccountantProfile.objects.publicly_visible()
            .filter(pk=self.profile.pk)
            .exists()
        )

    def test_optional_fields_do_not_block_readiness(self):
        self.profile.headline = ""
        self.profile.industries = []
        self.profile.website = ""
        self.profile.license_information = ""
        self.profile.save()
        self.assertTrue(self.profile.is_publish_ready)
