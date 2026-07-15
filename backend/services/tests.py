from django.test import TestCase
from rest_framework.test import APIClient
from django.urls import reverse
from users.models import User
from rest_framework import status
from .models import Service

class ServiceCreatePermissionsTest(TestCase):

    @classmethod
    def setUpTestData(cls):
        #set up data for whole test case
        cls.create_service_url = reverse('service-list')

        #create an accountant
        cls.accountant = User.objects.create_user(email='testaccountant@example.com', password='testpassword', is_accountant=True,is_verified=True)

        #create a client 
        cls.client_user = User.objects.create_user(email='testuser@example.com', password='testpassword', is_accountant=False,is_verified=True)

        cls.service_data = {
                "name": "test service",
                "description": "this is a test service",
                "price": 200.00,
        }

    def setUp(self):
        self.client = APIClient() # client for making requests

    def authenticate(self,user):
        #for every request from this test client, act as if the user has already been authenticated
        self.client.force_authenticate(user=user)

    # test that an accountant can create a service
    def test_accountant_can_create_service(self):
        #use the accountant, try and create a service 
        self.authenticate(self.accountant)
        #add the accountant to the service data
        response = self.client.post(self.create_service_url, data=self.service_data, format='json') 
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Service.objects.count(),1)

    # test that a non-accountant cannot create a service
    def test_non_accountant_cannot_create_service(self):
        self.authenticate(self.client_user)
        response = self.client.post(self.create_service_url, data=self.service_data, format='json')
        self.assertEqual(Service.objects.count(),0)
        self.assertEqual(response.status_code,status.HTTP_403_FORBIDDEN)

    # test that an unathenticated user cannot create a service
    def test_unauthenticated_user_cannot_create_service(self):
        response = self.client.post(self.create_service_url, data=self.service_data, format='json')
        self.assertFalse(Service.objects.exists())
        self.assertEqual(response.status_code,status.HTTP_401_UNAUTHORIZED)
        






