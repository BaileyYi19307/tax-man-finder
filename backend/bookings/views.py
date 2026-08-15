from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from chats.models import Message
from inquiries.models import Inquiry
from .models import ACTIVE_BOOKING_STATUSES, Booking, BookingStatus
from .serializers import (
    BookingCreateSerializer,
    BookingSerializer,
    RequestConsultationSerializer,
)


def confirmed_overlap_exists(accountant, starts_at, ends_at, exclude_booking_id=None):
    """Confirmed bookings for the same accountant must not overlap."""
    qs = Booking.objects.filter(
        accountant=accountant,
        status=BookingStatus.CONFIRMED,
        starts_at__lt=ends_at,
        ends_at__gt=starts_at,
    )
    if exclude_booking_id:
        qs = qs.exclude(pk=exclude_booking_id)
    return qs.exists()


class BookingsViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        return (
            Booking.objects.filter(Q(client=user) | Q(accountant=user))
            .select_related("inquiry", "client", "accountant", "service")
            .order_by("-starts_at")
        )

    def get_serializer_class(self):
        if self.action == "create":
            return BookingCreateSerializer
        return BookingSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking = serializer.save()
        return Response(
            BookingSerializer(booking).data,
            status=status.HTTP_201_CREATED,
        )

    def _get_participant_booking(self, pk):
        return get_object_or_404(self.get_queryset(), pk=pk)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        booking = self._get_participant_booking(pk)
        if request.user.id != booking.accountant_id:
            return Response(
                {"detail": "Only the accountant can accept a booking."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if booking.status != BookingStatus.PENDING:
            return Response(
                {"detail": "Only pending bookings can be accepted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if confirmed_overlap_exists(
            booking.accountant, booking.starts_at, booking.ends_at, booking.id
        ):
            return Response(
                {"detail": "This booking overlaps another confirmed booking."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        booking.status = BookingStatus.CONFIRMED
        booking.save(update_fields=["status", "updated_at"])
        return Response(BookingSerializer(booking).data)

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        booking = self._get_participant_booking(pk)
        if request.user.id != booking.accountant_id:
            return Response(
                {"detail": "Only the accountant can decline a booking."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if booking.status != BookingStatus.PENDING:
            return Response(
                {"detail": "Only pending bookings can be declined."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        booking.status = BookingStatus.DECLINED
        booking.save(update_fields=["status", "updated_at"])
        return Response(BookingSerializer(booking).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        booking = self._get_participant_booking(pk)
        if request.user.id not in (booking.client_id, booking.accountant_id):
            return Response(
                {"detail": "Only participants can cancel a booking."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if booking.status not in (
            BookingStatus.PENDING,
            BookingStatus.CONFIRMED,
        ):
            return Response(
                {"detail": "Only pending or confirmed bookings can be cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        booking.status = BookingStatus.CANCELLED
        booking.save(update_fields=["status", "updated_at"])
        return Response(BookingSerializer(booking).data)


class RequestConsultationView(APIView):
    """
    Atomic consultation request:
    reuse/create open inquiry + first/booking message + pending booking.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = RequestConsultationSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        content = data["content"]
        starts_at = data["starts_at"]
        ends_at = Booking.compute_ends_at(starts_at)

        with transaction.atomic():
            inquiry = data.get("inquiry")
            if inquiry is None:
                accountant = data["accountant"]
                service = data.get("service")
                if service is not None:
                    existing = Inquiry.objects.filter(
                        status=Inquiry.StatusChoices.OPEN,
                        client=request.user,
                        accountant=accountant,
                        service=service,
                    ).first()
                else:
                    existing = Inquiry.objects.filter(
                        status=Inquiry.StatusChoices.OPEN,
                        client=request.user,
                        accountant=accountant,
                        service__isnull=True,
                    ).first()

                if existing is not None:
                    if Booking.objects.filter(
                        inquiry=existing, status__in=ACTIVE_BOOKING_STATUSES
                    ).exists():
                        return Response(
                            {
                                "detail": "Matching open inquiry already has an active booking."
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    inquiry = existing
                    Message.objects.create(
                        inquiry=inquiry,
                        sender=request.user,
                        content=content,
                    )
                else:
                    inquiry = Inquiry.objects.create(
                        client=request.user,
                        accountant=accountant,
                        service=service,
                        status=Inquiry.StatusChoices.OPEN,
                    )
                    Message.objects.create(
                        inquiry=inquiry,
                        sender=request.user,
                        content=content,
                    )
            else:
                Message.objects.create(
                    inquiry=inquiry,
                    sender=request.user,
                    content=content,
                )

            booking = Booking.objects.create(
                inquiry=inquiry,
                client=inquiry.client,
                accountant=inquiry.accountant,
                starts_at=starts_at,
                ends_at=ends_at,
                status=BookingStatus.PENDING,
                name="",
                date=starts_at,
                service=inquiry.service,
            )

        return Response(
            {
                "inquiry_id": inquiry.id,
                "booking": BookingSerializer(booking).data,
            },
            status=status.HTTP_201_CREATED,
        )


class InquiryBookingsView(APIView):
    """List bookings for an inquiry (participants only)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, inquiry_id):
        inquiry = get_object_or_404(
            Inquiry.objects.filter(
                Q(client=request.user) | Q(accountant=request.user)
            ),
            id=inquiry_id,
        )
        bookings = Booking.objects.filter(inquiry=inquiry).order_by("-created_at")
        return Response(BookingSerializer(bookings, many=True).data)
