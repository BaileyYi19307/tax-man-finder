from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .serializers import ServiceSerializer


# Create your views here.
class CreateService(APIView):
    permission_classes=[AllowAny] # change this later to only accountants

    def post(self,request):
        print("the request is", request.data)

        #initialize the serializer 
        serializer = ServiceSerializer(data = request.data)
        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return Response(serializer.data,status=status.HTTP_200_OK)
        return Response(serializer.errors,status=status.HTTP_400_BAD_REQUEST)
    
    
