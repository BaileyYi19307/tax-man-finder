
from rest_framework import serializers
from .models import AccountantProfile
from services.models import Service

class AccountantProfileSerializer(serializers.ModelSerializer):
    """Validates and creates an Accountant Profile"""

    class Meta:
        model=AccountantProfile
        fields='__all__'
        #what fields should be included in the output

class AccountantProfileStatusSerializer(serializers.Serializer):
    profile_info_complete = serializers.BooleanField()
    services_exist = serializers.BooleanField()
    profile_complete = serializers.BooleanField()





