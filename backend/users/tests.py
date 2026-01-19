from django.test import TestCase
from rest_framework.test import APIClient
from accountants.models import AccountantProfile
from django.urls import reverse
from .models import User



class LoginTest(TestCase):
    def setUp(self):
        #create a user
        self.client=APIClient()
        self.password = "testpassword123"
        self.user = User.objects.create_user(
            email="bailey@email.com",
            password=self.password,
            is_verified=True,
        )


    def test_login_success(self):
        url = reverse("login")
        data = {
            "email": "bailey@email.com",
            "password": self.password,
        }

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertIn("tokens", response.data)
        self.assertIn("access", response.data["tokens"])
        self.assertIn("refresh", response.data["tokens"])


    def test_login_wrong_password(self):
        url = reverse("login")
        data = {
            "email": "bailey@email.com",
            "password": "wrong password",
        }
        response = self.client.post(url,data,format="json")
        self.assertEqual(response.status_code, 400)
        

    def test_login_unknown_email(self):
        url = reverse("login")
        data = {
            "email": "unknown@email.com",
            "password": "testpassword123",
        }

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, 400)

    def test_access_token_allows_authenticated_request(self):
        #login first 
        login_url = reverse("login")
        response = self.client.post(
            login_url,
            {
                "email": "bailey@email.com",
                "password": self.password,
            },
            format="json",
        )

        access_token = response.data["tokens"]["access"]

        #attach token 
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {access_token}"
        )

        me_url = reverse("users-me")
        #hit protected endpoint
        response = self.client.get(me_url)


        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["email"], "bailey@email.com")
      

# #test an accountant profile is created when a user signs up as an accountant
# #i.e. a request is sent with data that includes is_accountant = true 
# class AccountantProfileTest(TestCase):
#     def setUp(self):
#         #create a user
#         self.client=APIClient()
            
#     def test_accountant_profile_exists_when_user_signsup_as_accountant(self):
#         #check to see an accountant profile exists with a specific id
#         #create data
#         data = {"email": "bailey@email.com", "password":"test", "is_accountant":True}
#         url = reverse("signup")
#         response = self.client.post(url,data,format="json")
#         print(response.data)

#         self.assertEqual(response.status_code, 201)
#         self.assertTrue(AccountantProfile.objects.filter(pk=response.data['id']).exists())

#     def test_accountant_profile_doesnt_exist_when_user_signs_up_regular(self):
#         data = {"email": "bailey@email.com", "password":"test", "is_accountant":False}
#         url = reverse("signup")
#         response = self.client.post(url,data,format="json")
#         print(response.data)

#         self.assertEqual(response.status_code, 201)
#         self.assertFalse(AccountantProfile.objects.filter(pk=response.data['id']).exists())



