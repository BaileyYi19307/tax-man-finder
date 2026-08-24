from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from chats.models import Message
from inquiries.models import Inquiry
from .consultation import booking_requires_payment, snapshot_from_service
from .lifecycle_messages import (
    MSG_ACCEPTED_FREE,
    MSG_ACCEPTED_PAID,
    MSG_CANCELLED,
    MSG_DECLINED,
    MSG_PAYMENT_COMPLETED,
    post_booking_lifecycle_message,
)
from .models import (
    ACTIVE_BOOKING_STATUSES,
    SLOT_HELD_STATUSES,
    Booking,
    BookingStatus,
    Payment,
)
from .payment_service import (
    PaymentError,
    create_payment_for_booking,
    mark_payment_succeeded,
)
from .serializers import (
    BookingCreateSerializer,
    BookingSerializer,
    RequestConsultationSerializer,
)


class ActiveBookingConflict(Exception):
    def __init__(self, detail="This inquiry already has an active booking."):
        self.detail = detail


def slot_held_overlap_exists(accountant, starts_at, ends_at, exclude_booking_id=None):
    """Accepted slots (awaiting payment or confirmed) for the same accountant must not overlap."""
    qs = Booking.objects.filter(
        accountant=accountant,
        status__in=SLOT_HELD_STATUSES,
        starts_at__lt=ends_at,
        ends_at__gt=starts_at,
    )
    if exclude_booking_id:
        qs = qs.exclude(pk=exclude_booking_id)
    return qs.exists()


# Back-compat alias used by older tests / imports.
confirmed_overlap_exists = slot_held_overlap_exists


def _open_inquiry_queryset(client, accountant):
    return Inquiry.objects.select_for_update().filter(
        status=Inquiry.StatusChoices.OPEN,
        client=client,
        accountant=accountant,
    )


def get_or_create_open_inquiry(client, accountant):
    """Reuse the open inquiry, recovering from a concurrent-create uniqueness race."""
    existing = _open_inquiry_queryset(client, accountant).first()
    if existing is not None:
        return existing
    try:
        with transaction.atomic():
            return Inquiry.objects.create(
                client=client,
                accountant=accountant,
                status=Inquiry.StatusChoices.OPEN,
            )
    except IntegrityError:
        existing = _open_inquiry_queryset(client, accountant).first()
        if existing is None:
            raise
        return existing


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
        if slot_held_overlap_exists(
            booking.accountant, booking.starts_at, booking.ends_at, booking.id
        ):
            return Response(
                {"detail": "This booking overlaps another confirmed booking."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            if booking_requires_payment(booking.consultation_fee):
                booking.status = BookingStatus.AWAITING_PAYMENT
                booking.save(update_fields=["status", "updated_at"])
                create_payment_for_booking(booking)
                notice = MSG_ACCEPTED_PAID
            else:
                booking.status = BookingStatus.CONFIRMED
                booking.save(update_fields=["status", "updated_at"])
                notice = MSG_ACCEPTED_FREE
            post_booking_lifecycle_message(
                inquiry=booking.inquiry,
                actor=request.user,
                content=notice,
            )

        booking.refresh_from_db()
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
        post_booking_lifecycle_message(
            inquiry=booking.inquiry,
            actor=request.user,
            content=MSG_DECLINED,
        )
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
            BookingStatus.AWAITING_PAYMENT,
            BookingStatus.CONFIRMED,
        ):
            return Response(
                {
                    "detail": (
                        "Only pending, awaiting payment, or confirmed bookings "
                        "can be cancelled."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        booking.status = BookingStatus.CANCELLED
        booking.save(update_fields=["status", "updated_at"])
        post_booking_lifecycle_message(
            inquiry=booking.inquiry,
            actor=request.user,
            content=MSG_CANCELLED,
        )
        return Response(BookingSerializer(booking).data)

    @action(detail=True, methods=["post"], url_path="complete-demo-payment")
    def complete_demo_payment(self, request, pk=None):
        """
        Demo-only payment success path for the booking client.

        Amount and parties are derived server-side from the booking snapshot.
        Request body amounts/status are ignored.
        """
        booking = self._get_participant_booking(pk)
        if request.user.id != booking.client_id:
            return Response(
                {"detail": "Only the booking client can complete payment."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if booking.status != BookingStatus.AWAITING_PAYMENT:
            return Response(
                {"detail": "This booking is not awaiting payment."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            payment = booking.payment
        except Payment.DoesNotExist:
            return Response(
                {"detail": "No payment record exists for this booking."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            mark_payment_succeeded(payment)
        except PaymentError as exc:
            return Response({"detail": exc.detail}, status=status.HTTP_400_BAD_REQUEST)

        post_booking_lifecycle_message(
            inquiry=booking.inquiry,
            actor=request.user,
            content=MSG_PAYMENT_COMPLETED,
        )

        booking.refresh_from_db()
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

        try:
            with transaction.atomic():
                inquiry = data.get("inquiry")
                service = data.get("service")
                if inquiry is None:
                    inquiry = get_or_create_open_inquiry(
                        client=request.user,
                        accountant=data["accountant"],
                    )
                    if Booking.objects.filter(
                        inquiry=inquiry, status__in=ACTIVE_BOOKING_STATUSES
                    ).exists():
                        raise ActiveBookingConflict(
                            "Matching open inquiry already has an active booking."
                        )
                fee, policy = snapshot_from_service(service)
                Message.objects.create(
                    inquiry=inquiry,
                    sender=request.user,
                    content=content,
                )
                try:
                    booking = Booking.objects.create(
                        inquiry=inquiry,
                        client=inquiry.client,
                        accountant=inquiry.accountant,
                        starts_at=starts_at,
                        ends_at=ends_at,
                        status=BookingStatus.PENDING,
                        consultation_fee=fee,
                        cancellation_policy=policy,
                        name="",
                        date=starts_at,
                        service=service,
                    )
                except IntegrityError as exc:
                    raise ActiveBookingConflict from exc
        except ActiveBookingConflict as exc:
            return Response(
                {"detail": exc.detail},
                status=status.HTTP_400_BAD_REQUEST,
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
        bookings = (
            Booking.objects.filter(inquiry=inquiry)
            .select_related("service", "client", "accountant")
            .order_by("-created_at")
        )
        return Response(BookingSerializer(bookings, many=True).data)
