from rest_framework.views import APIView
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from .serializers import AccountantProfileSerializer, AccountantProfileStatusSerializer
from .models import AccountantProfile
from .geo import (
    DEFAULT_RADIUS_MILES,
    parse_latitude,
    parse_longitude,
    parse_radius_miles,
    within_radius,
)
from .geocoding import geocode_query
from services.models import Service
from django.shortcuts import get_object_or_404


def _float_or_none(value):
    if value is None:
        return None
    return float(value)


def _profile_public_payload(profile):
    user = profile.user
    services = list(
        Service.objects.filter(accountant_id=user.id, is_active=True)
        .order_by("name")
        .values(
            "id",
            "name",
            "pricing_type",
            "indicative_price",
            "consultation_fee",
            "cancellation_policy",
        )
    )
    for service in services:
        price = service.get("indicative_price")
        if price is not None:
            service["indicative_price"] = str(price)
        fee = service.get("consultation_fee")
        if fee is not None:
            service["consultation_fee"] = str(fee)
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
        "latitude": _float_or_none(profile.latitude),
        "longitude": _float_or_none(profile.longitude),
        "service_scope": profile.service_scope,
        "map_eligible": profile.is_map_eligible,
        "services": services,
        "profile_complete": profile.is_complete,
    }


def _apply_location_coordinates(profile, location_text):
    """Derive optional base lat/lng from free-text location; never invent coords."""
    cleaned = (location_text or "").strip()
    if not cleaned:
        profile.latitude = None
        profile.longitude = None
        return

    result = geocode_query(cleaned)
    if result is None:
        profile.latitude = None
        profile.longitude = None
        return

    profile.latitude = result["latitude"]
    profile.longitude = result["longitude"]


def _parse_service_scope(raw):
    allowed = {c.value for c in AccountantProfile.ServiceScope}
    value = str(raw or AccountantProfile.ServiceScope.LOCAL).strip().lower()
    if value not in allowed:
        raise ValueError(
            "service_scope must be one of: local, remote, nationwide."
        )
    return value


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
                {
                    "detail": "Bio and credentials are required to set up an accountant profile."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        location = str(request.data.get("location") or "").strip()
        try:
            service_scope = _parse_service_scope(request.data.get("service_scope"))
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        payload = {
            "bio": bio,
            "credentials": credentials,
            "firm_name": str(request.data.get("firm_name") or "").strip(),
            "location": location,
            "service_scope": service_scope,
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

        _apply_location_coordinates(profile, location)
        profile.save(update_fields=["latitude", "longitude", "updated_at"])

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
    """Public list of accountant profiles for discovery (optional fixed-radius filter)."""

    permission_classes = [AllowAny]

    def get(self, request):
        geo_params_partial = [
            k
            for k in ("latitude", "longitude")
            if request.query_params.get(k) not in (None, "")
        ]
        if geo_params_partial and len(geo_params_partial) != 2:
            return Response(
                {"detail": "Geographic search requires both latitude and longitude."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        use_geo = len(geo_params_partial) == 2
        center_lat = center_lng = radius = None
        if use_geo:
            try:
                center_lat = parse_latitude(request.query_params.get("latitude"))
                center_lng = parse_longitude(request.query_params.get("longitude"))
                radius = parse_radius_miles(request.query_params.get("radius_miles"))
            except ValueError as exc:
                return Response(
                    {"detail": str(exc)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        profiles = AccountantProfile.objects.select_related("user").order_by("user_id")
        listed = []
        for profile in profiles:
            if not profile.is_complete:
                continue
            if use_geo:
                if not profile.is_map_eligible:
                    continue
                if not within_radius(
                    center_lat=center_lat,
                    center_lng=center_lng,
                    point_lat=float(profile.latitude),
                    point_lng=float(profile.longitude),
                    radius_miles=radius,
                ):
                    continue
            listed.append(_profile_public_payload(profile))

        return Response(listed, status=status.HTTP_200_OK)


class GeocodePlaceView(APIView):
    """Resolve a place string for map search centering (Nominatim)."""

    permission_classes = [AllowAny]

    def get(self, request):
        query = str(request.query_params.get("q") or "").strip()
        if not query:
            return Response(
                {"detail": "Query parameter q is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        result = geocode_query(query)
        if result is None:
            return Response(
                {"detail": "No results for that location."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(result, status=status.HTTP_200_OK)


class PublicAccountantProfileView(APIView):
    """Public accountant/firm profile for discovery + Message Accountant entry."""

    permission_classes = [AllowAny]

    def get(self, request, user_id):
        profile = get_object_or_404(
            AccountantProfile.objects.select_related("user"),
            user_id=user_id,
        )
        return Response(_profile_public_payload(profile), status=status.HTTP_200_OK)
