# Generated manually for Stripe Checkout session tracking.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0005_consultation_fee_and_payment"),
    ]

    operations = [
        migrations.AddField(
            model_name="payment",
            name="checkout_session_id",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
