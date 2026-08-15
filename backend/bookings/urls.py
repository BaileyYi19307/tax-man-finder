from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import BookingsViewSet, InquiryBookingsView, RequestConsultationView

router = DefaultRouter()
router.register(r"", BookingsViewSet, basename="bookings")

urlpatterns = [
    path(
        "request-consultation/",
        RequestConsultationView.as_view(),
        name="request-consultation",
    ),
    path(
        "by-inquiry/<int:inquiry_id>/",
        InquiryBookingsView.as_view(),
        name="inquiry-bookings",
    ),
] + router.urls
