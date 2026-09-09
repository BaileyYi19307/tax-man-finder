from rest_framework.routers import DefaultRouter
from django.urls import path

from .stripe_webhook import stripe_webhook_view
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
    path(
        "stripe/webhook/",
        stripe_webhook_view,
        name="stripe-webhook",
    ),
] + router.urls
