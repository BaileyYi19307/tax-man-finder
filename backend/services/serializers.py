
from rest_framework import serializers
from .models import Service

class ServiceSerializer(serializers.ModelSerializer):
    """Validates and creates a service """

    class Meta:
        model=Service
        fields='__all__'
        #what fields should be included in the output


