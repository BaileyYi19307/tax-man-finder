"""
Consolidate open Inquiries to one per client/accountant pair and drop
Inquiry.service (service context lives on Booking).
"""

from collections import defaultdict

from django.db import migrations, models
from django.db.models import Count, Q


ACTIVE_STATUSES = ("pending", "awaiting_payment", "confirmed")
ACTIVE_PRIORITY = {
    "confirmed": 0,
    "awaiting_payment": 1,
    "pending": 2,
}

DEMO_CLIENT_EMAIL = "client@test.com"
DEMO_ACCOUNTANT_PREFIX = "demo.acct."


def _is_demo_email(email: str) -> bool:
    email = (email or "").lower()
    return email == DEMO_CLIENT_EMAIL or email.startswith(DEMO_ACCOUNTANT_PREFIX)


def consolidate_open_inquiries(apps, schema_editor):
    Inquiry = apps.get_model("inquiries", "Inquiry")
    Message = apps.get_model("chats", "Message")
    Attachment = apps.get_model("chats", "Attachment")
    Booking = apps.get_model("bookings", "Booking")
    ConversationReadState = apps.get_model("inquiries", "ConversationReadState")
    User = apps.get_model("users", "User")

    groups = defaultdict(list)
    for inquiry in Inquiry.objects.filter(status="open").order_by("id"):
        groups[(inquiry.client_id, inquiry.accountant_id)].append(inquiry)

    for (client_id, accountant_id), inquiries in groups.items():
        if len(inquiries) < 2:
            continue

        msg_counts = {
            row["inquiry_id"]: row["c"]
            for row in Message.objects.filter(
                inquiry_id__in=[i.id for i in inquiries]
            )
            .values("inquiry_id")
            .annotate(c=Count("id"))
        }
        # Prefer the thread with the most messages; break ties with lowest id.
        survivor = max(
            inquiries,
            key=lambda i: (msg_counts.get(i.id, 0), -i.id),
        )
        losers = [i for i in inquiries if i.id != survivor.id]
        loser_ids = [i.id for i in losers]
        all_ids = [survivor.id, *loser_ids]

        actives = list(
            Booking.objects.filter(
                inquiry_id__in=all_ids, status__in=ACTIVE_STATUSES
            ).order_by("id")
        )
        if len(actives) > 1:
            actives_sorted = sorted(
                actives,
                key=lambda b: (
                    ACTIVE_PRIORITY.get(b.status, 99),
                    b.starts_at,
                    b.id,
                ),
            )
            keep = actives_sorted[0]
            extras = actives_sorted[1:]
            client = User.objects.get(pk=client_id)
            accountant = User.objects.get(pk=accountant_id)
            demo_pair = _is_demo_email(client.email) or _is_demo_email(
                accountant.email
            )
            if not demo_pair:
                detail = ", ".join(
                    f"Booking({b.id}) status={b.status} inquiry={b.inquiry_id}"
                    for b in actives
                )
                raise RuntimeError(
                    "Cannot merge open Inquiries for "
                    f"client={client.email} accountant={accountant.email}: "
                    f"multiple active bookings ({detail}). "
                    "Resolve manually before migrating."
                )
            for booking in extras:
                prior_status = booking.status
                booking.status = "cancelled"
                booking.save(update_fields=["status"])
                print(
                    "Cancelled demo Booking "
                    f"{booking.id} (was {prior_status} on inquiry "
                    f"{booking.inquiry_id}) while merging into Inquiry "
                    f"{survivor.id}."
                )

        Message.objects.filter(inquiry_id__in=loser_ids).update(
            inquiry_id=survivor.id
        )
        Attachment.objects.filter(inquiry_id__in=loser_ids).update(
            inquiry_id=survivor.id
        )
        Booking.objects.filter(inquiry_id__in=loser_ids).update(
            inquiry_id=survivor.id
        )

        for loser in losers:
            for read_state in ConversationReadState.objects.filter(
                inquiry_id=loser.id
            ):
                existing = ConversationReadState.objects.filter(
                    inquiry_id=survivor.id, user_id=read_state.user_id
                ).first()
                if existing is None:
                    read_state.inquiry_id = survivor.id
                    read_state.save(update_fields=["inquiry_id"])
                else:
                    if read_state.last_read_at > existing.last_read_at:
                        existing.last_read_at = read_state.last_read_at
                        existing.save(update_fields=["last_read_at"])
                    read_state.delete()
            loser_id = loser.id
            loser.delete()
            print(
                f"Merged Inquiry {loser_id} into {survivor.id} "
                f"(client={client_id}, accountant={accountant_id})."
            )


def noop_reverse(apps, schema_editor):
    # Cannot restore Inquiry.service or un-merge conversations.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("inquiries", "0006_alter_inquiry_status"),
        ("bookings", "0005_consultation_fee_and_payment"),
        ("chats", "0006_message_is_system"),
    ]

    operations = [
        migrations.RunPython(consolidate_open_inquiries, noop_reverse),
        migrations.RemoveConstraint(
            model_name="inquiry",
            name="unique_open_inquiry_with_service",
        ),
        migrations.RemoveConstraint(
            model_name="inquiry",
            name="unique_open_general_inquiry",
        ),
        migrations.RemoveField(
            model_name="inquiry",
            name="service",
        ),
        migrations.AddConstraint(
            model_name="inquiry",
            constraint=models.UniqueConstraint(
                condition=Q(("status", "open")),
                fields=("client", "accountant"),
                name="unique_open_inquiry_per_client_accountant",
            ),
        ),
    ]
