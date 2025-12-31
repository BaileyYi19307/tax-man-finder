from django.test import TestCase
from rest_framework.test import APIClient
from accountants.models import AccountantProfile
from django.urls import reverse
from .models import User

#test an accountant profile is created when a user signs up as an accountant
#i.e. a request is sent with data that includes is_accountant = true 
class AccountantProfileTest(TestCase):
    def setUp(self):
        #create a user
        self.client=APIClient()
            
    def test_accountant_profile_exists_when_user_signsup_as_accountant(self):
        #check to see an accountant profile exists with a specific id
        #create data
        data = {"email": "bailey@email.com", "password":"test", "is_accountant":True}
        url = reverse("signup")
        response = self.client.post(url,data,format="json")
        print(response.data)

        self.assertEqual(response.status_code, 201)
        self.assertTrue(AccountantProfile.objects.filter(pk=response.data['id']).exists())

    def test_accountant_profile_doesnt_exist_when_user_signs_up_regular(self):
        data = {"email": "bailey@email.com", "password":"test", "is_accountant":False}
        url = reverse("signup")
        response = self.client.post(url,data,format="json")
        print(response.data)

        self.assertEqual(response.status_code, 201)
        self.assertFalse(AccountantProfile.objects.filter(pk=response.data['id']).exists())



