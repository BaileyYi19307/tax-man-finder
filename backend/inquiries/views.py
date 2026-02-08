from django.shortcuts import render
from rest_framework.views import APIView
from services.models import Service
from inquiries.models import Inquiry
from chats.models import Conversation
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from .serializers import InquiryCreateSerializer


# Create your views here.
class CreateInquiryView(APIView):
    # permission_classes=[IsAuthenticated]

    def post(self, request):
        #request contains service id 
        s = InquiryCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        service = get_object_or_404(Service, id=s.validated_data["service_id"])

        #now we make an inquiry abut it 
        inquiry = Inquiry.objects.create(
            client=request.user,
            accountant = service.accountant,
            service = service
        )

        #now create a conversation based on that
        conversation = Conversation.objects.create(
            inquiry=inquiry
        )

        return Response(
            {
                "inquiry_id": inquiry.id,
                "conversation_id": conversation.id
            },
            status=status.HTTP_201_CREATED
        )
