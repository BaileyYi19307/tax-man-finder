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
