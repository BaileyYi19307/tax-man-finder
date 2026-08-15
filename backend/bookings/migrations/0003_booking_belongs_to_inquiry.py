import datetime

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


STATUS_MAP = {
    0: "cancelled",
    1: "cancelled",  # former "Complete" — finished, not an active request
    2: "pending",
    3: "confirmed",  # former "Upcoming"
}

ACTIVE_STATUSES = ("pending", "confirmed")


def forwards_booking_domain(apps, schema_editor):
    Booking = apps.get_model("bookings", "Booking")
    Inquiry = apps.get_model("inquiries", "Inquiry")

    for booking in Booking.objects.all():
        client_id = booking.client_id
        accountant_id = booking.accountant_id

        old_status = booking.status if isinstance(booking.status, int) else None
        if old_status in STATUS_MAP:
            new_status = STATUS_MAP[old_status]
        else:
            new_status = booking.status_new or "pending"
        becomes_active = new_status in ACTIVE_STATUSES

        if booking.inquiry_id is None:
            qs = Inquiry.objects.filter(
                client_id=client_id,
                accountant_id=accountant_id,
                status="open",
            )
            if booking.service_id:
                qs = qs.filter(service_id=booking.service_id)
            else:
                qs = qs.filter(service_id__isnull=True)
            inquiry = qs.first()
            if inquiry is None:
                inquiry = Inquiry.objects.create(
                    client_id=client_id,
                    accountant_id=accountant_id,
                    service_id=booking.service_id,
                    status="closed",
                )
            elif becomes_active and Booking.objects.filter(
                inquiry_id=inquiry.id,
                status_new__in=ACTIVE_STATUSES,
            ).exists():
                # Keep at most one active booking on the reused open inquiry.
                inquiry = Inquiry.objects.create(
                    client_id=client_id,
                    accountant_id=accountant_id,
                    service_id=booking.service_id,
                    status="closed",
                )
            booking.inquiry_id = inquiry.id

        starts = booking.starts_at or booking.date or django.utils.timezone.now()
        booking.starts_at = starts
        booking.ends_at = booking.ends_at or (starts + datetime.timedelta(minutes=30))
        booking.date = booking.date or starts
        if booking.name is None:
            booking.name = ""

        booking.status_new = new_status
        booking.save()


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0002_initial"),
        ("inquiries", "0006_alter_inquiry_status"),
        ("services", "0003_remove_service_price_service_created_at_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RenameField(
            model_name="booking",
            old_name="user",
            new_name="client",
        ),
        migrations.AddField(
            model_name="booking",
            name="inquiry",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="bookings",
                to="inquiries.inquiry",
            ),
        ),
        migrations.AddField(
            model_name="booking",
            name="starts_at",
            field=models.DateTimeField(null=True),
        ),
        migrations.AddField(
            model_name="booking",
            name="ends_at",
            field=models.DateTimeField(null=True),
        ),
        migrations.AddField(
            model_name="booking",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="booking",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddField(
            model_name="booking",
            name="status_new",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("confirmed", "Confirmed"),
                    ("declined", "Declined"),
                    ("cancelled", "Cancelled"),
                ],
                default="pending",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="booking",
            name="name",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AlterField(
            model_name="booking",
            name="date",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="booking",
            name="service",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="services.service",
            ),
        ),
        migrations.RunPython(forwards_booking_domain, noop_reverse),
        migrations.RemoveField(
            model_name="booking",
            name="status",
        ),
        migrations.RenameField(
            model_name="booking",
            old_name="status_new",
            new_name="status",
        ),
        migrations.AlterField(
            model_name="booking",
            name="inquiry",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="bookings",
                to="inquiries.inquiry",
            ),
        ),
        migrations.AlterField(
            model_name="booking",
            name="starts_at",
            field=models.DateTimeField(),
        ),
        migrations.AlterField(
            model_name="booking",
            name="ends_at",
            field=models.DateTimeField(),
        ),
        migrations.AddConstraint(
            model_name="booking",
            constraint=models.CheckConstraint(
                check=models.Q(ends_at__gt=models.F("starts_at")),
                name="booking_ends_after_starts",
            ),
        ),
    ]
