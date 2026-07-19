from django.test import TestCase
from users.models import User
from django.utils import timezone
from django.urls import reverse
from rest_framework.test import APIClient
from .models import Booking,BookingStatusOptions
from rest_framework import status
from services.models import Service


class BookingTests(TestCase):

    def setUp(self):
        #set up
        self.client = APIClient()

    @classmethod
    def setUpTestData(cls):
        #create a client user
        cls.client_user = User.objects.create_user(
            email="client1@test.com",
            password="password123",
            is_accountant=False,
        )
        #create an accountant user
        cls.accountant_user = User.objects.create_user(
            email="acct1@test.com",
            password="password123",
            is_accountant=True,
            is_verified=True,
        )

        cls.service = Service.objects.create(
            name="Tax consultation",
            description="Tax consultation",
            indicative_price=100.00,
            accountant=cls.accountant_user
        )

        #create booking payload
        cls.booking_payload = {
            "name": "Tax consultation",
            "date": (timezone.now() + timezone.timedelta(days=1)).isoformat(),
            "service": cls.service.id,
        }

        cls.create_booking_url= reverse("bookings-list")


    def test_create_booking_success(self):
        """Test to see if a booking is successfully created"""
        self.client.force_authenticate(user=self.client_user)
        #user tries to create a booking 

        response = self.client.post(self.create_booking_url,data = self.booking_payload,format="json")

        #check to see if booking is created
        self.assertEqual(response.status_code,status.HTTP_201_CREATED)


        # verify booking exists in DB
        self.assertTrue(Booking.objects.filter(
            accountant=self.accountant_user,
            user=self.client_user,
            name="Tax consultation",
            ).exists()
        )

        #check to see that the status at default is pending 
        booking = Booking.objects.get(accountant=self.accountant_user, user=self.client_user, name="Tax consultation")
        self.assertEqual(booking.status, BookingStatusOptions.PENDING)

        #check to see that service accountant is the same as the booking accountant
        self.assertEqual(booking.accountant,self.service.accountant)



    def test_create_booking_requires_auth(self):
        """Check to see that only logged-in uers should be allowed to create a booking"""
        response = self.client.post(self.create_booking_url,data = self.booking_payload,format="json")
        self.assertEqual(response.status_code,status.HTTP_401_UNAUTHORIZED)

