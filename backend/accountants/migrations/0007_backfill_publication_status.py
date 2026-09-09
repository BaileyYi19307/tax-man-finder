"""
Backfill publication_status for existing accountant profiles.

Published only when the profile satisfies publish readiness at migration time:
non-empty bio, credentials, and location, plus ≥1 active service whose category
is active and not the internal Uncategorized bucket. All other profiles remain
draft. Deterministic and safe on an empty database.
"""

from django.db import migrations
from django.db.models import Exists, OuterRef, Q


UNCATEGORIZED_SLUG = "uncategorized"


def backfill_publication_status(apps, schema_editor):
    AccountantProfile = apps.get_model("accountants", "AccountantProfile")
    Service = apps.get_model("services", "Service")

    publishable_service = Service.objects.filter(
        accountant_id=OuterRef("user_id"),
        is_active=True,
        category__isnull=False,
        category__is_active=True,
    ).exclude(category__slug=UNCATEGORIZED_SLUG)

    ready_ids = list(
        AccountantProfile.objects.annotate(
            _has_publishable_service=Exists(publishable_service)
        )
        .filter(_has_publishable_service=True)
        .exclude(Q(bio__isnull=True) | Q(bio=""))
        .exclude(credentials="")
        .exclude(location="")
        .values_list("id", flat=True)
    )

    if ready_ids:
        AccountantProfile.objects.filter(id__in=ready_ids).update(
            publication_status="published"
        )
    AccountantProfile.objects.exclude(id__in=ready_ids).update(
        publication_status="draft"
    )


def revert_publication_status(apps, schema_editor):
    AccountantProfile = apps.get_model("accountants", "AccountantProfile")
    AccountantProfile.objects.update(publication_status="draft")


class Migration(migrations.Migration):

    dependencies = [
        ("accountants", "0006_publication_status"),
        ("services", "0006_seed_service_categories"),
    ]

    operations = [
        migrations.RunPython(backfill_publication_status, revert_publication_status),
    ]
