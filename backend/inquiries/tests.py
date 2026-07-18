from django.test import TestCase

from users.models import User
from services.models import Service
from inquiries.models import Inquiry
from .serializers import InquirySerializer


class InquirySerializerTest(TestCase):
    def test_accountant_name_is_accountant_email(self):
        client = User.objects.create_user(
            email="client@test.com",
            password="password123",
            is_accountant=False,
        )
        accountant = User.objects.create_user(
            email="acct@test.com",
            password="password123",
            is_accountant=True,
        )
        service = Service.objects.create(
            accountant=accountant,
            name="Tax Filing",
            description="File taxes",
            price=100,
        )
        inquiry = Inquiry.objects.create(
            client=client,
            accountant=accountant,
            service=service,
        )

        data = InquirySerializer(inquiry).data

        self.assertEqual(data["accountant_name"], "acct@test.com")
        self.assertEqual(data["service_title"], "Tax Filing")
