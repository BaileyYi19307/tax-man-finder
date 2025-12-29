from django.urls import path 
from . import views

urlpatterns = [
    path("", views.CreateAccountantProfile.as_view()),
    path("create/", views.CreateAccountantProfile.as_view(),name="create_accountant"),
]