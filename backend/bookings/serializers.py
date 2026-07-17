
from rest_framework import serializers
from .models import Booking


#create serializer for booking creation 
class BookingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking 
        fields=["name","date","service"] # client writable fields 


#takes booking model instance, turns into jSON
class BookingSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(
        source="get_status_display",
        read_only=True
    )
    
    accountant_email = serializers.CharField(
        source = "accountant.email",
        read_only=True
    )

    class Meta:
        model = Booking
        fields = ["id","name","date","accountant","accountant_email","user","status","status_label","service"]
        read_only_fields = ["status", "status_label","user","accountant"]
