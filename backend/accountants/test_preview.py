from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accountants.models import AccountantProfile
from accountants.test_publication import _make_ready_profile
from services.models import Service, ServiceCategory
from users.models import User


class OwnerPreviewApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.preview_url = reverse("preview-accountant-profile")
        self.user, self.profile, self.service = _make_ready_profile(
            email="preview-owner@test.com",
            publish=False,
        )
        self.profile.headline = "Startup tax help"
        self.profile.industries = ["Startups"]
        self.profile.website = "https://example.com"
        self.profile.license_information = "TX CPA"
        self.profile.offers_remote = True
        self.profile.offers_in_person = True
        self.profile.languages = ["English", "Spanish"]
        self.profile.save()

    def test_owner_can_preview_draft_profile(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(self.preview_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["user_id"], self.user.id)
        self.assertEqual(resp.data["publication_status"], "draft")
        self.assertFalse(resp.data["is_public"])
        self.assertTrue(resp.data["is_publish_ready"])
        self.assertIn("publish_readiness_errors", resp.data)
        self.assertEqual(resp.data["headline"], "Startup tax help")
        self.assertEqual(resp.data["languages"], ["English", "Spanish"])
        self.assertTrue(resp.data["offers_remote"])
        self.assertTrue(resp.data["offers_in_person"])
        self.assertEqual(len(resp.data["services"]), 1)
        self.assertEqual(resp.data["services"][0]["id"], self.service.id)
        self.assertEqual(
            resp.data["services"][0]["category"]["slug"],
            "individual-tax-returns",
        )
        # Customer-facing shape: no password / private account fields.
        self.assertNotIn("password", resp.data)
        self.assertNotIn("is_staff", resp.data)

    def test_unauthenticated_cannot_preview(self):
        resp = self.client.get(self.preview_url)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_other_user_cannot_preview_owner_draft(self):
        other = User.objects.create_user(
            email="other-preview@test.com",
            password="password123",
            is_verified=True,
        )
        self.client.force_authenticate(user=other)
        resp = self.client.get(self.preview_url)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_public_draft_endpoint_still_unavailable(self):
        public_url = reverse(
            "public-accountant-profile", kwargs={"user_id": self.user.id}
        )
        resp = self.client.get(public_url)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

        stranger = User.objects.create_user(
            email="stranger-preview@test.com",
            password="password123",
            is_verified=True,
        )
        self.client.force_authenticate(user=stranger)
        resp = self.client.get(public_url)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_inactive_services_omitted_from_preview(self):
        category = ServiceCategory.objects.get(slug="bookkeeping")
        Service.objects.create(
            accountant=self.user,
            name="Hidden books",
            description="Inactive",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            is_active=False,
            category=category,
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(self.preview_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        names = [row["name"] for row in resp.data["services"]]
        self.assertEqual(names, ["Primary offering"])
        self.assertNotIn("Hidden books", names)

    def test_incomplete_draft_still_previewable(self):
        self.profile.bio = ""
        self.profile.credentials = ""
        self.profile.save(update_fields=["bio", "credentials"])
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(self.preview_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data["is_publish_ready"])
        self.assertIn("bio", resp.data["publish_readiness_errors"])
        self.assertIn("credentials", resp.data["publish_readiness_errors"])
