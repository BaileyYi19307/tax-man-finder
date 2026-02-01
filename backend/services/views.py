from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .serializers import ServiceSerializer
from .models import Service
from rest_framework.permissions import IsAuthenticated
from users.permissions import IsAccountant

from rest_framework import viewsets

class ServicesViewSet(viewsets.ModelViewSet):
    """
    Viewset for editing services
    """
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    permission_classes = [IsAccountant] # add IsAuthenticated as well 

    def perform_create(self, serializer):
        serializer.save(accountant=self.request.user)