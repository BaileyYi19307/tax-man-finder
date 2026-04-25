from django.urls import path
from .views import ListCreateInquiriesView
from .views import ReadSpecificInquiryView
from .views import SendMessageView, MarkReadView


urlpatterns = [
    path("", ListCreateInquiriesView.as_view(), name="list-create-inquiries"),
    path("<int:inquiry_id>/", ReadSpecificInquiryView.as_view(),name="read-specific-inquiry"),
    path("<int:inquiry_id>/messages/", SendMessageView.as_view(), name="send-message"),
    path("<int:inquiry_id>/mark-read/",MarkReadView.as_view(),name="mark-specific-inquiry-read" )
]
