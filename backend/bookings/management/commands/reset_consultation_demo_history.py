"""
Clear prior consultation/payment test history for the local demo client
and demo accountants, without wiping users, services, or ordinary chat.

Usage (from backend/, venv active, DEBUG=True only):

  python manage.py reset_consultation_demo_history

Safety:
  - Refuses to run when DEBUG is False.
  - Preserves Users, AccountantProfiles, Services, open Inquiries,
    ordinary (non-system) Messages, and Attachments.
  - Deletes Bookings (Payments cascade), and is_system lifecycle Messages
    on inquiries between the demo client and demo.acct.* accountants.
"""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

from bookings.models import ACTIVE_BOOKING_STATUSES, Booking, Payment
from chats.models import Attachment, Message
from inquiries.models import Inquiry
from users.models import User

DEMO_CLIENT_EMAIL = "client@test.com"
DEMO_ACCOUNTANT_PREFIX = "demo.acct."
DEMO_ACCOUNTANT_DOMAIN = "@example.com"


class Command(BaseCommand):
    help = (
        "DEBUG-only: remove consultation Bookings/Payments and lifecycle "
        "system messages for client@test.com ↔ demo.acct.* pairs."
    )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Refusing to run: DEBUG must be True.")

        client = User.objects.filter(email__iexact=DEMO_CLIENT_EMAIL).first()
        if client is None:
            raise CommandError(f"Demo client not found: {DEMO_CLIENT_EMAIL}")

        accountants = list(
            User.objects.filter(
                email__istartswith=DEMO_ACCOUNTANT_PREFIX,
                email__iendswith=DEMO_ACCOUNTANT_DOMAIN,
            )
        )
        if not accountants:
            raise CommandError("No demo.acct.* accountants found.")

        inquiries = Inquiry.objects.filter(
            Q(client=client, accountant__in=accountants)
            | Q(client__in=accountants, accountant=client)
        )
        inquiry_ids = list(inquiries.values_list("id", flat=True))

        bookings = Booking.objects.filter(inquiry_id__in=inquiry_ids)
        payments = Payment.objects.filter(booking__inquiry_id__in=inquiry_ids)
        system_messages = Message.objects.filter(
            inquiry_id__in=inquiry_ids, is_system=True
        )
        user_messages = Message.objects.filter(
            inquiry_id__in=inquiry_ids, is_system=False
        )
        attachments = Attachment.objects.filter(inquiry_id__in=inquiry_ids)

        before = {
            "inquiries": inquiries.count(),
            "bookings": bookings.count(),
            "active_bookings": bookings.filter(
                status__in=ACTIVE_BOOKING_STATUSES
            ).count(),
            "payments": payments.count(),
            "system_messages": system_messages.count(),
            "user_messages": user_messages.count(),
            "attachments": attachments.count(),
        }

        with transaction.atomic():
            deleted_payments, _ = payments.delete()
            deleted_bookings, _ = bookings.delete()
            deleted_system, _ = system_messages.delete()

        after_bookings = Booking.objects.filter(inquiry_id__in=inquiry_ids)
        after_payments = Payment.objects.filter(booking__inquiry_id__in=inquiry_ids)
        after_system = Message.objects.filter(
            inquiry_id__in=inquiry_ids, is_system=True
        )

        # Per-pair active booking counts for the walkthrough accounts.
        pair_report = []
        for email in (
            "demo.acct.maya@example.com",
            "demo.acct.jordan@example.com",
        ):
            acct = User.objects.filter(email__iexact=email).first()
            if acct is None:
                pair_report.append(f"{email}: accountant missing")
                continue
            pair_inqs = Inquiry.objects.filter(client=client, accountant=acct)
            active = Booking.objects.filter(
                inquiry__in=pair_inqs, status__in=ACTIVE_BOOKING_STATUSES
            ).count()
            pays = Payment.objects.filter(booking__inquiry__in=pair_inqs).count()
            pair_report.append(
                f"{email}: inquiries={pair_inqs.count()} "
                f"active_bookings={active} payments={pays}"
            )

        self.stdout.write(self.style.SUCCESS("Consultation demo history reset."))
        self.stdout.write(f"Before: {before}")
        self.stdout.write(
            f"Deleted: bookings={deleted_bookings}, "
            f"payments={deleted_payments}, "
            f"system_messages={deleted_system}"
        )
        self.stdout.write(
            "Preserved: inquiries, user messages, attachments, users, services."
        )
        self.stdout.write(
            f"After bookings={after_bookings.count()} "
            f"payments={after_payments.count()} "
            f"system_messages={after_system.count()} "
            f"user_messages={Message.objects.filter(inquiry_id__in=inquiry_ids, is_system=False).count()} "
            f"attachments={Attachment.objects.filter(inquiry_id__in=inquiry_ids).count()} "
            f"inquiries={Inquiry.objects.filter(id__in=inquiry_ids).count()}"
        )
        for line in pair_report:
            self.stdout.write(line)
