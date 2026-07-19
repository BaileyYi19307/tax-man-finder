# inquiries/serializers.py
from rest_framework import serializers
from .models import Inquiry 


class InquirySerializer(serializers.ModelSerializer):
    #how to get accountant name? 
    accountant_name = serializers.CharField(source="accountant.email",read_only=True)
    service_title = serializers.SerializerMethodField()

    def get_service_title(self, obj):
        # General inquiries have no service — don't touch service.name
        if obj.service is None:
            return None
        return obj.service.name
    
    class Meta: 
        model=Inquiry
        fields=["id","status","created_at","accountant_name","service_title"]
        

class InquiryCreateSerializer(serializers.ModelSerializer):

    def validate(self,data):
        #if service is set, accountant should match service.accountant 
        if data.get("service") is not None: 
            data["accountant"]=data["service"].accountant
        else: 
            #if service is omitted, accountant is required 
            if data.get("accountant") is None:
                raise serializers.ValidationError({"accountant": "Select an accountant when no service is provided"})

        client = self.context["request"].user
        if client == data.get("accountant"):
            raise serializers.ValidationError({"accountant": "You can not start an inquiry with yourself"})
        return data
    
    class Meta:
        model=Inquiry 
        fields=["id","accountant","client","service","created_at","status"]
        read_only_fields=["id", "client","created_at","status"]
        extra_kwargs={
            "service":{"required":False},
            "accountant":{"required":False},
        }
