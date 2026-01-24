# chat/views.py
from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .serializers import ConversationSerializer, MessageSerializer, MessageCreateSerializer
from .models import Conversation, Message
from .permissions import IsConversationParticipant
from django.db.models import Q
from django.shortcuts import get_object_or_404



# REST API is read-only for messages:
#     GET /api/conversations/
#     GET /api/conversations/<id>/messages/

class ConversationView(APIView):
    permission_classes=[IsAuthenticated]

    def get(self, request):
        #filter the conversations that the user participates in
        #identify user
        #fetch conversation objects the user is part of 
        conversations=Conversation.objects.filter(Q(inquiry__client = request.user)|Q(inquiry__accountant=request.user)).order_by("-updated_at")
        serializer = ConversationSerializer(conversations, many=True, context={'request': request})

        return Response(serializer.data,status=status.HTTP_200_OK)

    
class MessageListView(APIView):
    permission_classes = [IsAuthenticated, IsConversationParticipant]
    http_method_names = ["get"]

    def get(self, request, conversation_id):
        conversation = get_object_or_404(Conversation, id=conversation_id)

        # object-level permission check
        self.check_object_permissions(request, conversation)

        messages = (
            Message.objects
            .filter(conversation_id=conversation_id)
            .order_by("created_at")
        )

        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
