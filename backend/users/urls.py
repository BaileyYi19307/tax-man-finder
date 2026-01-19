from django.urls import path

from . import views

urlpatterns = [
    path("", views.SignUp.as_view()),
    path("/auth/signup/", views.SignUp.as_view(),name="signup"),
    path("/auth/login/", views.Login.as_view(), name="login" ),
    path("/me/", views.MeView.as_view(), name="users-me"),
]