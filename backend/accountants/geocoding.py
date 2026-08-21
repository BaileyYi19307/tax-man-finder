"""Nominatim geocoding for MVP map discovery (no API key).

Isolated so a later provider swap does not touch the profile/domain model.
"""

from __future__ import annotations

import logging
from urllib.parse import urlencode

from django.conf import settings

logger = logging.getLogger(__name__)


def geocode_query(query: str) -> dict | None:
    """
    Resolve a free-text place to WGS84 coordinates.

    Returns {"latitude", "longitude", "display_name"} or None if not found / unavailable.
    """
    cleaned = (query or "").strip()
    if not cleaned:
        return None

    # Avoid treating pure service-mode labels as places.
    if cleaned.lower() in {"remote", "nationwide", "n/a", "na"}:
        return None

    params = urlencode(
        {
            "q": cleaned,
            "format": "json",
            "limit": 1,
        }
    )
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    user_agent = getattr(
        settings,
        "GEOCODER_USER_AGENT",
        "TaxManFinder/0.1 (local development; contact via project repo)",
    )

    try:
        import urllib.request

        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": user_agent,
                "Accept": "application/json",
            },
            method="GET",
        )
        with urllib.request.urlopen(request, timeout=8) as response:
            import json

            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        logger.exception("Nominatim geocode failed for query=%r", cleaned)
        return None

    if not payload:
        return None

    hit = payload[0]
    try:
        lat = float(hit["lat"])
        lng = float(hit["lon"])
    except (KeyError, TypeError, ValueError):
        return None

    return {
        "latitude": lat,
        "longitude": lng,
        "display_name": hit.get("display_name") or cleaned,
    }
