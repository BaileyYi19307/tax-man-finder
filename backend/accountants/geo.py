"""Fixed-radius geographic helpers for accountant map discovery (miles)."""

import math

# Centralized MVP defaults — U.S.-oriented directory UI.
DEFAULT_RADIUS_MILES = 25
MIN_RADIUS_MILES = 1
MAX_RADIUS_MILES = 200
EARTH_RADIUS_MILES = 3958.7613


def haversine_miles(lat1, lon1, lat2, lon2):
    """Great-circle distance between two WGS84 points, in miles."""
    phi1, phi2 = math.radians(float(lat1)), math.radians(float(lat2))
    d_phi = math.radians(float(lat2) - float(lat1))
    d_lambda = math.radians(float(lon2) - float(lon1))
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * EARTH_RADIUS_MILES * math.asin(math.sqrt(a))


def parse_radius_miles(raw, *, default=DEFAULT_RADIUS_MILES):
    if raw is None or raw == "":
        return default
    try:
        value = float(raw)
    except (TypeError, ValueError) as exc:
        raise ValueError("radius_miles must be a number.") from exc
    if value < MIN_RADIUS_MILES or value > MAX_RADIUS_MILES:
        raise ValueError(
            f"radius_miles must be between {MIN_RADIUS_MILES} and {MAX_RADIUS_MILES}."
        )
    return value


def parse_coordinate(raw, *, name):
    if raw is None or raw == "":
        raise ValueError(f"{name} is required for geographic search.")
    try:
        value = float(raw)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be a number.") from exc
    return value


def parse_latitude(raw):
    value = parse_coordinate(raw, name="latitude")
    if value < -90 or value > 90:
        raise ValueError("latitude must be between -90 and 90.")
    return value


def parse_longitude(raw):
    value = parse_coordinate(raw, name="longitude")
    if value < -180 or value > 180:
        raise ValueError("longitude must be between -180 and 180.")
    return value


def within_radius(*, center_lat, center_lng, point_lat, point_lng, radius_miles):
    return (
        haversine_miles(center_lat, center_lng, point_lat, point_lng) <= radius_miles
    )
