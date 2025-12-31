from django.urls import path 
from . import views

urlpatterns = [
    path("", views.CreateAccountantProfile.as_view()),
    path("create/", views.CreateAccountantProfile.as_view(),name="create_accountant"),
    path("profile-status/<int:user_id>/",views.CheckProfileStatus.as_view(),name="profile-status")
]