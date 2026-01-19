# chat/views.py
from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .serializers import ConversationSerializer
from .models import Conversation
from django.db.models import Q


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



    

