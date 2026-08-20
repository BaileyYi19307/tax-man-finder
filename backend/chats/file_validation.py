"""Centralized attachment file validation for Inquiry documents."""

from rest_framework.exceptions import ValidationError

# Max size per file (10 MiB).
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

ALLOWED_EXTENSIONS = frozenset(
    {
        ".pdf",
        ".jpg",
        ".jpeg",
        ".png",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
    }
)

ALLOWED_CONTENT_TYPES = frozenset(
    {
        "application/pdf",
        "image/jpeg",
        "image/png",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        # Some browsers send octet-stream for Office files; extension check still applies.
        "application/octet-stream",
    }
)


def _extension(filename: str) -> str:
    name = (filename or "").rsplit("/", 1)[-1]
    if "." not in name:
        return ""
    return "." + name.rsplit(".", 1)[-1].lower()


def validate_uploaded_file(uploaded_file):
    """Raise ValidationError if the upload is not an allowed tax/accounting document."""
    filename = getattr(uploaded_file, "name", "") or ""
    ext = _extension(filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationError(
            f"File type '{ext or '(none)'}' is not allowed. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}."
        )

    size = getattr(uploaded_file, "size", None)
    if size is not None and size > MAX_ATTACHMENT_BYTES:
        raise ValidationError(
            f"File exceeds the maximum size of {MAX_ATTACHMENT_BYTES // (1024 * 1024)} MB."
        )

    content_type = (getattr(uploaded_file, "content_type", None) or "").lower()
    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        # Prefer extension as source of truth; reject clearly wrong MIME types.
        if content_type.startswith("text/") or content_type.startswith("audio/") or content_type.startswith("video/"):
            raise ValidationError(f"Content type '{content_type}' is not allowed.")

    return uploaded_file
