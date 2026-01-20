from django.test import TestCase
from users.models import User
from django.utils import timezone
from django.urls import reverse
from rest_framework.test import APIClient
from .models import Booking,BookingStatusOptions


# Create your tests here.
class BookingTests(TestCase):

    def setUp(self):
        #set up
        self.client = APIClient()

    def test_create_booking_success(self):
        """Test to see if a booking is successfully created"""

        # creating a client user
        client_user = User.objects.create_user(
            email="client1@test.com",
            password="password123",
            is_accountant=False,
        )

        # creating an accountant user
        accountant_user = User.objects.create_user(
            email="acct1@test.com",
            password="password123",
            is_accountant=True,
        )

        url = reverse("create_booking")

        payload = {
            "name": "Tax consultation",
            "date": (timezone.now() + timezone.timedelta(days=1)).isoformat(),
            "accountant": accountant_user.id,
            "user": client_user.id,
        }

        response = self.client.post(url,payload,format="json")

        #check to see the booking is created
        self.assertEqual(response.status_code,201)

        # verify booking exists in DB
        self.assertTrue(Booking.objects.filter(
            accountant=accountant_user,
            user=client_user,
            name="Tax consultation",
            ).exists()
        )

        #check to see that the status at default is pending 
        booking = Booking.objects.get(accountant=accountant_user, user=client_user, name="Tax consultation")
        self.assertEqual(booking.status, BookingStatusOptions.PENDING)



    def test_create_booking_requires_auth(self):
        """Check to see that only logged-in uers should be allowed to create a booking"""
        pass

    def test_create_booking_rejects_double_booking(self):
        """
            Does not allow two users to book the same accountant at the same time 
        """

        #if a booking has already been created, then want to make sure that accountant can't be double booked during that time?

        
        pass
