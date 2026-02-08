from django.urls import path
from .views import CreateInquiryView

urlpatterns = [
    path("create/", CreateInquiryView.as_view(), name="inquiry-create"),
]
