from django.test import TestCase
from rest_framework.test import APIClient
from django.urls import reverse
from users.models import User
from rest_framework import status
from .models import Service
from accountants.models import AccountantProfile


class ServiceCreatePermissionsTest(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.create_service_url = reverse("service-list")

        cls.accountant = User.objects.create_user(
            email="testaccountant@example.com",
            password="testpassword",
            is_accountant=True,
            is_verified=True,
        )
        AccountantProfile.objects.create(user=cls.accountant)

        cls.client_user = User.objects.create_user(
            email="testuser@example.com",
            password="testpassword",
            is_accountant=False,
            is_verified=True,
        )

        cls.service_data = {
            "name": "test service",
            "description": "this is a test service",
            "indicative_price": 200.00,
        }

    def setUp(self):
        self.client = APIClient()

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_accountant_can_create_service(self):
        self.authenticate(self.accountant)
        response = self.client.post(
            self.create_service_url, data=self.service_data, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Service.objects.count(), 1)
        service = Service.objects.get()
        self.assertEqual(service.accountant_id, self.accountant.id)
        self.assertEqual(response.data["accountant"], self.accountant.id)

    def test_accountant_cannot_assign_service_to_another_user(self):
        other = User.objects.create_user(
            email="other-acct@example.com",
            password="testpassword",
            is_verified=True,
        )
        AccountantProfile.objects.create(user=other)
        self.authenticate(self.accountant)
        response = self.client.post(
            self.create_service_url,
            data={**self.service_data, "accountant": other.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        service = Service.objects.get()
        self.assertEqual(service.accountant_id, self.accountant.id)
        self.assertNotEqual(service.accountant_id, other.id)
        self.assertEqual(response.data["accountant"], self.accountant.id)

    def test_non_accountant_cannot_create_service(self):
        self.authenticate(self.client_user)
        response = self.client.post(
            self.create_service_url, data=self.service_data, format="json"
        )
        self.assertEqual(Service.objects.count(), 0)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_user_cannot_create_service(self):
        response = self.client.post(
            self.create_service_url, data=self.service_data, format="json"
        )
        self.assertFalse(Service.objects.exists())
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ServiceMineAndOwnershipTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.accountant_a = User.objects.create_user(
            email="acct-a@example.com",
            password="testpassword",
            is_verified=True,
        )
        AccountantProfile.objects.create(user=cls.accountant_a)
        cls.accountant_b = User.objects.create_user(
            email="acct-b@example.com",
            password="testpassword",
            is_verified=True,
        )
        AccountantProfile.objects.create(user=cls.accountant_b)
        cls.client_user = User.objects.create_user(
            email="seeker@example.com",
            password="testpassword",
            is_verified=True,
        )

        cls.service_a = Service.objects.create(
            accountant=cls.accountant_a,
            name="A Returns",
            description="Owned by A",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
        )
        cls.service_b = Service.objects.create(
            accountant=cls.accountant_b,
            name="B Bookkeeping",
            description="Owned by B",
            pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
        )

        cls.mine_url = reverse("service-mine")
        cls.list_url = reverse("service-list")

    def setUp(self):
        self.client = APIClient()

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_unauthenticated_cannot_access_mine(self):
        resp = self.client.get(self.mine_url)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_accountant_cannot_access_mine(self):
        self.authenticate(self.client_user)
        resp = self.client.get(self.mine_url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_accountant_receives_only_own_services(self):
        self.authenticate(self.accountant_a)
        resp = self.client.get(self.mine_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in resp.data]
        self.assertEqual(ids, [self.service_a.id])
        self.assertNotIn(self.service_b.id, ids)

    def test_other_accountant_services_are_excluded_from_mine(self):
        self.authenticate(self.accountant_b)
        resp = self.client.get(self.mine_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in resp.data]
        self.assertEqual(ids, [self.service_b.id])
        self.assertNotIn(self.service_a.id, ids)

    def test_public_catalog_still_returns_all_services(self):
        resp = self.client.get(self.list_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = {row["id"] for row in resp.data}
        self.assertEqual(ids, {self.service_a.id, self.service_b.id})

    def test_accountant_can_update_own_service(self):
        self.authenticate(self.accountant_a)
        url = reverse("service-detail", args=[self.service_a.id])
        resp = self.client.patch(url, {"name": "Updated A Returns"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.service_a.refresh_from_db()
        self.assertEqual(self.service_a.name, "Updated A Returns")

    def test_accountant_cannot_update_another_accountants_service(self):
        self.authenticate(self.accountant_b)
        url = reverse("service-detail", args=[self.service_a.id])
        resp = self.client.patch(url, {"name": "Hijacked"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.service_a.refresh_from_db()
        self.assertEqual(self.service_a.name, "A Returns")

    def test_accountant_cannot_put_another_accountants_service(self):
        self.authenticate(self.accountant_b)
        url = reverse("service-detail", args=[self.service_a.id])
        resp = self.client.put(
            url,
            {
                "name": "Hijacked",
                "description": "Stolen",
                "pricing_type": Service.PricingType.CONSULTATION_REQUIRED,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_accountant_can_delete_own_service(self):
        self.authenticate(self.accountant_a)
        url = reverse("service-detail", args=[self.service_a.id])
        resp = self.client.delete(url)
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Service.objects.filter(pk=self.service_a.id).exists())

    def test_accountant_cannot_delete_another_accountants_service(self):
        self.authenticate(self.accountant_b)
        url = reverse("service-detail", args=[self.service_a.id])
        resp = self.client.delete(url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Service.objects.filter(pk=self.service_a.id).exists())
