# 001 — Accountant map discovery

**Status:** Accepted — not yet implemented  
**Date:** 2026-08-20

Related: [../decisions.md](../decisions.md) (decision index), [../domain-model.md](../domain-model.md), [../../product/current-requirements.md](../../product/current-requirements.md).

---

## Context

The public accountant directory lists complete profiles and shows a free-text `AccountantProfile.location`. That string is enough for a flat browse experience, but it cannot support reliable map pins or distance search.

We want map-based geographic discovery without rewriting the existing directory and without making existing profiles disappear when coordinates are missing.

An accountant’s base/business location is not the same thing as the area in which they serve clients (for example remote or nationwide practices). Overloading a single `location` field for both concepts would produce incorrect map semantics.

---

## Decision

### Flat list vs map eligibility

- Free-text location remains sufficient for an accountant to appear in the normal flat directory list (subject to existing completeness rules).
- Latitude and longitude are required only for placement on the map.
- Missing coordinates do not remove an accountant from the flat directory.

Map results are therefore a geographic subset of (or overlay on) the flat list: only profiles that have coordinates can appear as pins / in radius results.

### Geographic search (MVP)

- Search is fixed-radius around a user-selected or searched location.
- Example: the user searches “Philadelphia, PA” → the map centers on that place → the API returns accountants within a selected or default radius of that center.
- Viewport-based “search this map area” is out of scope for the MVP. It can be added later without changing the basic coordinate model.

### Remote / nationwide service

- Distinguish **where the accountant is based** from **how/where they serve clients**.
- Remote or nationwide service is shown with an explicit indicator (for example `Remote` / `Nationwide`), not inferred from the map pin.
- Coordinates, when present, represent the accountant’s base/business location, not the full geographic area they serve.
- Service-area polygons are deferred; nationwide service is not modeled as a covering polygon in the MVP.

### Domain separation

Do not overload one `location` field to mean both base location and service geography.

For this MVP it is reasonable to evolve `AccountantProfile` toward:

| Concept | Role in MVP |
| --- | --- |
| Display / free-text location | Shown on profiles and flat directory (existing field can remain) |
| Latitude / longitude | Optional; required for map pin and radius search |
| Service mode / scope | Explicit signal for in-person vs remote / local vs nationwide (only as needed for the Remote/Nationwide indicator) |

Fields that exist only for hypothetical future work (for example polygon geometries) are not introduced in this MVP.

---

## Consequences

- Existing profiles stay visible in the flat directory even if they have no coordinates yet.
- The map may show fewer accountants than the flat list until owners add structured locations.
- Fixed-radius search keeps the first API and UI simpler than viewport queries.
- Viewport search can be added later using the same lat/lng fields.
- Remote service is represented explicitly, so a pin is not mistaken for a service-area boundary.
- Service-area polygons remain an intentional future enhancement, not part of this decision’s implementation scope.

---

## Out of scope for this ADR’s implementation

- Map UI library or geocoding vendor selection (implementation choice)
- Viewport / “search this area” queries
- Service-area polygons or multi-region coverage models
- Changing Inquiry, Booking, or messaging models
