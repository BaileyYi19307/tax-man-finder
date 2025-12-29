
from rest_framework import serializers
from .models import AccountantProfile

class AccountantProfileSerializer(serializers.ModelSerializer):
    """Validates and creates an Accountant Profile"""

    class Meta:
        model=AccountantProfile
        fields='__all__'
        #what fields should be included in the output


