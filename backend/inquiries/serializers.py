# inquiries/serializers.py
from rest_framework import serializers

class InquiryCreateSerializer(serializers.Serializer):
    service_id = serializers.IntegerField()
