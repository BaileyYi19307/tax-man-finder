from django.urls import path

from . import views

urlpatterns = [
    path("", views.CreateService.as_view()),
    path("create/", views.CreateService.as_view(),name="create_service"),
]