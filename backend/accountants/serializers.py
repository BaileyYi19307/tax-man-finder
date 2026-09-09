from rest_framework import serializers
from .models import AccountantProfile


class AccountantProfileSerializer(serializers.ModelSerializer):
    """Validates and creates an Accountant Profile"""

    class Meta:
        model = AccountantProfile
        fields = "__all__"
        read_only_fields = [
            "user",
            "profile_complete",
            "publication_status",
            "latitude",
            "longitude",
            "created_at",
            "updated_at",
        ]


class AccountantProfileStatusSerializer(serializers.Serializer):
    profile_info_complete = serializers.BooleanField()
    services_exist = serializers.BooleanField()
    profile_complete = serializers.BooleanField()
    publication_status = serializers.CharField()
    is_publish_ready = serializers.BooleanField()
    is_public = serializers.BooleanField()
