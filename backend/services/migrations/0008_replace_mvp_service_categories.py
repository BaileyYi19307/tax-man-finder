"""
Replace MVP service categories with the revised public set and remap
services off legacy category slugs.
"""

from django.db import migrations

from services.category_seed import replace_mvp_categories


def noop_reverse(apps, schema_editor):
    """Legacy category rows are left inactive; no automatic restore."""


class Migration(migrations.Migration):

    dependencies = [
        ("services", "0007_service_cancellation_policy_code"),
    ]

    operations = [
        migrations.RunPython(replace_mvp_categories, noop_reverse),
    ]
