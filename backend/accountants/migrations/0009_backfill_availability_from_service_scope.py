"""
Backfill offers_remote / offers_in_person from legacy service_scope.

Mapping (do not infer both modes):
- local → offers_in_person=True
- remote → offers_remote=True
- nationwide → offers_remote=True

Deterministic and safe on an empty database.
"""

from django.db import migrations


def backfill_availability_from_service_scope(apps, schema_editor):
    AccountantProfile = apps.get_model("accountants", "AccountantProfile")

    AccountantProfile.objects.filter(service_scope="local").update(
        offers_in_person=True
    )
    AccountantProfile.objects.filter(service_scope="remote").update(
        offers_remote=True
    )
    AccountantProfile.objects.filter(service_scope="nationwide").update(
        offers_remote=True
    )


def revert_availability_from_service_scope(apps, schema_editor):
    AccountantProfile = apps.get_model("accountants", "AccountantProfile")
    AccountantProfile.objects.update(offers_remote=False, offers_in_person=False)


class Migration(migrations.Migration):

    dependencies = [
        ("accountants", "0008_professional_details"),
    ]

    operations = [
        migrations.RunPython(
            backfill_availability_from_service_scope,
            revert_availability_from_service_scope,
        ),
    ]
