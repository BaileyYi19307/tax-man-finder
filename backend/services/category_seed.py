"""
Platform service-category seed data and legacy Service backfill helpers.

Used by data migrations and focused tests. Mapping is exact name match only.
"""

MVP_CATEGORIES = [
    {
        "name": "Bookkeeping",
        "slug": "bookkeeping",
        "description": "Ongoing bookkeeping and financial recordkeeping.",
        "is_active": True,
        "sort_order": 10,
    },
    {
        "name": "Individual Tax Services",
        "slug": "individual-tax-services",
        "description": "Personal tax preparation and related individual tax help.",
        "is_active": True,
        "sort_order": 20,
    },
    {
        "name": "Company Tax Services",
        "slug": "company-tax-services",
        "description": "Business and company tax preparation and filing.",
        "is_active": True,
        "sort_order": 30,
    },
    {
        "name": "Consulting",
        "slug": "consulting",
        "description": "Tax and accounting consulting engagements.",
        "is_active": True,
        "sort_order": 40,
    },
    {
        "name": "Accounting Service",
        "slug": "accounting-service",
        "description": "General accounting services.",
        "is_active": True,
        "sort_order": 50,
    },
    {
        "name": "Payroll Services",
        "slug": "payroll-services",
        "description": "Payroll processing and related compliance.",
        "is_active": True,
        "sort_order": 60,
    },
    {
        "name": "Other",
        "slug": "other",
        "description": "Offerings that do not fit another listed category.",
        "is_active": True,
        "sort_order": 70,
    },
]

# Legacy public slugs → current MVP slugs (for data migrations / existing DBs).
LEGACY_CATEGORY_SLUG_REMAP = {
    "individual-tax-returns": "individual-tax-services",
    "small-business-tax-returns": "company-tax-services",
    "tax-planning": "consulting",
    "bookkeeping": "bookkeeping",
    "payroll": "payroll-services",
    "sales-tax": "other",
    "business-formation": "other",
    "irs-notices-and-tax-resolution": "other",
}

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


def _upsert_category(ServiceCategory, row):
    return ServiceCategory.objects.update_or_create(
        slug=row["slug"],
        defaults={
            "name": row["name"],
            "description": row["description"],
            "is_active": row["is_active"],
            "sort_order": row["sort_order"],
        },
    )


def seed_categories_and_backfill_services(apps, schema_editor):
    ServiceCategory = apps.get_model("services", "ServiceCategory")
    Service = apps.get_model("services", "Service")

    for row in MVP_CATEGORIES:
        _upsert_category(ServiceCategory, row)

    uncategorized, _ = _upsert_category(ServiceCategory, UNCATEGORIZED)

    name_to_category = {
        category.name.casefold(): category
        for category in ServiceCategory.objects.exclude(slug="uncategorized").filter(
            is_active=True
        )
    }

    for service in Service.objects.all().iterator():
        matched = name_to_category.get((service.name or "").casefold())
        service.category = matched or uncategorized
        service.save(update_fields=["category"])


def replace_mvp_categories(apps, schema_editor):
    """
    Upsert the current MVP category set, remap services off legacy slugs,
    and deactivate obsolete public categories.
    """
    ServiceCategory = apps.get_model("services", "ServiceCategory")
    Service = apps.get_model("services", "Service")

    for row in MVP_CATEGORIES:
        _upsert_category(ServiceCategory, row)
    _upsert_category(ServiceCategory, UNCATEGORIZED)

    by_slug = {c.slug: c for c in ServiceCategory.objects.all()}
    mvp_slugs = {row["slug"] for row in MVP_CATEGORIES}

    for service in Service.objects.select_related("category").iterator():
        current_slug = getattr(service.category, "slug", None)
        if not current_slug or current_slug == "uncategorized":
            continue
        if current_slug in mvp_slugs:
            continue
        target_slug = LEGACY_CATEGORY_SLUG_REMAP.get(current_slug, "other")
        target = by_slug.get(target_slug) or by_slug.get("other")
        if target and service.category_id != target.id:
            service.category = target
            service.save(update_fields=["category"])

    ServiceCategory.objects.exclude(slug__in=mvp_slugs | {"uncategorized"}).update(
        is_active=False
    )


def unassign_service_categories(apps, schema_editor):
    Service = apps.get_model("services", "Service")
    Service.objects.update(category=None)
