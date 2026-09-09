from rest_framework.exceptions import ValidationError

MAX_STRING_LIST_ITEMS = 20
MAX_STRING_LIST_ITEM_LENGTH = 100


def normalize_string_list(value, *, field_name: str) -> list[str]:
    """
    Normalize a JSON list of short strings for profile fields.

    Requires a list when provided; accepts strings only; trims whitespace;
    drops blanks; deduplicates case-insensitively while preserving the first
    readable value.
    """
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValidationError({field_name: "Must be a list."})

    normalized: list[str] = []
    seen: set[str] = set()
    for index, item in enumerate(value):
        if not isinstance(item, str):
            raise ValidationError(
                {field_name: f"Entry at index {index} must be a string."}
            )
        cleaned = item.strip()
        if not cleaned:
            continue
        if len(cleaned) > MAX_STRING_LIST_ITEM_LENGTH:
            raise ValidationError(
                {
                    field_name: (
                        f"Each entry must be at most "
                        f"{MAX_STRING_LIST_ITEM_LENGTH} characters."
                    )
                }
            )
        key = cleaned.casefold()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(cleaned)

    if len(normalized) > MAX_STRING_LIST_ITEMS:
        raise ValidationError(
            {field_name: f"At most {MAX_STRING_LIST_ITEMS} entries are allowed."}
        )
    return normalized
