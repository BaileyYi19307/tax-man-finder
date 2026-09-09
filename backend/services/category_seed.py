"""
Platform service-category seed data and legacy Service backfill helpers.

Used by data migrations and focused tests. Mapping is exact name match only.
"""

MVP_CATEGORIES = [
    {
        "name": "Individual tax returns",
        "slug": "individual-tax-returns",
        "description": "Personal federal and state tax return preparation.",
        "is_active": True,
        "sort_order": 10,
    },
    {
        "name": "Small-business tax returns",
        "slug": "small-business-tax-returns",
        "description": "Tax returns for small businesses and self-employed filers.",
        "is_active": True,
        "sort_order": 20,
    },
    {
        "name": "Tax planning",
        "slug": "tax-planning",
        "description": "Forward-looking tax strategy and planning advice.",
        "is_active": True,
        "sort_order": 30,
    },
    {
        "name": "Bookkeeping",
        "slug": "bookkeeping",
        "description": "Ongoing bookkeeping and financial recordkeeping.",
        "is_active": True,
        "sort_order": 40,
    },
    {
        "name": "Payroll",
        "slug": "payroll",
        "description": "Payroll processing and related compliance.",
        "is_active": True,
        "sort_order": 50,
    },
    {
        "name": "Sales tax",
        "slug": "sales-tax",
        "description": "Sales tax registration, filing, and compliance.",
        "is_active": True,
        "sort_order": 60,
    },
    {
        "name": "Business formation",
        "slug": "business-formation",
        "description": "Entity formation and related setup guidance.",
        "is_active": True,
        "sort_order": 70,
    },
    {
        "name": "IRS notices and tax resolution",
        "slug": "irs-notices-and-tax-resolution",
        "description": "Help responding to IRS notices and resolving tax issues.",
        "is_active": True,
        "sort_order": 80,
    },
]

UNCATEGORIZED = {
    "name": "Uncategorized",
    "slug": "uncategorized",
    "description": (
        "Internal holding category for legacy offerings that could not be "
        "mapped deterministically. Not shown in customer search."
    ),
    "is_active": False,
    "sort_order": 999,
}


def seed_categories_and_backfill_services(apps, schema_editor):
    ServiceCategory = apps.get_model("services", "ServiceCategory")
    Service = apps.get_model("services", "Service")

    for row in MVP_CATEGORIES:
        ServiceCategory.objects.update_or_create(
            slug=row["slug"],
            defaults={
                "name": row["name"],
                "description": row["description"],
                "is_active": row["is_active"],
                "sort_order": row["sort_order"],
            },
        )

    uncategorized, _ = ServiceCategory.objects.update_or_create(
        slug=UNCATEGORIZED["slug"],
        defaults={
            "name": UNCATEGORIZED["name"],
            "description": UNCATEGORIZED["description"],
            "is_active": UNCATEGORIZED["is_active"],
            "sort_order": UNCATEGORIZED["sort_order"],
        },
    )

    name_to_category = {
        category.name.casefold(): category
        for category in ServiceCategory.objects.exclude(slug="uncategorized")
    }

    for service in Service.objects.all().iterator():
        matched = name_to_category.get((service.name or "").casefold())
        service.category = matched or uncategorized
        service.save(update_fields=["category"])


def unassign_service_categories(apps, schema_editor):
    Service = apps.get_model("services", "Service")
    Service.objects.update(category=None)
