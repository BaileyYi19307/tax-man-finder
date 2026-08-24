# 001 — Accountant map discovery

**Status:** Accepted — implemented (MVP)  
**Date:** 2026-08-20  
**Implemented:** 2026-08-20

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

| Concept | Role in MVP |
| --- | --- |
| Display / free-text location | Shown on profiles and flat directory (`AccountantProfile.location`) |
| Latitude / longitude | Optional; required for map pin and radius search |
| Service mode / scope | Explicit `service_scope` (`local`, `remote`, `nationwide`) |

Fields that exist only for hypothetical future work (for example polygon geometries) are not introduced in this MVP.

---

## Current implementation architecture

The MVP is implemented in the repository as follows.

### Stack

| Concern | Choice |
| --- | --- |
| Map rendering library | Leaflet via `react-leaflet` |
| Basemap tiles | OpenStreetMap tile endpoints (`*.tile.openstreetmap.org`) |
| Place search / geocoding | Nominatim (`nominatim.openstreetmap.org`), proxied by Django |
| Distance units | Miles (`accountants.geo`; default radius 25, max 200) |

Geocoding is isolated in `backend/accountants/geocoding.py` so a later provider change does not require changing the profile domain model. Nominatim requests use `GEOCODER_USER_AGENT` from Django settings.

### Data flow

```text
AccountantProfile.location / latitude / longitude / service_scope
        ↓
GET /accountants/directory/  (+ optional latitude, longitude, radius_miles)
GET /accountants/geocode/?q=
        ↓
AccountantsDirectory React state
  (accountants list, selectedUserId, hovered preview, search center)
        ↓
DirectoryMap (react-leaflet)
   ├── OSM basemap tiles
   ├── CircleMarker pins from profile coordinates
   ├── selected / hovered preview Popup
   └── flyTo on search focus and on accountant selection
```

### Domain storage

- `AccountantProfile.location` — human-readable base/business location string
- `AccountantProfile.latitude` / `longitude` — optional WGS84 coordinates for map eligibility
- `AccountantProfile.service_scope` — `local` | `remote` | `nationwide`
- `is_map_eligible` — derived when both coordinates are present
- On profile save, non-blank `location` is geocoded to refresh coordinates; blank location clears coordinates

Completeness for the flat directory remains bio + credentials + at least one active service. Coordinates and `service_scope` do not affect that rule.

### Directory and geographic API

- `GET /accountants/directory/` — all complete profiles (flat list)
- Same endpoint with `latitude`, `longitude`, and optional `radius_miles` — complete profiles that are map-eligible and within the haversine radius
- `GET /accountants/geocode/?q=` — resolves a place string to coordinates and a display name for map centering
- Public payloads include `latitude`, `longitude`, `service_scope`, `map_eligible`, and active services (including indicative pricing fields used by map preview cards)

### React interaction layer

Primary UI: `frontend/taxmanfinder/src/pages/accountants/AccountantsDirectory.tsx` and `DirectoryMap.tsx`.

| Responsibility | Where it lives |
| --- | --- |
| Flat directory rows | `accountants` from the unfiltered directory fetch (shown when no place search is active) |
| Geographic result rows | After a place search, `mapMatches` from the radius-filtered directory fetch; **list and pins use this same set** |
| Pins shown on the map | Map-eligible rows from the currently visible set (flat list or geographic matches) |
| Selected accountant | `selectedUserId` in `AccountantsDirectory` |
| Temporary hover preview | `hoveredUserId` inside `DirectoryMap` (preview opens for `selectedUserId ?? hoveredUserId`) |
| Search center | Geocode result + optional radius circle; separate from selected accountant |
| List ↔ marker sync | Listing click and marker click both call `selectAccountant` |
| Camera movement | Leaflet `flyTo` via controllers inside `DirectoryMap` (search token vs selection) |
| Preview UI | Leaflet `Popup` with TaxManFinder marketplace card content (name, credentials, firm, location, service, price, Remote/Nationwide) |

Hover opens a temporary preview and allows the pointer to move onto the popup before closing. Click (pin or listing) makes the preview persistent until another accountant is selected or the selection is cleared.

### Provider / rendering layer vs product layer

**Map provider / rendering layer (Leaflet + OSM tiles + Nominatim)** supplies basemap imagery, geographic projection, pan/zoom, marker positioning primitives, and popup/tooltip primitives.

**TaxManFinder product layer** owns accountant directory data, selected and hovered accountant identity, marketplace preview-card content, list ↔ marker synchronization, when the camera should move, and service-scope presentation. Custom marker appearance and card layout are product concerns layered on Leaflet primitives.

Changing visual map products later should primarily affect the rendering/integration layer. The established domain semantics above are intended to stay stable unless product requirements change the geographic model itself.

---

## Consequences

- Existing complete profiles stay visible in the flat directory even if they have no coordinates.
- Without an active place search, the map may show fewer accountants than the flat list until owners have geocodable base locations.
- With an active place/radius search, the list is narrowed to the same geographic matches as the pins (profiles without coordinates cannot appear in that filtered view).
- Fixed-radius search keeps the first API and UI simpler than viewport queries.
- Viewport search can be added later using the same lat/lng fields.
- Remote/nationwide service is represented explicitly, so a pin is not mistaken for a service-area boundary.
- Service-area polygons remain an intentional future enhancement, not part of this decision’s implementation scope.

---

## Future design / enhancement

A future design pass should evaluate whether a more styleable map platform would improve visual control and marketplace interaction quality. **Mapbox** is one example candidate to compare; other providers may be evaluated at the same time. No provider migration has been selected.

That evaluation would explore, among other things:

- more visually polished or branded basemaps
- custom map styles and label hierarchy
- custom accountant marker designs
- richer marketplace-style map cards
- smoother camera transitions
- stronger hover and selected marker states
- overall discovery polish closer to leading marketplace map experiences

Any future provider change should prefer keeping the current domain model: free-text `location`, optional base lat/lng, separate `service_scope`, and map eligibility independent of flat-directory completeness. Presentation and SDK integration should absorb most of the migration cost unless new product requirements genuinely need a different geographic model.

---

## Out of scope for this ADR’s MVP

- Viewport / “search this area” queries
- Service-area polygons or multi-region coverage models
- Changing Inquiry, Booking, or messaging models
- Committing to a specific commercial map-design vendor
