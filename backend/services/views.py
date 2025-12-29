from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


# Create your views here.
class CreateService(APIView):
    permission_classes=[AllowAny] # change this later to only accountants


    def post(self,request):
        print("the request is", request.data)
        return Response("Request successfully posted", status=status.HTTP_200_OK)