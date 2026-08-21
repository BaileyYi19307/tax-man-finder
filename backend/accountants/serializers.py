
from rest_framework import serializers
from .models import AccountantProfile
from services.models import Service

class AccountantProfileSerializer(serializers.ModelSerializer):
    """Validates and creates an Accountant Profile"""

    class Meta:
        model = AccountantProfile
        fields = "__all__"
        read_only_fields = [
            "user",
            "profile_complete",
            "latitude",
            "longitude",
            "created_at",
            "updated_at",
        ]

class AccountantProfileStatusSerializer(serializers.Serializer):
    profile_info_complete = serializers.BooleanField()
    services_exist = serializers.BooleanField()
    profile_complete = serializers.BooleanField()





