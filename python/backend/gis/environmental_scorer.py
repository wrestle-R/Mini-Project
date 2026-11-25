from __future__ import annotations

from typing import Iterable

from shapely.geometry import MultiPolygon, Polygon

from .schemas import EnvironmentalMetricSet, EnvironmentalSummary, OsmContextResult
from .spatial_utils import flatten_polygonal_area, geometry_to_local_shape, level_for_score, risk_level_for_score

FOREST_NATURAL_TAGS = {"wood", "forest", "scrub", "heath", "tree_row"}
WATER_NATURAL_TAGS = {"water", "wetland", "riverbank"}
SENSITIVE_LANDUSE_TAGS = {"forest", "conservation", "reservoir", "basin"}
HAZARDOUS_LANDUSE_TAGS = {"industrial", "landfill", "quarry", "brownfield", "construction", "military"}


def _round(value: float | None) -> float | None:
    if value is None:
        return None
    return round(value, 2)


def _update_min_distance(current: float | None, candidate: float | None) -> float | None:
    if candidate is None:
        return current
    if current is None:
        return candidate
    return min(current, candidate)


def assess_environmental_context(
    land_poly_local: Polygon | MultiPolygon,
    model_poly_local: Polygon,
    origin_lon: float,
    origin_lat: float,
    osm: OsmContextResult | None,
) -> EnvironmentalSummary | None:
    if osm is None:
        return None

    land_area = max(land_poly_local.area, 1.0)
    water_distance = None
    forest_distance = None
    wetland_distance = None
    natural_cover_area = 0.0
    water_overlap_area = 0.0
    protected_overlap_area = 0.0
    hazardous_landuse_count = 0
    nearby_features: list[str] = []
    constraints: list[str] = []
    opportunities: list[str] = []

    for feature in osm.exclusions:
        local_shape = geometry_to_local_shape(feature.geometry, origin_lon, origin_lat)
        if local_shape is None:
            continue

        natural_tag = (feature.tags.get("natural") or "").lower()
        landuse_tag = (feature.tags.get("landuse") or "").lower()
        distance_to_land = land_poly_local.distance(local_shape)

        if natural_tag in WATER_NATURAL_TAGS:
            water_distance = _update_min_distance(water_distance, distance_to_land)
            if distance_to_land <= 250:
                nearby_features.append("water body")
            overlap = land_poly_local.intersection(local_shape)
            water_overlap_area += flatten_polygonal_area(overlap)
            if natural_tag == "wetland":
                wetland_distance = _update_min_distance(wetland_distance, distance_to_land)
        if natural_tag in FOREST_NATURAL_TAGS:
            forest_distance = _update_min_distance(forest_distance, distance_to_land)
            if distance_to_land <= 250:
                nearby_features.append("forest cover")

        if natural_tag in FOREST_NATURAL_TAGS or natural_tag in WATER_NATURAL_TAGS or landuse_tag in SENSITIVE_LANDUSE_TAGS:
            overlap = land_poly_local.intersection(local_shape)
            protected_overlap_area += flatten_polygonal_area(overlap)
            natural_cover_area += flatten_polygonal_area(overlap)

    for landuse in osm.landuse:
        landuse_tag = (landuse.tags.get("landuse") or "").lower()
        local_shape = geometry_to_local_shape(landuse.geometry, origin_lon, origin_lat)
        if local_shape is None:
            continue
        if landuse_tag in HAZARDOUS_LANDUSE_TAGS and land_poly_local.buffer(500).intersects(local_shape):
            hazardous_landuse_count += 1
        if landuse_tag in {"grass", "meadow", "greenfield", "farmland", "orchard"}:
            natural_cover_area += flatten_polygonal_area(land_poly_local.intersection(local_shape))

    natural_cover_ratio = min(1.0, natural_cover_area / land_area)
    flood_risk_score = 0.0
    if water_overlap_area > 1.0:
        flood_risk_score = 95.0
    elif water_distance is not None and water_distance < 75:
        flood_risk_score = 82.0
    elif water_distance is not None and water_distance < 150:
        flood_risk_score = 64.0
    elif water_distance is not None and water_distance < 300:
        flood_risk_score = 42.0

    biodiversity_score = min(
        100.0,
        natural_cover_ratio * 70.0
        + (18.0 if forest_distance is not None and forest_distance < 250 else 0.0)
        + (12.0 if wetland_distance is not None and wetland_distance < 300 else 0.0),
    )
    hazard_penalty = min(35.0, hazardous_landuse_count * 10.0)
    environmental_suitability = max(
        0.0,
        min(100.0, 82.0 - flood_risk_score * 0.45 - biodiversity_score * 0.18 - hazard_penalty + natural_cover_ratio * 18.0),
    )

    if water_overlap_area > 1.0:
        constraints.append("Parcel overlaps a mapped water feature and will likely require exclusion or redesign.")
    elif water_distance is not None and water_distance < 100:
        constraints.append("Water body is within 100 m, so flood resilience and drainage design should be treated as critical.")
    if wetland_distance is not None and wetland_distance < 250:
        constraints.append("Wetland context is nearby; expect additional ecological review before approvals.")
    if hazardous_landuse_count:
        constraints.append(f"{hazardous_landuse_count} potentially incompatible land-use feature(s) were detected within 500 m.")

    if forest_distance is not None and forest_distance < 400:
        opportunities.append("Nearby tree cover can improve microclimate and visual buffering if setbacks are respected.")
    if natural_cover_ratio < 0.1:
        opportunities.append("Low ecological encumbrance leaves room for planned landscaping and stormwater upgrades.")
    if water_distance is not None and 150 <= water_distance <= 500:
        opportunities.append("Water access is close enough for amenity value without immediate edge overlap.")

    if not nearby_features and water_distance is None and forest_distance is None:
        nearby_features.append("limited mapped ecological features")

    return EnvironmentalSummary(
        suitability_score=round(environmental_suitability, 2),
        sensitivity_level=risk_level_for_score(max(flood_risk_score, biodiversity_score * 0.75, hazard_penalty * 2)),
        flood_risk_level=risk_level_for_score(flood_risk_score),
        biodiversity_level=level_for_score(biodiversity_score),
        constraints=constraints,
        opportunities=opportunities,
        nearby_features=sorted(set(nearby_features)),
        metrics=EnvironmentalMetricSet(
            nearest_water_distance_m=_round(water_distance),
            nearest_forest_distance_m=_round(forest_distance),
            nearest_wetland_distance_m=_round(wetland_distance),
            natural_cover_ratio=round(natural_cover_ratio, 3),
            water_overlap_area_sqm=round(water_overlap_area, 2),
            protected_overlap_area_sqm=round(protected_overlap_area, 2),
            hazardous_landuse_count=hazardous_landuse_count,
        ),
    )
