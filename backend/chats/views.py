# chat/views.py
from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .serializers import ConversationSerializer, MessageSerializer
from .models import Conversation, Message
from .permissions import IsConversationParticipant
from django.db.models import Q
from django.shortcuts import get_object_or_404


def index(request):
    return render(request, "chats/index.html")


def room(request, room_name):
    return render(request, "chats/room.html", {"room_name": room_name})


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

    def get(self, request, conversation_id):
        conversation = get_object_or_404(Conversation, id=conversation_id)

        # object-level permission check
        self.check_object_permissions(request, conversation)

        messages = (
            Message.objects
            .filter(conversation=conversation)
            .order_by("created_at")
        )

        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

