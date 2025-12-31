
from rest_framework import serializers
from .models import Booking

class BookingSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(
        source="get_status_display",
        read_only=True
    )

    class Meta:
        model = Booking
        fields = ["id","name","date","accountant","user","status","status_label"]
        read_only_fields = ["status", "status_label"]


    def validate_accountant(self, value):
        if not value.is_accountant:
            raise serializers.ValidationError("Selected user is not an accountant")
        return value

    def create(self, validated_data):
        return Booking.objects.create(**validated_data)

