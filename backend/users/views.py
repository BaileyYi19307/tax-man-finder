from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated
from users.permissions import IsAccountant

from users.models import User
from .serializers import MeSerializer
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
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response({"id":user.id, "email":user.email, "message":"Registration successful. Please verify your email."}, status=status.HTTP_201_CREATED)

class Login(APIView):
    permission_classes=[AllowAny]
    
    def post(self,request):       
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "user": {
                    "id": user.id,
                    "email": user.email,
                },
                "tokens": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                },
                "message": "Login successful",
            },
            status=status.HTTP_200_OK,
        )


class MeView(APIView):
    permission_classes=[IsAuthenticated]

    def get(self,request):
        serializer = MeSerializer(request.user)
        return Response(serializer.data)



class AccountantDashboard(APIView):
    permission_classes = [IsAuthenticated, IsAccountant]

    def get(self, request):
        return Response({
            "role": "accountant",
            "message": "Welcome to the accountant dashboard"
        })
    

class ClientDashboard(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "role": "client",
            "message": "Welcome to the client dashboard"
        })
