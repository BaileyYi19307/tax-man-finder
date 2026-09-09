"""
Backfill publication_status for existing accountant profiles.

Published only when the profile satisfies publish readiness at migration time:
non-empty (after trim) bio, credentials, and location, plus ≥1 active service
whose category is active and not the internal Uncategorized bucket. All other
profiles remain draft. Deterministic and safe on an empty database.
"""

from django.db import migrations, models
from django.db.models import Exists, F, OuterRef, Q, Value
from django.db.models.functions import Replace, Trim


UNCATEGORIZED_SLUG = "uncategorized"


def _trimmed_text(field_name: str):
    cleaned = F(field_name)
    for ch in ("\t", "\n", "\r"):
        cleaned = Replace(cleaned, Value(ch), Value(""))
    return Trim(cleaned, output_field=models.TextField())


def backfill_publication_status(apps, schema_editor):
    AccountantProfile = apps.get_model("accountants", "AccountantProfile")
    Service = apps.get_model("services", "Service")

    publishable_service = Service.objects.filter(
        accountant_id=OuterRef("user_id"),
        is_active=True,
        category__isnull=False,
        category__is_active=True,
    ).exclude(category__slug=UNCATEGORIZED_SLUG)

    # Trim/replace matches AccountantProfile.is_publish_ready / _has_text semantics.
    ready_ids = list(
        AccountantProfile.objects.annotate(
            _has_publishable_service=Exists(publishable_service),
            _bio_trimmed=_trimmed_text("bio"),
            _credentials_trimmed=_trimmed_text("credentials"),
            _location_trimmed=_trimmed_text("location"),
        )
        .filter(_has_publishable_service=True)
        .exclude(Q(_bio_trimmed__isnull=True) | Q(_bio_trimmed=""))
        .exclude(_credentials_trimmed="")
        .exclude(_location_trimmed="")
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
