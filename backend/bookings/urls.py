from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import BookingsViewSet
from . import views

router = DefaultRouter()

#use BookingViewSet to handle URLS that start with /bookings/
router.register(r"", BookingsViewSet, basename="bookings")

urlpatterns = router.urls