from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.test import TestCase

from accountants.models import AccountantProfile
from services.models import Service
from users.models import User


class ConsultationFeeServiceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.list_url = reverse("service-list")
        cls.accountant = User.objects.create_user(
            email="fee.acct@example.com",
            password="testpassword",
            is_accountant=True,
            is_verified=True,
        )
        AccountantProfile.objects.create(user=cls.accountant)

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(user=self.accountant)

    def test_free_service_can_be_created(self):
        response = self.api.post(
            self.list_url,
            {
                "name": "Intro call",
                "description": "Free intro",
                "pricing_type": Service.PricingType.CONSULTATION_REQUIRED,
                "consultation_is_paid": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        service = Service.objects.get()
        self.assertEqual(service.consultation_fee, Decimal("0.00"))
        self.assertEqual(response.data["consultation_fee"], "0.00")

    def test_paid_service_can_be_created_with_valid_fee(self):
        response = self.api.post(
            self.list_url,
            {
                "name": "Strategy call",
                "description": "Paid consult",
                "pricing_type": Service.PricingType.CONSULTATION_REQUIRED,
                "consultation_is_paid": True,
                "consultation_fee": "50.00",
                "cancellation_policy": "Cancel 24h ahead for a refund.",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        service = Service.objects.get()
        self.assertEqual(service.consultation_fee, Decimal("50.00"))
        self.assertEqual(service.cancellation_policy, "Cancel 24h ahead for a refund.")
        self.assertEqual(response.data["consultation_fee"], "50.00")

    def test_paid_service_without_valid_fee_is_rejected(self):
        response = self.api.post(
            self.list_url,
            {
                "name": "Strategy call",
                "description": "Paid consult",
                "pricing_type": Service.PricingType.CONSULTATION_REQUIRED,
                "consultation_is_paid": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Service.objects.count(), 0)

        zero = self.api.post(
            self.list_url,
            {
                "name": "Strategy call",
                "description": "Paid consult",
                "pricing_type": Service.PricingType.CONSULTATION_REQUIRED,
                "consultation_is_paid": True,
                "consultation_fee": "0.00",
            },
            format="json",
        )
        self.assertEqual(zero.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Service.objects.count(), 0)

    def test_negative_consultation_fee_rejected(self):
        response = self.api.post(
            self.list_url,
            {
                "name": "Bad fee",
                "description": "Invalid",
                "pricing_type": Service.PricingType.CONSULTATION_REQUIRED,
                "consultation_fee": "-10.00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Service.objects.count(), 0)

    def test_service_fee_can_be_edited_and_returned(self):
        created = self.api.post(
            self.list_url,
            {
                "name": "Books",
                "description": "Monthly books",
                "pricing_type": Service.PricingType.HOURLY,
                "indicative_price": "175.00",
                "consultation_is_paid": True,
                "consultation_fee": "40.00",
                "cancellation_policy": "Flexible",
            },
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        service_id = created.data["id"]

        updated = self.api.patch(
            reverse("service-detail", args=[service_id]),
            {
                "consultation_is_paid": True,
                "consultation_fee": "65.00",
                "cancellation_policy": "48h notice",
            },
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["consultation_fee"], "65.00")
        self.assertEqual(updated.data["cancellation_policy"], "48h notice")

        detail = self.api.get(reverse("service-detail", args=[service_id]))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["consultation_fee"], "65.00")

        free = self.api.patch(
            reverse("service-detail", args=[service_id]),
            {"consultation_is_paid": False},
            format="json",
        )
        self.assertEqual(free.status_code, status.HTTP_200_OK)
        self.assertEqual(free.data["consultation_fee"], "0.00")
        self.assertEqual(Service.objects.get(pk=service_id).consultation_fee, Decimal("0.00"))
