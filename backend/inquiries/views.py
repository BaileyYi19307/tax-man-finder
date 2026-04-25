from rest_framework.views import APIView
from services.models import Service
from inquiries.models import Inquiry,ConversationReadState
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from chats.models import Message
from django.db.models import Q
from django.utils import timezone

from .serializers import InquiryCreateSerializer, InquirySerializer
from chats.serializers import MessageSerializer, MessageCreateSerializer
from django.db import IntegrityError,transaction


#get all the inquiries
class ListCreateInquiriesView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        #want to get all of a users inquiries 
        #so backend should read request.user 
        #return all the inquiries where the client is the user? 
        inquiries = Inquiry.objects.filter(Q(client = request.user) | Q(accountant=request.user)).select_related("accountant","service").order_by("-created_at")
        
        #instantiate the serializer
        serializer = InquirySerializer(inquiries, many=True)        
        return Response(serializer.data,status=status.HTTP_200_OK)


    def post(self, request):
        #request contains service id 
        
        
        inquiry_serializer = InquiryCreateSerializer(data=request.data)
        inquiry_serializer.is_valid(raise_exception=True)

        #here, we check if the inquiry already exists

        service = get_object_or_404(Service, id=inquiry_serializer.validated_data["service_id"])
        
        #I need to check request user an service
        #check to see if an inquiry with this service id and this user already exists, if yes, return the id 
     

            #now we make an inquiry abut it 
        try:
            with transaction.atomic():
                inquiry = Inquiry.objects.create(
                    client=request.user,
                    accountant = service.accountant,
                    service = service
                )
                created=True
            
        except IntegrityError:
            inquiry = Inquiry.objects.get(
                client=request.user,
                service=service
            )
            created=False
        return Response(
            {"inquiry_id":inquiry.id},
            status = status.HTTP_200_OK if not created else status.HTTP_201_CREATED
            
        )

class ReadSpecificInquiryView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self,request,inquiry_id):
        #only allow users who participate in the inquiry to access it 
        inquiry_queryset = Inquiry.objects.select_related("accountant","service").filter(Q(client=request.user)|Q(accountant=request.user))
        
        inquiry= get_object_or_404(inquiry_queryset,id=inquiry_id)
        
        inquiry_serializer = InquirySerializer(inquiry)
        
        convo_read_state = ConversationReadState.objects.filter(inquiry=inquiry,user=request.user).first()
    
        
        messages = (
            Message.objects.select_related("sender")
            .filter(inquiry=inquiry)
            .order_by("created_at")
        )
        
        other_party_messages = (
            Message.objects.select_related("sender")
            .filter(inquiry=inquiry)
            .exclude(sender=request.user)
        )
        
        latest_other_party_message = other_party_messages.order_by("-created_at").first()
        
        if latest_other_party_message is None:
            unread = False
        elif convo_read_state is None:
            unread = True
        else:
            unread = latest_other_party_message.created_at > convo_read_state.last_read_at
        
        
        message_serializer = MessageSerializer(messages, many=True)

        return Response(
            {
                "inquiry": inquiry_serializer.data,
                "messages": message_serializer.data,
                "unread": unread
            },
            status=status.HTTP_200_OK
        )
        

class SendMessageView(APIView): # user passes in content, backend fills out 
    permission_classes = [IsAuthenticated]
    
    def post(self,request, inquiry_id):
        #we get the user who made the requesst to post the message
        sender = request.user 

        #we want the inquiry where either the user is the client or the accountant, and from those, get the inquiry with it's id 
        #only give me this inquiry if the current user is part of it 
        inquiry= get_object_or_404(Inquiry,Q(client=sender)|Q(accountant=sender),id=inquiry_id)
        
        message_serializer = MessageCreateSerializer(data= request.data)
        message_serializer.is_valid(raise_exception=True)
                                    
        #make the message
        message = Message.objects.create(sender = sender, content = message_serializer.validated_data["content"], inquiry = inquiry)
        
        return Response(
            {"message_id":message.id},
            status = status.HTTP_201_CREATED
        )


class MarkReadView(APIView):
    permission_classes=[IsAuthenticated]
    
    def post(self, request, inquiry_id):
        #grab the conversation read state
        inquiry= get_object_or_404(Inquiry,Q(client=request.user)|Q(accountant=request.user),id=inquiry_id)
        conversation_read_state = ConversationReadState.objects.filter(user=request.user, inquiry=inquiry).first()
        
        if conversation_read_state:
            conversation_read_state.last_read_at = timezone.now()
            conversation_read_state.save()
        else:
            conversation_read_state= ConversationReadState.objects.create(
                inquiry=inquiry,
                user = request.user,
                last_read_at = timezone.now()
            )
        
            
        return Response({
            "status": "marked_read",
            "inquiry_id": inquiry.id,
            "last_read_at": conversation_read_state.last_read_at})        
        

