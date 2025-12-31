from django.urls import path

from . import views

urlpatterns = [
    path("", views.BookingCreation.as_view()),
    path("create/", views.BookingCreation.as_view(),name="create_booking"),
]