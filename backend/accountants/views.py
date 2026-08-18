from rest_framework.views import APIView
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from .serializers import AccountantProfileSerializer, AccountantProfileStatusSerializer
from .models import AccountantProfile
from services.models import Service
from django.shortcuts import get_object_or_404


def _profile_public_payload(profile):
    user = profile.user
    services = (
        Service.objects.filter(accountant_id=user.id, is_active=True)
        .order_by("name")
        .values("id", "name")
    )
    return {
        "user_id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "bio": profile.bio,
        "credentials": profile.credentials,
        "years_experience": profile.years_experience,
        "firm_name": profile.firm_name,
        "location": profile.location,
        "services": list(services),
        "profile_complete": profile.is_complete,
    }


class CreateAccountantProfile(APIView):
    """Authenticated users create or complete their own accountant profile."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = AccountantProfile.objects.filter(user=request.user).first()
        if profile is None:
            return Response(
                {"detail": "No accountant profile."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_profile_public_payload(profile), status=status.HTTP_200_OK)

    def post(self, request):
        bio = str(request.data.get("bio") or "").strip()
        credentials = str(request.data.get("credentials") or "").strip()
        if not bio or not credentials:
            return Response(
                {"detail": "Bio and credentials are required to set up an accountant profile."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        payload = {
            "bio": bio,
            "credentials": credentials,
            "firm_name": str(request.data.get("firm_name") or "").strip(),
            "location": str(request.data.get("location") or "").strip(),
        }
        if "years_experience" in request.data:
            payload["years_experience"] = request.data.get("years_experience")

        profile = AccountantProfile.objects.filter(user=request.user).first()
        created = profile is None
        if profile is None:
            serializer = AccountantProfileSerializer(data=payload)
            serializer.is_valid(raise_exception=True)
            profile = serializer.save(user=request.user)
        else:
            serializer = AccountantProfileSerializer(profile, data=payload, partial=True)
            serializer.is_valid(raise_exception=True)
            profile = serializer.save()

        first_name = str(request.data.get("first_name") or "").strip()
        last_name = str(request.data.get("last_name") or "").strip()
        if first_name or last_name:
            if first_name:
                request.user.first_name = first_name
            if last_name:
                request.user.last_name = last_name
            request.user.save(update_fields=["first_name", "last_name", "updated_at"])

        service_name = str(request.data.get("service_name") or "").strip()
        service_description = str(request.data.get("service_description") or "").strip()
        if service_name and not profile.has_services:
            Service.objects.create(
                accountant=request.user,
                name=service_name,
                description=service_description or service_name,
                pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
            )

        profile.refresh_from_db()
        profile.user.refresh_from_db()
        body = _profile_public_payload(profile)
        return Response(
            body,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class CheckProfileStatus(APIView):
    permission_classes = [AllowAny]

    def get(self, request, user_id):
        profile = get_object_or_404(AccountantProfile, user_id=user_id)
        data = {
            "profile_info_complete": profile.is_profile_info_complete,
            "services_exist": profile.has_services,
            "profile_complete": profile.is_complete,
        }

        serializer = AccountantProfileStatusSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PublicAccountantDirectoryView(APIView):
    """Public list of accountant profiles for discovery."""

    permission_classes = [AllowAny]

    def get(self, request):
        profiles = AccountantProfile.objects.select_related("user").order_by("user_id")
        listed = [
            _profile_public_payload(profile)
            for profile in profiles
            if profile.is_complete
        ]
        return Response(listed, status=status.HTTP_200_OK)


class PublicAccountantProfileView(APIView):
    """Public accountant/firm profile for discovery + Message Accountant entry."""

    permission_classes = [AllowAny]

    def get(self, request, user_id):
        profile = get_object_or_404(
            AccountantProfile.objects.select_related("user"),
            user_id=user_id,
        )
        return Response(_profile_public_payload(profile), status=status.HTTP_200_OK)
