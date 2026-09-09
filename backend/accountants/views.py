from rest_framework.views import APIView
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
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
from services.category_assignment import (
    resolve_assignable_category,
    resolve_public_category_slug,
)
from services.models import Service
from services.title_uniqueness import (
    DUPLICATE_SERVICE_TITLE_MESSAGE,
    find_conflicting_service,
)
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError as DRFValidationError
from django.db.models import Exists, OuterRef


def _float_or_none(value):
    if value is None:
        return None
    return float(value)


def _profile_payload(profile, *, for_owner: bool = False):
    """
    Profile payload with explicit publication fields.

    Owner/dashboard responses include publish_readiness_errors; public discovery
    payloads omit that owner-specific detail.
    """
    user = profile.user
    service_rows = (
        Service.objects.filter(accountant_id=user.id, is_active=True)
        .select_related("category")
        .order_by("name")
    )
    services = []
    for service in service_rows:
        category = service.category
        row = {
            "id": service.id,
            "name": service.name,
            "description": service.description or "",
            "pricing_type": service.pricing_type,
            "indicative_price": (
                str(service.indicative_price)
                if service.indicative_price is not None
                else None
            ),
            "consultation_fee": (
                str(service.consultation_fee)
                if service.consultation_fee is not None
                else None
            ),
            "cancellation_policy": service.cancellation_policy or "",
            "category": (
                {
                    "id": category.id,
                    "name": category.name,
                    "slug": category.slug,
                }
                if category is not None
                else None
            ),
        }
        services.append(row)
    data = {
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
        "headline": profile.headline,
        "languages": profile.languages or [],
        "offers_remote": profile.offers_remote,
        "offers_in_person": profile.offers_in_person,
        "industries": profile.industries or [],
        "website": profile.website or "",
        "license_information": profile.license_information,
        "map_eligible": profile.is_map_eligible,
        "services": services,
        "publication_status": profile.publication_status,
        "is_publish_ready": profile.is_publish_ready,
        "is_public": profile.is_public,
        # Compatibility: same meaning as is_publish_ready (not publication_status).
        "profile_complete": profile.is_publish_ready,
    }
    if for_owner:
        data["publish_readiness_errors"] = profile.publish_readiness_errors()
    return data


# Backward-compatible alias used by older call sites/tests.
_profile_public_payload = _profile_payload


def _owner_profile_payload(profile):
    return _profile_payload(profile, for_owner=True)


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


_OPTIONAL_TEXT_FIELDS = (
    "bio",
    "credentials",
    "firm_name",
    "location",
    "headline",
    "license_information",
)

_MAX_NAME_LENGTH = 150


def _parse_provided_name(request_data, field_name: str):
    """
    Return a cleaned name when the field is present; None when omitted.

    Blank or whitespace-only values are rejected.
    """
    if field_name not in request_data:
        return None
    value = str(request_data.get(field_name) or "").strip()
    if not value:
        raise ValueError(f"{field_name} cannot be blank.")
    if len(value) > _MAX_NAME_LENGTH:
        raise ValueError(
            f"{field_name} must be at most {_MAX_NAME_LENGTH} characters."
        )
    return value


def _build_profile_payload(request_data):
    """
    Build serializer payload from request keys that are present.

    Omitted fields are left unchanged on update / defaulted on create.
    """
    payload = {}
    for field in _OPTIONAL_TEXT_FIELDS:
        if field in request_data:
            payload[field] = str(request_data.get(field) or "").strip()

    if "website" in request_data:
        payload["website"] = str(request_data.get("website") or "").strip()

    if "years_experience" in request_data:
        payload["years_experience"] = request_data.get("years_experience")

    if "service_scope" in request_data:
        payload["service_scope"] = _parse_service_scope(
            request_data.get("service_scope")
        )

    for field in ("languages", "industries", "offers_remote", "offers_in_person"):
        if field in request_data:
            payload[field] = request_data.get(field)

    return payload


class CreateAccountantProfile(APIView):
    """Authenticated users create or update their own accountant profile (draft-safe)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = AccountantProfile.objects.filter(user=request.user).first()
        if profile is None:
            return Response(
                {"detail": "No accountant profile."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_owner_profile_payload(profile), status=status.HTTP_200_OK)

    def post(self, request):
        try:
            first_name = _parse_provided_name(request.data, "first_name")
            last_name = _parse_provided_name(request.data, "last_name")
        except ValueError as exc:
            message = str(exc)
            field = (
                "first_name" if message.startswith("first_name") else "last_name"
            )
            return Response(
                {field: [message]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payload = _build_profile_payload(request.data)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        service_name = str(request.data.get("service_name") or "").strip()
        service_description = str(
            request.data.get("service_description") or ""
        ).strip()
        create_primary_service = False
        category = None

        profile = AccountantProfile.objects.filter(user=request.user).first()
        created = profile is None

        # Validate optional primary-service payload before any writes.
        if service_name:
            create_primary_service = profile is None or not profile.has_services
            if create_primary_service:
                try:
                    category = resolve_assignable_category(
                        request.data.get("category_id")
                    )
                except DRFValidationError as exc:
                    detail = exc.detail
                    if isinstance(detail, dict):
                        return Response(detail, status=status.HTTP_400_BAD_REQUEST)
                    return Response(
                        {"category_id": detail},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if find_conflicting_service(
                    accountant=request.user,
                    name=service_name,
                ):
                    return Response(
                        {"service_name": [DUPLICATE_SERVICE_TITLE_MESSAGE]},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        if profile is None:
            serializer = AccountantProfileSerializer(data=payload)
        else:
            serializer = AccountantProfileSerializer(
                profile, data=payload, partial=True
            )
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            if created:
                profile = serializer.save(user=request.user)
            else:
                profile = serializer.save()

            if "location" in request.data:
                _apply_location_coordinates(
                    profile, str(request.data.get("location") or "").strip()
                )
                profile.save(update_fields=["latitude", "longitude", "updated_at"])

            user = request.user
            name_updates = []
            if first_name is not None:
                user.first_name = first_name
                name_updates.append("first_name")
            if last_name is not None:
                user.last_name = last_name
                name_updates.append("last_name")
            if name_updates:
                name_updates.append("updated_at")
                user.save(update_fields=name_updates)

            if create_primary_service and category is not None:
                Service.objects.create(
                    accountant=request.user,
                    name=service_name.strip(),
                    description=service_description or service_name,
                    pricing_type=Service.PricingType.CONSULTATION_REQUIRED,
                    category=category,
                )

        profile.refresh_from_db()
        profile.user.refresh_from_db()
        body = _owner_profile_payload(profile)
        return Response(
            body,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class PublishAccountantProfileView(APIView):
    """Owner-only: set publication_status to published when ready."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = AccountantProfile.objects.filter(user=request.user).first()
        if profile is None:
            return Response(
                {"detail": "No accountant profile."},
                status=status.HTTP_404_NOT_FOUND,
            )
        errors = profile.publish_readiness_errors()
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)
        if profile.publication_status != AccountantProfile.PublicationStatus.PUBLISHED:
            profile.publication_status = AccountantProfile.PublicationStatus.PUBLISHED
            profile.save(update_fields=["publication_status", "updated_at"])
        profile.refresh_from_db()
        return Response(_owner_profile_payload(profile), status=status.HTTP_200_OK)


class OwnerAccountantPreviewView(APIView):
    """
    Owner-only customer-facing preview of a draft or published profile.

    Returns the same shape as the public profile payload, plus owner readiness
    fields. Does not require the profile to be public. Inactive services are
    omitted (same as public discovery).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = (
            AccountantProfile.objects.select_related("user")
            .filter(user=request.user)
            .first()
        )
        if profile is None:
            return Response(
                {"detail": "No accountant profile."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_owner_profile_payload(profile), status=status.HTTP_200_OK)


class UnpublishAccountantProfileView(APIView):
    """Owner-only: return profile to draft without touching services."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = AccountantProfile.objects.filter(user=request.user).first()
        if profile is None:
            return Response(
                {"detail": "No accountant profile."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if profile.publication_status != AccountantProfile.PublicationStatus.DRAFT:
            profile.publication_status = AccountantProfile.PublicationStatus.DRAFT
            profile.save(update_fields=["publication_status", "updated_at"])
        profile.refresh_from_db()
        return Response(_owner_profile_payload(profile), status=status.HTTP_200_OK)


class CheckProfileStatus(APIView):
    """
    Readiness snapshot for a profile.

    Public for publicly visible profiles; owners may always read their own.
    Owner/dashboard responses include publish_readiness_errors.
    """

    permission_classes = [AllowAny]

    def get(self, request, user_id):
        profile = get_object_or_404(AccountantProfile, user_id=user_id)
        is_owner = (
            request.user.is_authenticated and request.user.id == int(user_id)
        )
        if not profile.is_public and not is_owner:
            return Response(
                {"detail": "Not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        data = {
            "profile_info_complete": profile.is_profile_info_complete,
            "services_exist": profile.publishable_services().exists(),
            "profile_complete": profile.is_publish_ready,
            "publication_status": profile.publication_status,
            "is_publish_ready": profile.is_publish_ready,
            "is_public": profile.is_public,
        }
        if is_owner:
            data["publish_readiness_errors"] = profile.publish_readiness_errors()

        serializer = AccountantProfileStatusSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PublicAccountantDirectoryView(APIView):
    """Public list of accountant profiles for discovery (optional filters)."""

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

        category = None
        raw_category = request.query_params.get("category")
        if raw_category not in (None, ""):
            try:
                category = resolve_public_category_slug(raw_category)
            except DRFValidationError as exc:
                detail = exc.detail
                if isinstance(detail, dict):
                    return Response(detail, status=status.HTTP_400_BAD_REQUEST)
                return Response(
                    {"category": detail},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        profiles = (
            AccountantProfile.objects.publicly_visible()
            .select_related("user")
            .order_by("user_id")
        )
        if category is not None:
            matching_service = Service.objects.filter(
                accountant_id=OuterRef("user_id"),
                is_active=True,
                category_id=category.id,
            )
            profiles = profiles.annotate(
                _matches_category=Exists(matching_service)
            ).filter(_matches_category=True)

        listed = []
        for profile in profiles:
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
            listed.append(_profile_payload(profile))

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
        if not profile.is_public:
            return Response(
                {"detail": "Not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_profile_payload(profile), status=status.HTTP_200_OK)
