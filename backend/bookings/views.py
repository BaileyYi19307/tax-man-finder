from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .serializers import BookingSerializer, BookingCreateSerializer
from rest_framework.permissions import IsAuthenticated
from .models import Booking

class BookingCreation(APIView):
    permission_classes = [IsAuthenticated] # user must authenticated 

    def post(self, request):
        # do I ge tthe accountant here or in serializer
        serializer = BookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        service = serializer.validated_data["service"]

        booking = serializer.save(user=request.user, accountant = service.accountant)


        return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)
    
    
class MyBookingsView(APIView):
    
    def get(self,request):
        #filter by request.user
        #return many = True 
        user = request.user
        bookings = Booking.objects.filter(user=user)
        serializer = BookingSerializer(bookings,many=True)
        return Response(serializer.data)



from rest_framework import viewsets

class BookingsViewSet(viewsets.ModelViewSet):
    """
    Viewset for managing bookings 
    """
    permission_classes = [IsAuthenticated]
    
    #only return bookings belonging to the logged-in user
    def get_queryset(self):
        return Booking.objects.filter(user=self.request.user)
    
    def get_serializer_class(self):
        #use create serializer when making bookign 
        #use regular rserializer for listing/viewing/updating 
        if self.action == "create":
            return BookingCreateSerializer
        return BookingSerializer
    
    def perform_create(self,serializer):
        #when creating, attached logged in user automatically 
        serializer.save(user=self.request.user)

    