from django.urls import path 
from . import views

urlpatterns = [
    path("", views.CreateAccountantProfile.as_view()),
    path("create/", views.CreateAccountantProfile.as_view(), name="create_accountant"),
    path("me/", views.CreateAccountantProfile.as_view(), name="my-accountant-profile"),
    path("directory/", views.PublicAccountantDirectoryView.as_view(), name="accountant-directory"),
    path("profile-status/<int:user_id>/", views.CheckProfileStatus.as_view(), name="profile-status"),
    path("<int:user_id>/", views.PublicAccountantProfileView.as_view(), name="public-accountant-profile"),
]
