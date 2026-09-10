"""
One-time compatibility backfill for legacy published profiles.

Before languages were required for publish readiness / public visibility,
some profiles could already be publication_status="published" with an empty
languages list. Those rows would otherwise disappear from customer discovery.

Assumption: for already-published profiles with no languages recorded, treat
the historical default as English. This does not apply to drafts, does not
overwrite non-empty languages lists, and does not change publication_status.
New profiles still must supply languages before publishing.
"""

from django.db import migrations


LEGACY_DEFAULT_LANGUAGES = ["English"]


def _languages_empty(value) -> bool:
    if value is None:
        return True
    if isinstance(value, list) and len(value) == 0:
        return True
    return False


def backfill_published_empty_languages(apps, schema_editor):
    AccountantProfile = apps.get_model("accountants", "AccountantProfile")
    for profile in AccountantProfile.objects.filter(
        publication_status="published"
    ).iterator():
        if not _languages_empty(profile.languages):
            continue
        profile.languages = list(LEGACY_DEFAULT_LANGUAGES)
        profile.save(update_fields=["languages"])


def noop_reverse(apps, schema_editor):
    # Irreversible one-time compatibility assumption; do not clear languages.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accountants", "0010_accountantprofile_profile_photo"),
    ]

    operations = [
        migrations.RunPython(backfill_published_empty_languages, noop_reverse),
    ]
