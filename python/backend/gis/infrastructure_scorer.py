from __future__ import annotations

from shapely.geometry import MultiPolygon, Polygon

from .schemas import InfrastructureMetricSet, InfrastructureSummary, OsmContextResult
from .spatial_utils import geometry_to_local_shape, level_for_score


def _round(value: float | None) -> float | None:
    if value is None:
        return None
    return round(value, 2)


def _nearest_distance(
    land_poly_local: Polygon | MultiPolygon,
    origin_lon: float,
    origin_lat: float,
    features,
    predicate,
) -> float | None:
    best = None
    for feature in features:
        if not predicate(feature):
            continue
        local_shape = geometry_to_local_shape(feature.geometry, origin_lon, origin_lat)
        if local_shape is None:
            continue
        distance = land_poly_local.distance(local_shape)
        best = distance if best is None else min(best, distance)
    return best


def _feature_matches(feature, category: str) -> bool:
    tags = feature.tags
    infra_type = (tags.get("infrastructure_type") or "").lower()
    if infra_type == category:
        return True

    if category == "power":
        return "power" in tags
    if category == "water":
        man_made = (tags.get("man_made") or "").lower()
        return man_made in {"water_tower", "water_works", "reservoir_covered"}
    if category == "sewer":
        man_made = (tags.get("man_made") or "").lower()
        return man_made == "wastewater_plant"
    if category == "telecom":
        communication = (tags.get("communication") or "").lower()
        man_made = (tags.get("man_made") or "").lower()
        return communication in {"tower", "line"} or man_made == "mast"
    if category == "transit":
        return (
            (tags.get("highway") or "").lower() == "bus_stop"
            or (tags.get("amenity") or "").lower() in {"bus_station", "ferry_terminal", "parking"}
        )
    if category == "rail":
        return "railway" in tags
    return False


def assess_infrastructure_context(
    land_poly_local: Polygon | MultiPolygon,
    origin_lon: float,
    origin_lat: float,
    osm: OsmContextResult | None,
    nearest_road_distance_m: float | None,
) -> InfrastructureSummary | None:
    if osm is None:
        return None

    infrastructure = osm.infrastructure
    nearest_power = _nearest_distance(land_poly_local, origin_lon, origin_lat, infrastructure, lambda f: _feature_matches(f, "power"))
    nearest_water = _nearest_distance(land_poly_local, origin_lon, origin_lat, infrastructure, lambda f: _feature_matches(f, "water"))
    nearest_sewer = _nearest_distance(land_poly_local, origin_lon, origin_lat, infrastructure, lambda f: _feature_matches(f, "sewer"))
    nearest_telecom = _nearest_distance(land_poly_local, origin_lon, origin_lat, infrastructure, lambda f: _feature_matches(f, "telecom"))
    nearest_transit = _nearest_distance(land_poly_local, origin_lon, origin_lat, infrastructure, lambda f: _feature_matches(f, "transit"))
    nearest_rail = _nearest_distance(land_poly_local, origin_lon, origin_lat, infrastructure, lambda f: _feature_matches(f, "rail"))

    available_utilities: list[str] = []
    missing_utilities: list[str] = []
    logistics_notes: list[str] = []

    utility_thresholds = {
        "power": (nearest_power, 750.0, "Power corridor is within practical extension range."),
        "water": (nearest_water, 1200.0, "Water infrastructure appears serviceable without a long extension."),
        "sewer": (nearest_sewer, 1500.0, "Sewer or wastewater infrastructure is reasonably close."),
        "telecom": (nearest_telecom, 1000.0, "Telecom infrastructure is nearby for site connectivity."),
    }
    for label, (distance, threshold, note) in utility_thresholds.items():
        if distance is not None and distance <= threshold:
            available_utilities.append(label)
            logistics_notes.append(note)
        else:
            missing_utilities.append(label)

    road_score = 100.0 if nearest_road_distance_m is not None and nearest_road_distance_m <= 50 else 75.0 if nearest_road_distance_m is not None and nearest_road_distance_m <= 150 else 40.0 if nearest_road_distance_m is not None and nearest_road_distance_m <= 500 else 15.0
    transit_score = 100.0 if nearest_transit is not None and nearest_transit <= 400 else 70.0 if nearest_transit is not None and nearest_transit <= 1000 else 35.0 if nearest_transit is not None and nearest_transit <= 2500 else 10.0
    rail_score = 100.0 if nearest_rail is not None and nearest_rail <= 1500 else 65.0 if nearest_rail is not None and nearest_rail <= 5000 else 20.0
    utility_score = min(100.0, len(available_utilities) * 25.0)
    readiness_score = round(road_score * 0.35 + utility_score * 0.4 + max(transit_score, rail_score) * 0.25, 2)

    if nearest_road_distance_m is None:
        logistics_notes.append("Road network could not be measured from the current OSM snapshot.")
    elif nearest_road_distance_m > 150:
        logistics_notes.append("Road extension or upgraded site access may be needed for construction logistics.")

    if nearest_transit is not None and nearest_transit <= 1000:
        logistics_notes.append("Public or shared transport access should support labor mobility.")
    if nearest_rail is not None and nearest_rail <= 5000:
        logistics_notes.append("Rail access exists within a regional freight-support range.")

    return InfrastructureSummary(
        readiness_score=readiness_score,
        readiness_level=level_for_score(readiness_score),
        utility_coverage_level=level_for_score(utility_score),
        transit_access_level=level_for_score(max(transit_score, rail_score)),
        available_utilities=available_utilities,
        missing_utilities=missing_utilities,
        logistics_notes=logistics_notes,
        metrics=InfrastructureMetricSet(
            nearest_power_distance_m=_round(nearest_power),
            nearest_water_infra_distance_m=_round(nearest_water),
            nearest_sewer_distance_m=_round(nearest_sewer),
            nearest_telecom_distance_m=_round(nearest_telecom),
            nearest_transit_distance_m=_round(nearest_transit),
            nearest_rail_distance_m=_round(nearest_rail),
        ),
    )
