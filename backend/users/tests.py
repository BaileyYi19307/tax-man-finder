from django.test import TestCase
from rest_framework.test import APIClient
from accountants.models import AccountantProfile
from django.urls import reverse
from .models import User



class SignupTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.signup_url = reverse("signup")

    def test_signup_success(self):
        data = {
            "email": "newuser@email.com",
            "password": "StrongPassword123!",
        }

        response = self.client.post(self.signup_url, data, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertIn("id", response.data)
        self.assertEqual(response.data["email"], data["email"])
        self.assertIn("message", response.data)

        #check to see user exists in DB
        self.assertTrue(User.objects.filter(email=data["email"]).exists())

        user = User.objects.get(email=data["email"])
        self.assertFalse(user.is_verified)

    def test_signup_duplicate_email_fails(self):
        User.objects.create_user(
            email="dupe@email.com",
            password="password123",
        )

        data = {
            "email": "dupe@email.com",
            "password": "AnotherPassword123!",
        }

        response = self.client.post(self.signup_url, data, format="json")

        self.assertEqual(response.status_code, 400)

    def test_signup_password_not_returned(self):
        data = {
            "email": "secure@email.com",
            "password": "SuperSecret123!",
        }

        response = self.client.post(self.signup_url, data, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertNotIn("password", response.data)

    def test_signup_missing_password_fails(self):
        data = {
            "email": "nopassword@email.com",
        }

        response = self.client.post(self.signup_url, data, format="json")

        self.assertEqual(response.status_code, 400)

    def test_signup_missing_email_fails(self):
        data = {
            "password": "NoEmail123!",
        }

        response = self.client.post(self.signup_url, data, format="json")

        self.assertEqual(response.status_code, 400)

    def test_signup_user_cannot_login_until_verified(self):
        data = {
            "email": "unverified@email.com",
            "password": "TestPassword123!",
        }

        signup_response = self.client.post(self.signup_url, data, format="json")
        self.assertEqual(signup_response.status_code, 201)

        login_url = reverse("login")
        login_response = self.client.post(
            login_url,
            {
                "email": data["email"],
                "password": data["password"],
            },
            format="json",
        )

        self.assertEqual(login_response.status_code, 400)


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



