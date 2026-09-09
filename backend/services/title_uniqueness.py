"""
Per-accountant service title uniqueness (application-level).

Titles are compared after collapsing whitespace and casefolding. Display
capitalization is preserved on save (only surrounding whitespace is stripped).
Inactive services are included so accountants reactivate/edit instead of
creating a duplicate historical row.

Database-level uniqueness (e.g. a unique constraint on a normalized title
column per accountant) is intentionally deferred until existing deployed data
has been audited for duplicates — treat that as a post-audit hardening task.
"""

from __future__ import annotations

from .models import Service

DUPLICATE_SERVICE_TITLE_MESSAGE = (
    "You already have a service with this title. "
    "Edit or reactivate the existing service instead."
)


def normalize_service_title_key(name: str) -> str:
    """Comparison key: collapse whitespace, then case-insensitive."""
    return " ".join(str(name or "").split()).casefold()


def find_conflicting_service(
    *,
    accountant,
    name: str,
    exclude_pk=None,
) -> Service | None:
    """
    Return another of this accountant's services whose title matches
    ``name`` under normalize_service_title_key, or None.
    """
    key = normalize_service_title_key(name)
    if not key:
        return None

    qs = Service.objects.filter(accountant=accountant).only("id", "name")
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)

    for service in qs.iterator():
        if normalize_service_title_key(service.name) == key:
            return service
    return None
