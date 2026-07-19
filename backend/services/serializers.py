
from rest_framework import serializers
from .models import Service

class ServiceSerializer(serializers.ModelSerializer):
    """Validates and creates a service """

    def validate(self,data):
        #must check to see if the pricing type is fixed/hourly, then it requires an indicative price 
        if data.get("pricing_type",None)== Service.PricingType.FIXED or data.get('pricing_type',None) == Service.PricingType.HOURLY:
            if not data.get('indicative_price',None):
                raise serializers.ValidationError("Indicative price is required for fixed/hourly pricing")
        return data

    class Meta:
        model = Service
        fields = "__all__"
        # Set from request.user in ServicesViewSet.perform_create — not from the client body
        read_only_fields = ["accountant"]

       


