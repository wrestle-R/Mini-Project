"""
OSM / Overpass API adapter.
Queries roads, land-use polygons, and place tags within a given bounding box.
Returns a normalised list of OsmFeature objects.
Results for each bbox are cached in-process for the lifetime of the server.
"""

from __future__ import annotations

import hashlib
import json
from typing import Dict, List

import httpx

from .schemas import BoundingBox, OsmContextResult, OsmFeature

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
CACHE: Dict[str, OsmContextResult] = {}


def _cache_key(bbox: BoundingBox) -> str:
    raw = f"{bbox.min_lat:.4f},{bbox.min_lon:.4f},{bbox.max_lat:.4f},{bbox.max_lon:.4f}"
    return hashlib.md5(raw.encode()).hexdigest()


def _build_query(bbox: BoundingBox, max_road: int, max_landuse: int, max_buildings: int) -> str:
    """Build an Overpass QL query for roads, landuse, buildings, and place nodes."""
    b = f"{bbox.min_lat},{bbox.min_lon},{bbox.max_lat},{bbox.max_lon}"
    return f"""
[out:json][timeout:25];
(
  way["highway"]({b});
  way["landuse"]({b});
  way["building"]({b});
  way["natural"~"water|wood|scrub|heath"]({b});
  way["landuse"~"brownfield|greenfield|construction|vacant"]({b});
  relation["landuse"]({b});
  relation["building"]({b});
  relation["natural"~"water|wood|scrub|heath"]({b});
  node["place"]({b});
);
out geom {max_road + max_landuse + max_buildings + 100};
"""


def _parse_element(el: dict) -> OsmFeature:
    tags = el.get("tags", {})
    geom = None

    if (el.get("type") == "way" or el.get("type") == "relation") and "geometry" in el:
        # Simplistic parsing: for relations/polygons, we just take the outer ring if possible
        # In 'out geom' mode, 'geometry' is often a list of lat/lon
        coords = [[p["lon"], p["lat"]] for p in el["geometry"]]
        if coords and coords[0] == coords[-1] and len(coords) >= 4:
            geom = {"type": "Polygon", "coordinates": [coords]}
        elif coords:
            geom = {"type": "LineString", "coordinates": coords}
    elif el.get("type") == "node":
        geom = {"type": "Point", "coordinates": [el["lon"], el["lat"]]}

    if "highway" in tags:
        feature_type = "road"
    elif "landuse" in tags:
        feature_type = "landuse"
    elif "building" in tags:
        feature_type = "building"
    elif "natural" in tags and tags["natural"] in ["water", "wood"]:
        feature_type = "exclusion"  # Custom type for water/forest
    else:
        feature_type = "place"

    return OsmFeature(feature_type=feature_type, tags=tags, geometry=geom)


async def fetch_osm_context(
    bbox: BoundingBox,
    max_road_results: int = 200,
    max_landuse_results: int = 100,
    max_building_results: int = 200,
) -> OsmContextResult:
    """Fetch and normalise OSM features within bbox. Uses in-process cache."""
    key = _cache_key(bbox)
    if key in CACHE:
        return CACHE[key]

    query = _build_query(bbox, max_road_results, max_landuse_results, max_building_results)

    headers = {
        "User-Agent": "InfraSaathi-GIS-Intelligence/1.0 (Contact: project-infra-saathi@example.com)"
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(OVERPASS_URL, data={"data": query}, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    roads: List[OsmFeature] = []
    landuse: List[OsmFeature] = []
    places: List[OsmFeature] = []
    buildings: List[OsmFeature] = []
    exclusions: List[OsmFeature] = []

    for el in data.get("elements", []):
        feat = _parse_element(el)
        if feat.feature_type == "road":
            roads.append(feat)
        elif feat.feature_type == "landuse":
            landuse.append(feat)
        elif feat.feature_type == "building":
            buildings.append(feat)
        elif feat.feature_type == "exclusion":
            exclusions.append(feat)
        else:
            places.append(feat)

    result = OsmContextResult(
        bbox=bbox,
        roads=roads[:max_road_results],
        landuse=landuse[:max_landuse_results],
        places=places[:50],
        buildings=buildings[:max_building_results],
        exclusions=exclusions[:100],
    )
    CACHE[key] = result
    return result
