from django.db import migrations, models

import services.cancellation_policy as policy


def forwards_backfill_codes(apps, schema_editor):
    Service = apps.get_model("services", "Service")
    for service in Service.objects.all().iterator():
        matched = policy.match_legacy_cancellation_policy_text(
            service.cancellation_policy
        )
        if matched:
            service.cancellation_policy_code = matched
            # Keep text column in sync with canonical wording for matched rows.
            service.cancellation_policy = policy.label_for_cancellation_policy_code(
                matched
            )
            service.save(
                update_fields=[
                    "cancellation_policy_code",
                    "cancellation_policy",
                    "updated_at",
                ]
            )


def backwards_clear_codes(apps, schema_editor):
    Service = apps.get_model("services", "Service")
    Service.objects.exclude(cancellation_policy_code__isnull=True).exclude(
        cancellation_policy_code=""
    ).update(cancellation_policy_code=None)


class Migration(migrations.Migration):

    dependencies = [
        ("services", "0006_seed_service_categories"),
    ]

    operations = [
        migrations.AddField(
            model_name="service",
            name="cancellation_policy_code",
            field=models.CharField(
                blank=True,
                choices=[
                    ("free_24h", "Free cancellation (24 hours)"),
                    ("free_48h", "Free cancellation (48 hours)"),
                    ("non_refundable", "Non-refundable"),
                ],
                max_length=32,
                null=True,
            ),
        ),
        migrations.RunPython(forwards_backfill_codes, backwards_clear_codes),
    ]
