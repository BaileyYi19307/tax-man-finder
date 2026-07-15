
from rest_framework import serializers
from .models import Service

class ServiceSerializer(serializers.ModelSerializer):
    """Validates and creates a service """

    class Meta:
        model = Service
        fields = "__all__"
        # Set from request.user in ServicesViewSet.perform_create — not from the client body
        read_only_fields = ["accountant"]


