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
from chats.serializers import (
    AttachmentSerializer,
    MessageSerializer,
)
from chats.message_rules import MessageSendDenied
from chats.attachment_service import (
    collect_upload_files,
    create_attachments,
    create_message_with_attachments,
    get_participant_inquiry,
    validate_upload_files,
)
from chats.models import Attachment
from django.db import IntegrityError, transaction
from django.http import FileResponse
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser


#get all the inquiries
class ListCreateInquiriesView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        #want to get all of a users inquiries 
        #so backend should read request.user 
        #return all the inquiries where the client is the user? 
        inquiries = Inquiry.objects.filter(
            Q(client=request.user) | Q(accountant=request.user)
        ).select_related("accountant", "client").order_by("-created_at")
    
        result=[]
        
        for inquiry in inquiries: 
            inquiry_data = InquirySerializer(inquiry).data
            
            convo_read_state = ConversationReadState.objects.filter(inquiry=inquiry,user=request.user).first()

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
                
            inquiry_data["unread"] = unread

            result.append(inquiry_data)
            
               
        return Response(result,status=status.HTTP_200_OK)


    def post(self, request):        
        #validate payload
        inquiry_serializer = InquiryCreateSerializer(data=request.data,context={"request":request})
        inquiry_serializer.is_valid(raise_exception=True)

        valid_data = inquiry_serializer.validated_data
        content = valid_data["content"]

        # One open Inquiry per client/accountant pair (service does not partition).
        existing = Inquiry.objects.filter(
            status=Inquiry.StatusChoices.OPEN,
            client=request.user,
            accountant=valid_data["accountant"],
        ).first()

        if existing is not None:
            Message.objects.create(
                inquiry=existing,
                sender=request.user,
                content=content,
            )
            return Response({"inquiry_id": existing.id}, status=status.HTTP_200_OK)

        # Create inquiry + first message together (all or nothing).
        with transaction.atomic():
            inquiry = inquiry_serializer.save(client=request.user)
            Message.objects.create(
                inquiry=inquiry,
                sender=request.user,
                content=content,
            )
        return Response({"inquiry_id": inquiry.id}, status=status.HTTP_201_CREATED)


class ReadSpecificInquiryView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self,request,inquiry_id):
        #only allow users who participate in the inquiry to access it 
        inquiry_queryset = Inquiry.objects.select_related(
            "accountant", "client"
        ).filter(Q(client=request.user) | Q(accountant=request.user))
        
        inquiry= get_object_or_404(inquiry_queryset,id=inquiry_id)
        
        inquiry_serializer = InquirySerializer(inquiry)
        
        convo_read_state = ConversationReadState.objects.filter(inquiry=inquiry,user=request.user).first()
    
        
        messages = (
            Message.objects.select_related("sender")
            .prefetch_related("attachments", "attachments__uploaded_by")
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
        

class SendMessageView(APIView):
    """Send a chat message: JSON text-only, or multipart text and/or files."""

    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request, inquiry_id):
        sender = request.user
        inquiry = get_participant_inquiry(sender, inquiry_id)
        files = collect_upload_files(request)
        content = request.data.get("content", "")
        if content is None:
            content = ""

        try:
            message = create_message_with_attachments(
                inquiry=inquiry,
                sender=sender,
                content=content,
                files=files,
            )
        except MessageSendDenied as exc:
            if exc.code == "closed":
                return Response(
                    {"detail": exc.detail},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if exc.code == "blank":
                return Response(
                    {"detail": exc.detail},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                {"detail": exc.detail},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message_id": message.id,
                "message": MessageSerializer(message).data,
            },
            status=status.HTTP_201_CREATED,
        )


class InquiryAttachmentListCreateView(APIView):
    """List Inquiry attachments; upload without a Message (Shared Files library)."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, inquiry_id):
        inquiry = get_participant_inquiry(request.user, inquiry_id)
        attachments = (
            Attachment.objects.filter(inquiry=inquiry)
            .select_related("uploaded_by")
            .order_by("uploaded_at", "id")
        )
        return Response(
            AttachmentSerializer(attachments, many=True).data,
            status=status.HTTP_200_OK,
        )

    def post(self, request, inquiry_id):
        inquiry = get_participant_inquiry(request.user, inquiry_id)
        if inquiry.status == Inquiry.StatusChoices.CLOSED:
            return Response(
                {"detail": "Cannot upload files to a closed inquiry."},
                status=status.HTTP_403_FORBIDDEN,
            )
        files = validate_upload_files(collect_upload_files(request))
        created = create_attachments(
            inquiry=inquiry,
            uploaded_by=request.user,
            files=files,
            message=None,
        )
        return Response(
            AttachmentSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )


class InquiryAttachmentDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, inquiry_id, attachment_id):
        inquiry = get_participant_inquiry(request.user, inquiry_id)
        attachment = get_object_or_404(
            Attachment.objects.select_related("inquiry"),
            id=attachment_id,
            inquiry=inquiry,
        )
        return FileResponse(
            attachment.file.open("rb"),
            as_attachment=True,
            filename=attachment.original_filename,
        )


# Note: non-participants never reach the closed/blank checks — get_object_or_404
# with the participant Q filter returns 404 for outsiders.



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
        

