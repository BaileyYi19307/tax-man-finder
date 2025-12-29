from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView


from users.models import User
from users.serializers import SignupSerializer, LoginSerializer


# @api_view(["GET", "POST"])
# @permission_classes([AllowAny])
# def user_list(request):
#     if request.method == "GET":
#         users = User.objects.all()
#         serializer = UserSerializer(users, many=True)
#         return Response(serializer.data)

#     elif request.method == "POST":
#         print("in the post method of get user list")
#         serializer = UserSerializer(data=request.data)
#         if serializer.is_valid():
#             serializer.save()
#             return Response(serializer.data, status=status.HTTP_201_CREATED)

#         return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



from django.contrib.auth import authenticate

#Allows user to signup
class SignUp(APIView):
    permission_classes=[AllowAny]

    def post(self, request):
        #instantiate serializer 
        serializer = SignupSerializer(data=request.data)
        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return Response(serializer.data,status=status.HTTP_201_CREATED)
        return Response(serializer.errors,status=status.HTTP_400_BAD_REQUEST)

class Login(APIView):
    permission_classes=[AllowAny]
    
    def post(self,request):
        print("The request is", request.data)
       
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']

        return Response(
        {
            "message": "login successful",
            "user": {
                "id": user.id,
                "email": user.email,
                "is_accountant": user.is_accountant,
            }
        },
        status=status.HTTP_200_OK
        )