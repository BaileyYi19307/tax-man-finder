"""Accountant profile photo validation and storage helpers."""

from __future__ import annotations

import os
from typing import Optional

from django.core.files.uploadedfile import UploadedFile
from PIL import Image, UnidentifiedImageError
from rest_framework.exceptions import ValidationError as DRFValidationError

MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024

ALLOWED_CONTENT_TYPES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
    }
)

ALLOWED_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp"})

_PIL_FORMAT_TO_EXT = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
}


def accountant_profile_photo_upload_to(instance, filename: str) -> str:
    """Stable path under accountant_profiles/<user_id>/ for the profile photo."""
    user_id = getattr(instance, "user_id", None) or getattr(
        getattr(instance, "user", None), "id", "unknown"
    )
    ext = os.path.splitext(filename or "")[1].lower()
    if ext == ".jpeg":
        ext = ".jpg"
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".jpg"
    return f"accountant_profiles/{user_id}/profile{ext}"


def _extension(filename: str) -> str:
    name = (filename or "").rsplit("/", 1)[-1]
    if "." not in name:
        return ""
    return "." + name.rsplit(".", 1)[-1].lower()


def validate_profile_photo(uploaded: UploadedFile) -> None:
    """
    Reject oversized, wrong-type, or non-image uploads.

    Raises DRF ValidationError with a profile_photo key.
    """
    size = getattr(uploaded, "size", None)
    if size is not None and size > MAX_PROFILE_PHOTO_BYTES:
        raise DRFValidationError(
            {
                "profile_photo": [
                    "Profile photo must be 5 MB or smaller."
                ]
            }
        )

    content_type = (getattr(uploaded, "content_type", None) or "").lower()
    ext = _extension(getattr(uploaded, "name", "") or "")
    if ext == ".jpeg":
        ext = ".jpg"

    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        raise DRFValidationError(
            {
                "profile_photo": [
                    "Profile photo must be a JPEG, PNG, or WebP image."
                ]
            }
        )
    if ext and ext not in ALLOWED_EXTENSIONS:
        raise DRFValidationError(
            {
                "profile_photo": [
                    "Profile photo must be a JPEG, PNG, or WebP image."
                ]
            }
        )

    try:
        uploaded.seek(0)
        with Image.open(uploaded) as image:
            image.verify()
            fmt = (image.format or "").upper()
        uploaded.seek(0)
        with Image.open(uploaded) as image:
            image.load()
            fmt = (image.format or fmt or "").upper()
        uploaded.seek(0)
    except (UnidentifiedImageError, OSError, ValueError):
        raise DRFValidationError(
            {
                "profile_photo": [
                    "Profile photo must be a valid JPEG, PNG, or WebP image."
                ]
            }
        ) from None

    if fmt not in _PIL_FORMAT_TO_EXT:
        raise DRFValidationError(
            {
                "profile_photo": [
                    "Profile photo must be a JPEG, PNG, or WebP image."
                ]
            }
        )


def profile_photo_url(profile, request=None) -> Optional[str]:
    """Public URL for the stored photo, or None. Never returns a filesystem path."""
    photo = getattr(profile, "profile_photo", None)
    if not photo:
        return None
    try:
        name = photo.name
    except Exception:
        return None
    if not name:
        return None
    try:
        url = photo.url
    except ValueError:
        return None
    if request is not None:
        return request.build_absolute_uri(url)
    return url


def _truthy_flag(raw) -> bool:
    if raw is True:
        return True
    if raw is False or raw is None:
        return False
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def apply_profile_photo_update(profile, request) -> None:
    """
    Apply optional multipart photo upload or removal after profile fields save.

    - profile_photo file: validate and replace
    - remove_profile_photo truthy: clear existing photo
    - both together: error
    """
    uploaded = request.FILES.get("profile_photo")
    remove = _truthy_flag(request.data.get("remove_profile_photo"))

    if uploaded is not None and remove:
        raise DRFValidationError(
            {
                "profile_photo": [
                    "Cannot upload and remove a photo in the same request."
                ]
            }
        )

    if uploaded is not None:
        validate_profile_photo(uploaded)
        if profile.profile_photo:
            profile.profile_photo.delete(save=False)
        profile.profile_photo = uploaded
        profile.save(update_fields=["profile_photo", "updated_at"])
        return

    if remove and profile.profile_photo:
        profile.profile_photo.delete(save=False)
        profile.profile_photo = None
        profile.save(update_fields=["profile_photo", "updated_at"])
