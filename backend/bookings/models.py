from django.db import models
from users.models import User
from django.utils.translation import gettext_lazy as _


class BookingStatusOptions(models.IntegerChoices):
    COMPLETE=1,_("Complete")
    UPCOMING = 3,_("Upcoming")
    PENDING = 2,_("Pending")
    CANCELLED = 0,_("Cancelled")

#create your models here.
class Booking(models.Model):
    name = models.CharField(max_length=255)
    date = models.DateTimeField()
    accountant = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="bookings_as_accountant"
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="bookings_as_client"
    )
    status = models.IntegerField(
        default = BookingStatusOptions.PENDING,
        choices = BookingStatusOptions.choices,
    )
    
    def __str__(self):
        return f"{self.name} between accountant: {self.accountant.username} and user:{self.user.username}"



