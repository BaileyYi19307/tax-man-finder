"""
Seed platform service categories and backfill existing Service.category.

Mapping rule (deterministic only):
- Exact case-insensitive match of Service.name to ServiceCategory.name
  (excluding the internal Uncategorized category) → that category
- Otherwise → inactive internal Uncategorized category

No fuzzy / substring / AI mapping in this migration.
"""

from django.db import migrations

from services.category_seed import (
    seed_categories_and_backfill_services,
    unassign_service_categories,
)


class Migration(migrations.Migration):

    dependencies = [
        ("services", "0005_servicecategory_and_nullable_service_category"),
    ]

    operations = [
        migrations.RunPython(
            seed_categories_and_backfill_services,
            unassign_service_categories,
        ),
    ]
