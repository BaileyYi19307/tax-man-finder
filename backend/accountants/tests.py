from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User
from accountants.models import AccountantProfile
from services.models import Service
from django.urls import reverse

class ProfileStatusTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        #setup data for the whole test case

        #make a user
        cls.user = User.objects.create_user(
            email="acct@test.com",
            password="password123",
            is_accountant=True,
        )

        cls.profile = AccountantProfile.objects.create(
            user=cls.user,
            credentials="",
            bio="",
            years_experience=0,
        )
        
    def setUp(self):
        self.client = APIClient()

    def test_incomplete_initially(self):
        url = reverse("profile-status", args=[self.user.id])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["profile_complete"])

    def test_bio_complete_no_services(self):
        self.profile.credentials="CPA"
        self.profile.bio="hi"
        self.profile.years_experience = 3
        self.profile.save()

        url = reverse("profile-status", args=[self.user.id])
        resp = self.client.get(url)

        self.assertEqual(resp.status_code,200)
        self.assertFalse(resp.data["profile_complete"])
        
    def test_profile_complete_when_info_and_services_exist(self):
        self.profile.credentials="CPA"
        self.profile.bio="hi"
        self.profile.years_experience = 3
        self.profile.save()

        # Service.accountant is a User, not AccountantProfile
        Service.objects.create(
            accountant=self.user,
            name="Tax Filing",
            description="This is a tax filing",
            indicative_price=100,
        )
        
        url = reverse("profile-status", args=[self.user.id])
        resp = self.client.get(url)

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["profile_complete"])


class PublicAccountantProfileTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            email="public-acct@test.com",
            password="password123",
            is_accountant=True,
        )
        cls.profile = AccountantProfile.objects.create(
            user=cls.user,
            credentials="CPA",
            bio="Helps with taxes",
            years_experience=5,
        )
        cls.service = Service.objects.create(
            accountant=cls.user,
            name="Tax Filing",
            description="File taxes",
            indicative_price=100,
            is_active=True,
        )

    def setUp(self):
        self.client = APIClient()

    def test_public_profile_lists_active_services(self):
        url = reverse("public-accountant-profile", args=[self.user.id])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["user_id"], self.user.id)
        self.assertEqual(resp.data["email"], "public-acct@test.com")
        self.assertEqual(len(resp.data["services"]), 1)
        self.assertEqual(resp.data["services"][0]["id"], self.service.id)


class AccountantDirectoryAndOnboardingTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.listed = User.objects.create_user(
            email="listed@test.com",
            password="password123",
            is_verified=True,
        )
        AccountantProfile.objects.create(
            user=cls.listed,
            credentials="CPA",
            bio="Helps with taxes",
            years_experience=5,
        )
        cls.client_user = User.objects.create_user(
            email="later-pro@test.com",
            password="password123",
            is_verified=True,
        )

    def setUp(self):
        self.client = APIClient()

    def test_directory_is_public(self):
        url = reverse("accountant-directory")
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["user_id"], self.listed.id)
        self.assertEqual(resp.data[0]["email"], "listed@test.com")

    def test_create_profile_requires_auth(self):
        url = reverse("create_accountant")
        resp = self.client.post(
            url,
            {"bio": "Bio", "credentials": "CPA", "years_experience": 2},
            format="json",
        )
        self.assertEqual(resp.status_code, 401)
        self.assertFalse(AccountantProfile.objects.filter(user=self.client_user).exists())

    def test_user_can_become_accountant_without_new_account(self):
        self.client.force_authenticate(user=self.client_user)
        url = reverse("create_accountant")
        resp = self.client.post(
            url,
            {
                "bio": "I prepare individual returns.",
                "credentials": "EA",
                "years_experience": 4,
                "user": self.listed.id,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        profile = AccountantProfile.objects.get(user=self.client_user)
        self.assertEqual(profile.credentials, "EA")
        self.assertEqual(profile.user_id, self.client_user.id)

    def test_new_accountant_can_access_accountant_dashboard(self):
        self.client.force_authenticate(user=self.client_user)
        self.client.post(
            reverse("create_accountant"),
            {
                "bio": "I prepare individual returns.",
                "credentials": "EA",
                "years_experience": 4,
            },
            format="json",
        )
        resp = self.client.get(reverse("accountant-dashboard"))
        self.assertEqual(resp.status_code, 200)

    def test_existing_profile_can_be_completed(self):
        empty = User.objects.create_user(
            email="empty-pro@test.com",
            password="password123",
            is_verified=True,
        )
        AccountantProfile.objects.create(user=empty, credentials="", bio="")
        self.client.force_authenticate(user=empty)
        resp = self.client.post(
            reverse("create_accountant"),
            {
                "bio": "Now complete.",
                "credentials": "CPA",
                "years_experience": 6,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        empty.accountant_profile.refresh_from_db()
        self.assertEqual(empty.accountant_profile.bio, "Now complete.")
        self.assertEqual(empty.accountant_profile.credentials, "CPA")

    def test_create_profile_requires_bio_and_credentials(self):
        self.client.force_authenticate(user=self.client_user)
        resp = self.client.post(
            reverse("create_accountant"),
            {"bio": "", "credentials": "CPA"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(AccountantProfile.objects.filter(user=self.client_user).exists())

    def test_own_profile_requires_auth(self):
        resp = self.client.get(reverse("my-accountant-profile"))
        self.assertEqual(resp.status_code, 401)

    def test_own_profile_404_without_profile(self):
        self.client.force_authenticate(user=self.client_user)
        resp = self.client.get(reverse("my-accountant-profile"))
        self.assertEqual(resp.status_code, 404)

    def test_onboarding_creates_profile_linked_to_authenticated_user(self):
        self.client.force_authenticate(user=self.client_user)
        resp = self.client.post(
            reverse("create_accountant"),
            {
                "first_name": "Ada",
                "last_name": "Lovelace",
                "firm_name": "Lovelace Tax",
                "location": "Remote",
                "bio": "I prepare individual returns.",
                "credentials": "EA",
                "years_experience": 4,
                "service_name": "Individual tax returns",
                "service_description": "Form 1040 preparation",
                "user": self.listed.id,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(AccountantProfile.objects.filter(user=self.client_user).count(), 1)
        self.assertEqual(AccountantProfile.objects.filter(user=self.listed).count(), 1)

        profile = AccountantProfile.objects.get(user=self.client_user)
        self.assertEqual(profile.firm_name, "Lovelace Tax")
        self.assertEqual(profile.location, "Remote")
        self.assertEqual(profile.user_id, self.client_user.id)
        self.assertTrue(profile.is_complete)

        self.client_user.refresh_from_db()
        self.assertEqual(self.client_user.first_name, "Ada")
        self.assertEqual(self.client_user.last_name, "Lovelace")
        self.assertTrue(
            Service.objects.filter(
                accountant=self.client_user,
                name="Individual tax returns",
                is_active=True,
            ).exists()
        )
        self.assertEqual(resp.data["first_name"], "Ada")
        self.assertTrue(resp.data["profile_complete"])

        me = self.client.get(reverse("users-me"))
        self.assertEqual(me.status_code, 200)
        self.assertTrue(me.data["has_accountant_profile"])
        self.assertTrue(me.data["accountant_profile_complete"])

        dashboard = self.client.get(reverse("accountant-dashboard"))
        self.assertEqual(dashboard.status_code, 200)

    def test_second_save_does_not_duplicate_profile_or_service(self):
        self.client.force_authenticate(user=self.client_user)
        payload = {
            "first_name": "Ada",
            "last_name": "Lovelace",
            "bio": "I prepare individual returns.",
            "credentials": "EA",
            "years_experience": 4,
            "service_name": "Individual tax returns",
        }
        first = self.client.post(reverse("create_accountant"), payload, format="json")
        second = self.client.post(
            reverse("create_accountant"),
            {**payload, "bio": "Updated bio.", "service_name": "Business taxes"},
            format="json",
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(AccountantProfile.objects.filter(user=self.client_user).count(), 1)
        self.assertEqual(Service.objects.filter(accountant=self.client_user).count(), 1)
        profile = AccountantProfile.objects.get(user=self.client_user)
        self.assertEqual(profile.bio, "Updated bio.")
        self.assertEqual(Service.objects.get(accountant=self.client_user).name, "Individual tax returns")

    def test_incomplete_profile_can_be_resumed_without_duplicate(self):
        empty = User.objects.create_user(
            email="resume-pro@test.com",
            password="password123",
            is_verified=True,
        )
        AccountantProfile.objects.create(user=empty, credentials="", bio="")
        self.client.force_authenticate(user=empty)
        own = self.client.get(reverse("my-accountant-profile"))
        self.assertEqual(own.status_code, 200)
        self.assertFalse(own.data["profile_complete"])

        resp = self.client.post(
            reverse("create_accountant"),
            {
                "first_name": "Casey",
                "last_name": "Taxes",
                "bio": "Now complete.",
                "credentials": "CPA",
                "years_experience": 6,
                "firm_name": "Casey CPA",
                "location": "Boston, MA",
                "service_name": "Tax planning",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(AccountantProfile.objects.filter(user=empty).count(), 1)
        empty.accountant_profile.refresh_from_db()
        self.assertEqual(empty.accountant_profile.bio, "Now complete.")
        self.assertEqual(empty.accountant_profile.firm_name, "Casey CPA")
        self.assertTrue(empty.accountant_profile.is_complete)
        self.assertEqual(Service.objects.filter(accountant=empty).count(), 1)

    def test_complete_profile_get_returns_existing_without_creating_another(self):
        self.client.force_authenticate(user=self.listed)
        before = AccountantProfile.objects.count()
        resp = self.client.get(reverse("my-accountant-profile"))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["user_id"], self.listed.id)
        self.assertEqual(AccountantProfile.objects.count(), before)

