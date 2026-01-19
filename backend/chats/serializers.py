
from rest_framework import serializers
from .models import Conversation

class ConversationSerializer(serializers.ModelSerializer):
    other_user = serializers.SerializerMethodField()
    
    class Meta:
        model = Conversation
        fields = ["id","other_user","created_at","updated_at"]

    def get_other_user(self,obj):
        request_user = self.context["request"].user
        inquiry = obj.inquiry 

        if inquiry.client == request_user:
            return inquiry.accountant.email
        else:
            return inquiry.client.email



