from django.urls import path

from . import views

urlpatterns = [
    path("", views.user_list),
    path("signup/", views.SignUp.as_view(),name="signup"),

]