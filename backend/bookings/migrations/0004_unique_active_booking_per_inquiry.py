from django.db import migrations, models


def cancel_extra_active_bookings(apps, schema_editor):
    """Keep one active booking per inquiry before adding the unique constraint."""
    Booking = apps.get_model("bookings", "Booking")
    seen_inquiries = set()
    extras = []
    for booking in Booking.objects.filter(
        status__in=["pending", "confirmed"]
    ).order_by("id"):
        if booking.inquiry_id in seen_inquiries:
            extras.append(booking.id)
        else:
            seen_inquiries.add(booking.inquiry_id)
    if extras:
        Booking.objects.filter(id__in=extras).update(status="cancelled")


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0003_booking_belongs_to_inquiry"),
    ]

    operations = [
        migrations.RunPython(cancel_extra_active_bookings, noop_reverse),
        migrations.AddConstraint(
            model_name="booking",
            constraint=models.UniqueConstraint(
                fields=("inquiry",),
                condition=models.Q(status__in=["pending", "confirmed"]),
                name="unique_active_booking_per_inquiry",
            ),
        ),
    ]
