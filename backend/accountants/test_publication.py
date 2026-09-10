from datetime import timedelta
from decimal import Decimal
import importlib

from django.apps import apps
from django.db import connection
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accountants.models import AccountantProfile
from bookings.models import Booking
from inquiries.models import Inquiry
from services.models import Service, ServiceCategory
from users.models import User

_backfill_mod = importlib.import_module(
    "accountants.migrations.0007_backfill_publication_status"
)
backfill_publication_status = _backfill_mod.backfill_publication_status

_languages_backfill_mod = importlib.import_module(
    "accountants.migrations.0011_backfill_published_empty_languages"
)
backfill_published_empty_languages = (
    _languages_backfill_mod.backfill_published_empty_languages
)


def _make_ready_profile(
    *,
    email,
    publish=False,
    location="Boston, MA",
    category_slug="individual-tax-returns",
    service_active=True,
):
    user = User.objects.create_user(
        email=email,
        password="password123",
        is_verified=True,
        first_name="Ready",
        last_name="Pro",
    )
    profile = AccountantProfile.objects.create(
        user=user,
        bio="I prepare returns.",
        credentials="CPA",
        location=location,
        years_experience=4,
        firm_name="Ready Tax",
        languages=["English"],
        offers_remote=True,
        offers_in_person=False,
        publication_status=(
            AccountantProfile.PublicationStatus.PUBLISHED
            if publish
            else AccountantProfile.PublicationStatus.DRAFT
        ),
    )
    category = ServiceCategory.objects.get(slug=category_slug)
    service = Service.objects.create(
        accountant=user,
        name="Primary offering",
        description="Client-facing offering",
        pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
        is_active=service_active,
        category=category,
    )
    return user, profile, service


class PublishReadinessModelTest(TestCase):
    def test_missing_bio_is_not_ready(self):
        user, profile, _ = _make_ready_profile(email="ready-bio@test.com")
        profile.bio = ""
        profile.save(update_fields=["bio"])
        self.assertFalse(profile.is_publish_ready)
        self.assertIn("bio", profile.publish_readiness_errors())

    def test_missing_credentials_is_not_ready(self):
        user, profile, _ = _make_ready_profile(email="ready-cred@test.com")
        profile.credentials = "   "
        profile.save(update_fields=["credentials"])
        self.assertFalse(profile.is_publish_ready)
        self.assertIn("credentials", profile.publish_readiness_errors())

    def test_missing_location_is_not_ready(self):
        user, profile, _ = _make_ready_profile(email="ready-loc@test.com")
        profile.location = ""
        profile.save(update_fields=["location"])
        self.assertFalse(profile.is_publish_ready)
        self.assertIn("location", profile.publish_readiness_errors())

    def test_ready_with_valid_active_categorized_service(self):
        _, profile, _ = _make_ready_profile(email="ready-ok@test.com")
        self.assertTrue(profile.is_publish_ready)
        self.assertEqual(profile.publish_readiness_errors(), {})

    def test_missing_first_name_is_not_ready(self):
        user, profile, _ = _make_ready_profile(email="ready-fn@test.com")
        user.first_name = ""
        user.save(update_fields=["first_name"])
        profile.refresh_from_db()
        self.assertFalse(profile.is_publish_ready)
        self.assertIn("first_name", profile.publish_readiness_errors())

    def test_missing_last_name_is_not_ready(self):
        user, profile, _ = _make_ready_profile(email="ready-ln@test.com")
        user.last_name = "  "
        user.save(update_fields=["last_name"])
        profile.refresh_from_db()
        self.assertFalse(profile.is_publish_ready)
        self.assertIn("last_name", profile.publish_readiness_errors())

    def test_missing_languages_is_not_ready(self):
        _, profile, _ = _make_ready_profile(email="ready-lang@test.com")
        profile.languages = []
        profile.save(update_fields=["languages"])
        self.assertFalse(profile.is_publish_ready)
        self.assertIn("languages", profile.publish_readiness_errors())

    def test_missing_availability_is_not_ready(self):
        _, profile, _ = _make_ready_profile(email="ready-avail@test.com")
        profile.offers_remote = False
        profile.offers_in_person = False
        profile.save(update_fields=["offers_remote", "offers_in_person"])
        self.assertFalse(profile.is_publish_ready)
        self.assertIn("availability", profile.publish_readiness_errors())
        # Legacy service_scope alone does not satisfy readiness.
        profile.service_scope = AccountantProfile.ServiceScope.REMOTE
        profile.save(update_fields=["service_scope"])
        self.assertFalse(profile.is_publish_ready)

    def test_optional_fields_do_not_affect_readiness(self):
        _, profile, _ = _make_ready_profile(email="ready-optional@test.com")
        profile.headline = ""
        profile.industries = []
        profile.website = ""
        profile.license_information = ""
        profile.years_experience = 0
        profile.save()
        self.assertTrue(profile.is_publish_ready)
        self.assertEqual(profile.publish_readiness_errors(), {})

    def test_uncategorized_service_does_not_count(self):
        user, profile, service = _make_ready_profile(email="ready-uncat@test.com")
        service.category = ServiceCategory.objects.get(slug="uncategorized")
        service.save(update_fields=["category"])
        profile.refresh_from_db()
        self.assertFalse(profile.is_publish_ready)
        self.assertIn("services", profile.publish_readiness_errors())

    def test_inactive_category_does_not_count(self):
        user, profile, service = _make_ready_profile(email="ready-inact@test.com")
        inactive = ServiceCategory.objects.create(
            name="Inactive niche",
            slug="inactive-niche-pub",
            is_active=False,
            sort_order=900,
        )
        service.category = inactive
        service.save(update_fields=["category"])
        self.assertFalse(profile.is_publish_ready)

    def test_inactive_service_does_not_count(self):
        _, profile, service = _make_ready_profile(
            email="ready-svc-off@test.com", service_active=False
        )
        self.assertFalse(profile.is_publish_ready)

    def test_published_unready_is_not_public_without_mutating_status(self):
        user, profile, service = _make_ready_profile(
            email="ready-unready@test.com", publish=True
        )
        self.assertTrue(profile.is_public)
        service.is_active = False
        service.save(update_fields=["is_active"])
        profile.refresh_from_db()
        self.assertEqual(
            profile.publication_status,
            AccountantProfile.PublicationStatus.PUBLISHED,
        )
        self.assertFalse(profile.is_publish_ready)
        self.assertFalse(profile.is_public)

    def test_whitespace_only_fields_excluded_from_public_queryset(self):
        user, profile, _ = _make_ready_profile(
            email="ready-ws@test.com", publish=True
        )
        profile.bio = "   "
        profile.save(update_fields=["bio"])
        self.assertFalse(profile.is_publish_ready)
        self.assertFalse(profile.is_public)
        self.assertFalse(
            AccountantProfile.objects.publicly_visible()
            .filter(pk=profile.pk)
            .exists()
        )


class PublishUnpublishApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.publish_url = reverse("publish-accountant-profile")
        self.unpublish_url = reverse("unpublish-accountant-profile")

    def test_successful_publish_and_idempotent_republish(self):
        user, profile, _ = _make_ready_profile(email="pub-ok@test.com")
        self.client.force_authenticate(user=user)
        first = self.client.post(self.publish_url)
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data["publication_status"], "published")
        self.assertTrue(first.data["is_publish_ready"])
        self.assertTrue(first.data["is_public"])
        self.assertTrue(first.data["profile_complete"])

        second = self.client.post(self.publish_url)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(second.data["publication_status"], "published")
        profile.refresh_from_db()
        self.assertEqual(
            profile.publication_status,
            AccountantProfile.PublicationStatus.PUBLISHED,
        )

    def test_publish_validation_errors_are_actionable(self):
        user, profile, _ = _make_ready_profile(email="pub-err@test.com")
        profile.bio = ""
        profile.location = ""
        profile.save(update_fields=["bio", "location"])
        self.client.force_authenticate(user=user)
        resp = self.client.post(self.publish_url)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("bio", resp.data)
        self.assertIn("location", resp.data)
        profile.refresh_from_db()
        self.assertEqual(
            profile.publication_status, AccountantProfile.PublicationStatus.DRAFT
        )

    def test_unpublish_is_idempotent_and_keeps_services(self):
        user, profile, service = _make_ready_profile(
            email="unpub-ok@test.com", publish=True
        )
        self.client.force_authenticate(user=user)
        first = self.client.post(self.unpublish_url)
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data["publication_status"], "draft")
        self.assertFalse(first.data["is_public"])
        self.assertTrue(Service.objects.filter(pk=service.id, is_active=True).exists())

        second = self.client.post(self.unpublish_url)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(second.data["publication_status"], "draft")

    def test_publish_requires_authentication(self):
        resp = self.client.post(self.publish_url)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cannot_publish_another_accountants_profile(self):
        owner, _, _ = _make_ready_profile(email="owner-pub@test.com")
        other, _, _ = _make_ready_profile(email="other-pub@test.com")
        self.client.force_authenticate(user=other)
        resp = self.client.post(self.publish_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        owner.accountant_profile.refresh_from_db()
        other.accountant_profile.refresh_from_db()
        self.assertEqual(
            owner.accountant_profile.publication_status,
            AccountantProfile.PublicationStatus.DRAFT,
        )
        self.assertEqual(
            other.accountant_profile.publication_status,
            AccountantProfile.PublicationStatus.PUBLISHED,
        )


class PublicationVisibilityApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.directory_url = reverse("accountant-directory")
        self.services_url = reverse("service-list")

    def test_directory_includes_only_public_profiles(self):
        draft_user, _, _ = _make_ready_profile(email="vis-draft@test.com", publish=False)
        public_user, _, _ = _make_ready_profile(
            email="vis-public@test.com", publish=True
        )
        unready_user, unready_profile, unready_service = _make_ready_profile(
            email="vis-unready@test.com", publish=True
        )
        unready_service.is_active = False
        unready_service.save(update_fields=["is_active"])
        ws_user, ws_profile, _ = _make_ready_profile(
            email="vis-whitespace@test.com", publish=True
        )
        ws_profile.location = " \t "
        ws_profile.save(update_fields=["location"])

        resp = self.client.get(self.directory_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = {row["user_id"] for row in resp.data}
        self.assertEqual(ids, {public_user.id})
        self.assertNotIn(draft_user.id, ids)
        self.assertNotIn(unready_user.id, ids)
        self.assertNotIn(ws_user.id, ids)
        unready_profile.refresh_from_db()
        self.assertEqual(
            unready_profile.publication_status,
            AccountantProfile.PublicationStatus.PUBLISHED,
        )

    def test_public_service_list_only_includes_public_profile_services(self):
        draft_user, _, draft_service = _make_ready_profile(
            email="svc-draft@test.com", publish=False
        )
        public_user, _, public_service = _make_ready_profile(
            email="svc-public@test.com", publish=True
        )
        resp = self.client.get(self.services_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = {row["id"] for row in resp.data}
        self.assertIn(public_service.id, ids)
        self.assertNotIn(draft_service.id, ids)

    def test_direct_public_profile_hides_draft_and_unready(self):
        draft_user, _, _ = _make_ready_profile(email="direct-draft@test.com")
        public_user, _, _ = _make_ready_profile(
            email="direct-public@test.com", publish=True
        )
        unready_user, _, unready_service = _make_ready_profile(
            email="direct-unready@test.com", publish=True
        )
        unready_service.is_active = False
        unready_service.save(update_fields=["is_active"])

        draft = self.client.get(
            reverse("public-accountant-profile", args=[draft_user.id])
        )
        public = self.client.get(
            reverse("public-accountant-profile", args=[public_user.id])
        )
        unready = self.client.get(
            reverse("public-accountant-profile", args=[unready_user.id])
        )
        self.assertEqual(draft.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(public.status_code, status.HTTP_200_OK)
        self.assertTrue(public.data["is_public"])
        self.assertEqual(unready.status_code, status.HTTP_404_NOT_FOUND)

    def test_owner_can_access_draft_via_me(self):
        user, profile, _ = _make_ready_profile(email="owner-draft@test.com")
        self.client.force_authenticate(user=user)
        resp = self.client.get(reverse("my-accountant-profile"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["publication_status"], "draft")
        self.assertTrue(resp.data["is_publish_ready"])
        self.assertFalse(resp.data["is_public"])
        self.assertEqual(resp.data["publish_readiness_errors"], {})

    def test_profile_status_hidden_from_public_for_draft(self):
        user, _, _ = _make_ready_profile(email="status-draft@test.com")
        anon = self.client.get(reverse("profile-status", args=[user.id]))
        self.assertEqual(anon.status_code, status.HTTP_404_NOT_FOUND)
        self.client.force_authenticate(user=user)
        own = self.client.get(reverse("profile-status", args=[user.id]))
        self.assertEqual(own.status_code, status.HTTP_200_OK)
        self.assertEqual(own.data["publication_status"], "draft")
        self.assertEqual(own.data["publish_readiness_errors"], {})


class PublishReadinessErrorsApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_owner_me_includes_publish_readiness_errors(self):
        user, profile, _ = _make_ready_profile(email="ready-errs@test.com")
        profile.location = ""
        profile.save(update_fields=["location"])
        self.client.force_authenticate(user=user)
        resp = self.client.get(reverse("my-accountant-profile"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data["is_publish_ready"])
        self.assertEqual(
            resp.data["publish_readiness_errors"],
            profile.publish_readiness_errors(),
        )
        self.assertEqual(
            resp.data["publish_readiness_errors"]["location"],
            ["Location is required to publish."],
        )

    def test_owner_status_includes_publish_readiness_errors(self):
        user, profile, service = _make_ready_profile(email="status-errs@test.com")
        service.is_active = False
        service.save(update_fields=["is_active"])
        self.client.force_authenticate(user=user)
        resp = self.client.get(reverse("profile-status", args=[user.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(
            resp.data["publish_readiness_errors"],
            {
                "services": [
                    "At least one active service with a valid public category "
                    "is required to publish."
                ]
            },
        )
        self.assertEqual(
            resp.data["publish_readiness_errors"],
            profile.publish_readiness_errors(),
        )

    def test_public_profile_omits_publish_readiness_errors(self):
        user, _, _ = _make_ready_profile(email="pub-omit@test.com", publish=True)
        resp = self.client.get(reverse("public-accountant-profile", args=[user.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertNotIn("publish_readiness_errors", resp.data)

    def test_directory_omits_publish_readiness_errors(self):
        user, _, _ = _make_ready_profile(email="dir-omit@test.com", publish=True)
        resp = self.client.get(reverse("accountant-directory"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        row = next(item for item in resp.data if item["user_id"] == user.id)
        self.assertNotIn("publish_readiness_errors", row)

    def test_public_status_for_published_profile_omits_readiness_errors(self):
        user, _, _ = _make_ready_profile(email="status-pub@test.com", publish=True)
        resp = self.client.get(reverse("profile-status", args=[user.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["is_public"])
        self.assertNotIn("publish_readiness_errors", resp.data)

    def test_status_serializer_exposes_read_only_errors(self):
        from accountants.serializers import AccountantProfileStatusSerializer

        payload = {
            "profile_info_complete": False,
            "services_exist": False,
            "profile_complete": False,
            "publication_status": "draft",
            "is_publish_ready": False,
            "is_public": False,
            "publish_readiness_errors": {
                "bio": ["Bio is required to publish."],
            },
        }
        serializer = AccountantProfileStatusSerializer(payload)
        self.assertEqual(
            serializer.data["publish_readiness_errors"],
            {"bio": ["Bio is required to publish."]},
        )
        # Not accepted as writable input on the status serializer.
        inbound = AccountantProfileStatusSerializer(
            data={
                **payload,
                "publish_readiness_errors": {"bio": ["ignored"]},
            }
        )
        self.assertTrue(inbound.is_valid(), inbound.errors)
        self.assertNotIn("publish_readiness_errors", inbound.validated_data)


class PublicationBookingStabilityTest(TestCase):
    def test_bookings_remain_accessible_after_unpublish(self):
        accountant, profile, service = _make_ready_profile(
            email="book-acct@test.com", publish=True
        )
        client = User.objects.create_user(
            email="book-client@test.com",
            password="password123",
            is_verified=True,
        )
        inquiry = Inquiry.objects.create(client=client, accountant=accountant)
        starts = timezone.now() + timedelta(days=2)
        booking = Booking.objects.create(
            inquiry=inquiry,
            client=client,
            accountant=accountant,
            service=service,
            starts_at=starts,
            ends_at=starts + timedelta(minutes=30),
            consultation_fee=Decimal("0.00"),
        )
        booking_id = booking.id
        service_id = service.id

        api = APIClient()
        api.force_authenticate(user=accountant)
        unpub = api.post(reverse("unpublish-accountant-profile"))
        self.assertEqual(unpub.status_code, status.HTTP_200_OK)

        booking.refresh_from_db()
        self.assertEqual(booking.id, booking_id)
        self.assertEqual(booking.service_id, service_id)
        self.assertTrue(Service.objects.filter(pk=service_id, is_active=True).exists())
        profile.refresh_from_db()
        self.assertEqual(
            profile.publication_status, AccountantProfile.PublicationStatus.DRAFT
        )


class PublicationBackfillMigrationTest(TestCase):
    def test_backfill_marks_only_ready_profiles_published(self):
        ready_user, ready_profile, _ = _make_ready_profile(email="bf-ready@test.com")
        ready_profile.publication_status = AccountantProfile.PublicationStatus.DRAFT
        ready_profile.save(update_fields=["publication_status"])

        draft_user, draft_profile, _ = _make_ready_profile(
            email="bf-draft@test.com", location=""
        )
        uncat_user, uncat_profile, uncat_service = _make_ready_profile(
            email="bf-uncat@test.com"
        )
        uncat_service.category = ServiceCategory.objects.get(slug="uncategorized")
        uncat_service.save(update_fields=["category"])

        backfill_publication_status(apps, connection.schema_editor())

        ready_profile.refresh_from_db()
        draft_profile.refresh_from_db()
        uncat_profile.refresh_from_db()
        self.assertEqual(
            ready_profile.publication_status,
            AccountantProfile.PublicationStatus.PUBLISHED,
        )
        self.assertEqual(
            draft_profile.publication_status,
            AccountantProfile.PublicationStatus.DRAFT,
        )
        self.assertEqual(
            uncat_profile.publication_status,
            AccountantProfile.PublicationStatus.DRAFT,
        )


class PublishedEmptyLanguagesBackfillMigrationTest(TestCase):
    def test_backfill_defaults_only_published_empty_languages(self):
        _, published_empty, _ = _make_ready_profile(
            email="lang-pub-empty@test.com", publish=True
        )
        published_empty.languages = []
        published_empty.save(update_fields=["languages"])
        self.assertFalse(published_empty.is_public)

        _, published_existing, _ = _make_ready_profile(
            email="lang-pub-existing@test.com", publish=True
        )
        published_existing.languages = ["Spanish", "French"]
        published_existing.save(update_fields=["languages"])

        _, draft_empty, _ = _make_ready_profile(email="lang-draft-empty@test.com")
        draft_empty.languages = []
        draft_empty.publication_status = AccountantProfile.PublicationStatus.DRAFT
        draft_empty.save(update_fields=["languages", "publication_status"])

        backfill_published_empty_languages(apps, connection.schema_editor())

        published_empty.refresh_from_db()
        published_existing.refresh_from_db()
        draft_empty.refresh_from_db()

        self.assertEqual(published_empty.languages, ["English"])
        self.assertEqual(
            published_empty.publication_status,
            AccountantProfile.PublicationStatus.PUBLISHED,
        )
        self.assertTrue(published_empty.is_publish_ready)
        self.assertTrue(published_empty.is_public)
        self.assertTrue(
            AccountantProfile.objects.publicly_visible()
            .filter(pk=published_empty.pk)
            .exists()
        )

        self.assertEqual(published_existing.languages, ["Spanish", "French"])
        self.assertEqual(draft_empty.languages, [])
        self.assertEqual(
            draft_empty.publication_status,
            AccountantProfile.PublicationStatus.DRAFT,
        )

