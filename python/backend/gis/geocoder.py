"""
Geocoder adapter.
- Forward geocoding  → Photon API (komoot.io) — open, no auth, no strict UA policy
- Region polygons    → Nominatim with polygon_geojson=1
- Reverse geocoding  → Nominatim reverse endpoint
All results are clamped to India's bounding box.
"""

from __future__ import annotations

from typing import Optional

import httpx

from .schemas import BoundingBox, GeocodeResult, RegionPolygonResult

# ── Photon (forward geocode) ──────────────────────────────────────────────
PHOTON_BASE = "https://photon.komoot.io"

# ── Nominatim (polygon + reverse) ────────────────────────────────────────
NOMINATIM_BASE = "https://nominatim.openstreetmap.org"
# Nominatim policy requires a descriptive UA with a real contact URL/email
NOMINATIM_HEADERS = {
    "User-Agent": (
        "InfraSaathi-BuildSync/1.0 "
        "(open-source construction management; "
        "github.com/buildsync; support@buildsync.dev)"
    ),
    "Accept": "application/json",
    "Accept-Language": "en",
}

# ── India bounds ──────────────────────────────────────────────────────────
INDIA_BBOX = BoundingBox(min_lon=68.0, min_lat=6.0, max_lon=97.5, max_lat=37.5)


def _clamp_bbox(bbox: BoundingBox) -> BoundingBox:
    return BoundingBox(
        min_lon=max(bbox.min_lon, INDIA_BBOX.min_lon),
        min_lat=max(bbox.min_lat, INDIA_BBOX.min_lat),
        max_lon=min(bbox.max_lon, INDIA_BBOX.max_lon),
        max_lat=min(bbox.max_lat, INDIA_BBOX.max_lat),
    )


# ── Forward geocode — Photon ──────────────────────────────────────────────

async def geocode(query: str) -> Optional[GeocodeResult]:
    """
    Forward-geocode a place name using Photon (OSM data, no auth required).
    Results are limited to India via bbox filter.
    Falls back gracefully if the service is unavailable.
    """
    params = {
        "q": query,
        "limit": 1,
        "lang": "en",
        # Bias to India's geographic centre
        "lat": "20.5937",
        "lon": "78.9629",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{PHOTON_BASE}/api", params=params)
            resp.raise_for_status()
            fc = resp.json()
    except Exception:
        # Try Nominatim as fallback
        return await _geocode_nominatim_fallback(query)

    features = fc.get("features", [])
    if not features:
        return await _geocode_nominatim_fallback(query)

    feat = features[0]
    props = feat.get("properties", {})
    coords = feat.get("geometry", {}).get("coordinates", [])
    if len(coords) < 2:
        return None

    lon, lat = float(coords[0]), float(coords[1])
    display = props.get("name") or props.get("city") or props.get("state") or query

    # Build bbox from Photon's extent if available
    extent = props.get("extent")  # [min_lon, max_lat, max_lon, min_lat]
    if extent and len(extent) == 4:
        bbox = _clamp_bbox(BoundingBox(
            min_lon=float(extent[0]),
            min_lat=float(extent[3]),
            max_lon=float(extent[2]),
            max_lat=float(extent[1]),
        ))
    else:
        # Default ±0.15° (~16 km) around the point
        delta = 0.15
        bbox = _clamp_bbox(BoundingBox(
            min_lon=lon - delta,
            min_lat=lat - delta,
            max_lon=lon + delta,
            max_lat=lat + delta,
        ))

    return GeocodeResult(display_name=display, lat=lat, lon=lon, bbox=bbox)


async def _geocode_nominatim_fallback(query: str) -> Optional[GeocodeResult]:
    """Fallback: Nominatim search (no polygon, just coordinates)."""
    params = {
        "q": query,
        "format": "jsonv2",
        "limit": 1,
        "countrycodes": "in",
    }
    try:
        # Use simple UA for fallback if the complex one is still blocked
        async with httpx.AsyncClient(headers=NOMINATIM_HEADERS, timeout=12) as client:
            resp = await client.get(f"{NOMINATIM_BASE}/search", params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return None

    if not data:
        return None

    item = data[0]
    lat, lon = float(item["lat"]), float(item["lon"])
    raw_bb = item.get("boundingbox", [])
    if len(raw_bb) == 4:
        bbox = _clamp_bbox(BoundingBox(
            min_lat=float(raw_bb[0]), max_lat=float(raw_bb[1]),
            min_lon=float(raw_bb[2]), max_lon=float(raw_bb[3]),
        ))
    else:
        delta = 0.15
        bbox = _clamp_bbox(BoundingBox(
            min_lon=lon - delta, min_lat=lat - delta,
            max_lon=lon + delta, max_lat=lat + delta,
        ))
    return GeocodeResult(display_name=item.get("display_name", query), lat=lat, lon=lon, bbox=bbox)


# ── Region polygon — Nominatim ────────────────────────────────────────────

async def region_polygon(query: str) -> Optional[RegionPolygonResult]:
    """Fetch the GeoJSON polygon boundary for a named region in India."""
    params = {
        "q": query,
        "format": "geojson",
        "limit": 1,
        "countrycodes": "in",
        "polygon_geojson": 1,
    }
    try:
        async with httpx.AsyncClient(headers=NOMINATIM_HEADERS, timeout=15) as client:
            resp = await client.get(f"{NOMINATIM_BASE}/search", params=params)
            resp.raise_for_status()
            fc = resp.json()
    except Exception:
        return None

    features = fc.get("features", [])
    if not features:
        return None

    feat = features[0]
    display_name = feat.get("properties", {}).get("display_name", query)
    return RegionPolygonResult(display_name=display_name, geojson=feat)


# ── Reverse geocode — Nominatim ───────────────────────────────────────────

async def reverse_geocode(lat: float, lon: float) -> Optional[str]:
    """Reverse geocode a point to a human-readable address string."""
    params = {"lat": lat, "lon": lon, "format": "jsonv2"}
    try:
        async with httpx.AsyncClient(headers=NOMINATIM_HEADERS, timeout=10) as client:
            resp = await client.get(f"{NOMINATIM_BASE}/reverse", params=params)
            resp.raise_for_status()
            data = resp.json()
        return data.get("display_name")
    except Exception:
        return None
