
from rest_framework import serializers
from .models import Conversation, Message

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

    def get_last_message(self, obj):
            last = (
                Message.objects
                .filter(conversation=obj)
                .order_by("-created_at")
                .first()
            )
            return last.body if last else ""

class MessageSerializer(serializers.ModelSerializer):
    sender_email = serializers.EmailField(source="sender.email", read_only=True)

    class Meta:
        model = Message
        fields = ["id", "sender_id","sender_email", "body", "created_at"]



class MessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["id", "body", "created_at"]
        read_only_fields = ["id", "created_at"]