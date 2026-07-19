from django.test import TestCase

from users.models import User
from services.models import Service
from inquiries.models import Inquiry
from .serializers import InquirySerializer
from rest_framework.test import APIClient
from django.urls import reverse
from rest_framework import status


class InquirySerializerTest(TestCase):
    @classmethod
    def setUpTestData(cls): 
        cls.accountant = User.objects.create_user(
            email="acct@test.com",
            password="password123",
            is_accountant=True,
        )

        cls.client_user = User.objects.create_user(
            email="client@test.com",
            password="password123",
            is_accountant=False,
        )


        cls.service = Service.objects.create(
            accountant=cls.accountant,
            name="Tax Filing",
            description="File taxes",
            indicative_price=100,
        )

        cls.create_inquiry_url = reverse("list-create-inquiries")
    
    def setUp(self):
        self.client = APIClient() # client for making requests
        self.client.force_authenticate(user=self.client_user)


    def test_create_inquiry_with_service_specified(self):
        response = self.client.post(self.create_inquiry_url,{
            "service":self.service.id,
        },format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Inquiry.objects.count(),1)
        
    
    #create inquiry with same things -> 200, same id 
    def test_create_existing_inquiry(self):
        existing_inquiry = self.client.post(self.create_inquiry_url,{
            "service":self.service.id,
        },format="json")

        response = self.client.post(self.create_inquiry_url,{
            "service":self.service.id,
        },format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["inquiry_id"], existing_inquiry.data["inquiry_id"])


    #create inquiry with only accountant -> 201 
    def test_create_inquiry_with_accountant(self):
        response = self.client.post(self.create_inquiry_url,{
            "accountant":self.accountant.id,
        },format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Inquiry.objects.count(),1)
        
    def test_create_self_inquiry(self):
        response = self.client.post(self.create_inquiry_url,{
            "accountant":self.client_user.id,
        },format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Inquiry.objects.count(),0)
        
    #after an inqiry status has been updated to close, creating a new open one
    def test_create_new_inquiry_after_closing_existing(self):

        existing_inquiry = self.client.post(self.create_inquiry_url,{
            "service":self.service.id,
        },format="json")

        #close the existing inquiry 
        inquiry_id = existing_inquiry.data["inquiry_id"]
        Inquiry.objects.filter(id=inquiry_id).update(status=Inquiry.StatusChoices.CLOSED)

        new_inquiry = self.client.post(self.create_inquiry_url,{
            "service":self.service.id,
        },format="json")

        self.assertEqual(new_inquiry.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Inquiry.objects.count(),2)
        
