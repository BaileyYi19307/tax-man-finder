from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accountants.models import AccountantProfile
from services.cancellation_policy import is_valid_cancellation_policy_code
from services.models import Service


@override_settings(DEBUG=True)
class ResetClientDemoAccountantsCommandTest(TestCase):
    def test_seeded_demo_accountants_are_publish_ready_and_public(self):
        call_command("reset_client_demo_accountants")

        demos = AccountantProfile.objects.filter(
            user__email__startswith="demo.acct."
        ).select_related("user")
        self.assertEqual(demos.count(), 4)

        client = APIClient()
        directory = client.get(reverse("accountant-directory"))
        self.assertEqual(directory.status_code, status.HTTP_200_OK)
        directory_ids = {row["user_id"] for row in directory.data}

        for profile in demos:
            self.assertEqual(profile.languages, ["English"])
            scope = profile.service_scope
            if scope == AccountantProfile.ServiceScope.LOCAL:
                self.assertTrue(profile.offers_in_person)
                self.assertFalse(profile.offers_remote)
            elif scope in (
                AccountantProfile.ServiceScope.REMOTE,
                AccountantProfile.ServiceScope.NATIONWIDE,
            ):
                self.assertTrue(profile.offers_remote)
                self.assertFalse(profile.offers_in_person)
            else:
                self.fail(f"Unexpected service_scope: {scope}")

            self.assertTrue(profile.is_publish_ready, profile.publish_readiness_errors())
            self.assertTrue(profile.is_public)
            self.assertEqual(
                profile.publication_status,
                AccountantProfile.PublicationStatus.PUBLISHED,
            )
            self.assertIn(profile.user_id, directory_ids)
            self.assertTrue(
                AccountantProfile.objects.publicly_visible()
                .filter(pk=profile.pk)
                .exists()
            )

            services = Service.objects.filter(accountant=profile.user, is_active=True)
            self.assertEqual(services.count(), 1)
            service = services.get()
            self.assertIsNotNone(service.category_id)
            self.assertTrue(service.category.is_active)
            self.assertNotEqual(service.category.slug, "uncategorized")
            self.assertTrue(
                is_valid_cancellation_policy_code(service.cancellation_policy_code)
            )
            self.assertTrue(str(service.cancellation_policy or "").strip())
