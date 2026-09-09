from __future__ import annotations

from rest_framework.exceptions import ValidationError

from .models import ServiceCategory

UNCATEGORIZED_SLUG = "uncategorized"


def public_category_queryset():
    """Active categories safe for customer/accountant selection."""
    return (
        ServiceCategory.objects.filter(is_active=True)
        .exclude(slug=UNCATEGORIZED_SLUG)
        .order_by("sort_order", "name", "id")
    )


def category_is_assignable(category: ServiceCategory | None) -> bool:
    if category is None:
        return False
    return bool(category.is_active) and category.slug != UNCATEGORIZED_SLUG


def resolve_assignable_category(category_id) -> ServiceCategory:
    """
    Resolve a category_id for assignment.

    Raises DRF ValidationError with a category_id field error for
    missing, nonexistent, inactive, or Uncategorized IDs.
    """
    if category_id is None or category_id == "":
        raise ValidationError(
            {"category_id": "A valid active category is required."}
        )
    try:
        category_pk = int(category_id)
    except (TypeError, ValueError) as exc:
        raise ValidationError(
            {"category_id": "A valid active category is required."}
        ) from exc

    try:
        category = ServiceCategory.objects.get(pk=category_pk)
    except ServiceCategory.DoesNotExist as exc:
        raise ValidationError(
            {"category_id": "Category does not exist."}
        ) from exc

    if category.slug == UNCATEGORIZED_SLUG:
        raise ValidationError(
            {
                "category_id": (
                    "The internal Uncategorized category cannot be assigned."
                )
            }
        )
    if not category.is_active:
        raise ValidationError(
            {"category_id": "Category is not active."}
        )
    return category
