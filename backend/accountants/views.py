from rest_framework.views import APIView
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .serializers import AccountantProfileSerializer, AccountantProfileStatusSerializer
from .models import AccountantProfile
from django.shortcuts import render, redirect, get_object_or_404


# Create your views here.

class CreateAccountantProfile(APIView):
    permission_classes=[AllowAny]
    
    def post(self,request):
        #create an accountant first
        serializer = AccountantProfileSerializer(data=request.data)
        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return Response(serializer.data,status=status.HTTP_200_OK)
        return Response(serializer.errors,status=status.HTTP_400_BAD_REQUEST)
        

class CheckProfileStatus(APIView):
    permission_classes = [AllowAny]

    def get(self,request,user_id):
        profile = get_object_or_404(AccountantProfile, user_id=user_id)
        data = {
            "profile_info_complete": profile.is_profile_info_complete,
            "services_exist": profile.has_services,
            "profile_complete": profile.is_complete,
        }


        serializer = AccountantProfileStatusSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)
