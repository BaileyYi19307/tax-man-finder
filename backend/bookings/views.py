from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .serializers import BookingSerializer

class BookingCreation(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = BookingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking = serializer.save()

        return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)