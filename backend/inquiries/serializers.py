# inquiries/serializers.py
from rest_framework import serializers
from .models import Inquiry 


class InquirySerializer(serializers.ModelSerializer):
    #how to get accountant name? 
    accountant_name = serializers.CharField(source="accountant.user.email",read_only=True)
    service_title = serializers.CharField(source="service.name", read_only=True)
    
    class Meta: 
        model=Inquiry
        fields=["id","status","created_at","accountant_name","service_title"]
        

class InquiryCreateSerializer(serializers.Serializer):
    service_id = serializers.IntegerField()
