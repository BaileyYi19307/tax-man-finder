from rest_framework.views import APIView
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from .serializers import AccountantProfileSerializer, AccountantProfileStatusSerializer
from .models import AccountantProfile
from services.models import Service
from django.shortcuts import get_object_or_404


# Create your views here.

class CreateAccountantProfile(APIView):
    """Authenticated users create their own profile (no AllowAny)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if AccountantProfile.objects.filter(user=request.user).exists():
            return Response(
                {"detail": "Accountant profile already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        payload = {**request.data, "user": request.user.id}
        serializer = AccountantProfileSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
        

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


class PublicAccountantProfileView(APIView):
    """Public accountant/firm profile for discovery + Message Accountant entry."""

    permission_classes = [AllowAny]

    def get(self, request, user_id):
        profile = get_object_or_404(
            AccountantProfile.objects.select_related("user"),
            user_id=user_id,
        )
        services = (
            Service.objects.filter(accountant_id=user_id, is_active=True)
            .order_by("name")
            .values("id", "name")
        )
        return Response(
            {
                "user_id": profile.user_id,
                "email": profile.user.email,
                "bio": profile.bio,
                "credentials": profile.credentials,
                "years_experience": profile.years_experience,
                "services": list(services),
            },
            status=status.HTTP_200_OK,
        )
