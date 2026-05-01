"""
Geometric fit validation for map-aligned model placement.

Given a selected land polygon (lon/lat) and model footprint dimensions (meters),
this module computes:
- fit status (valid/partial/invalid)
- inside vs overflow geometry (for green/red map overlays)
- fit score and utilization
- suggested best rotation angle
- road accessibility and nearby building context
- environmental sensitivity and infrastructure readiness
"""

from __future__ import annotations

import math

from shapely import affinity
from shapely.geometry import GeometryCollection, MultiPolygon, Point, Polygon, mapping, shape
from shapely.ops import nearest_points

from .environmental_scorer import assess_environmental_context
from .infrastructure_scorer import assess_infrastructure_context
from .osm_adapter import fetch_osm_context
from .schemas import BoundingBox, FitValidationRequest, FitValidationResult, RoadAccessResult
from .spatial_utils import (
    flatten_polygonal_area,
    geometry_to_local_shape,
    project_shape_to_local,
    transform_coords_to_lonlat,
)

EPSILON_M2 = 1e-4


def _extract_geojson_geometry(geojson_obj: dict) -> dict:
    """Accept Geometry/Feature/FeatureCollection and return a Geometry mapping."""
    if not isinstance(geojson_obj, dict):
        raise ValueError("GeoJSON payload must be an object")

    gj_type = geojson_obj.get("type")
    if gj_type == "Feature":
        geom = geojson_obj.get("geometry")
        if not isinstance(geom, dict):
            raise ValueError("GeoJSON Feature must include a valid geometry")
        return geom

    if gj_type == "FeatureCollection":
        features = geojson_obj.get("features")
        if not isinstance(features, list) or not features:
            raise ValueError("GeoJSON FeatureCollection must contain at least one feature")
        first = features[0]
        if not isinstance(first, dict) or not isinstance(first.get("geometry"), dict):
            raise ValueError("GeoJSON FeatureCollection has an invalid first feature geometry")
        return first["geometry"]

    return geojson_obj


def _geom_local_to_geojson(
    geom: Polygon | MultiPolygon | GeometryCollection,
    origin_lon: float,
    origin_lat: float,
) -> dict | None:
    if geom.is_empty:
        return None

    gj = mapping(geom)
    if gj.get("type") == "GeometryCollection":
        geoms = gj.get("geometries", [])
        transformed = []
        for item in geoms:
            coords = item.get("coordinates")
            if coords is not None:
                item["coordinates"] = transform_coords_to_lonlat(coords, origin_lon, origin_lat)
            transformed.append(item)
        gj["geometries"] = transformed
    else:
        gj["coordinates"] = transform_coords_to_lonlat(gj.get("coordinates"), origin_lon, origin_lat)
    return gj


def _land_polygon_from_geojson(req: FitValidationRequest) -> tuple[Polygon | MultiPolygon, float, float]:
    land_geom = _extract_geojson_geometry(req.land_geojson)
    land_shape = shape(land_geom)
    if land_shape.is_empty:
        raise ValueError("Selected land polygon is empty")
    if not isinstance(land_shape, (Polygon, MultiPolygon)):
        raise ValueError("Selected land geometry must be Polygon or MultiPolygon")

    lon, lat = req.anchor_lon_lat if req.anchor_lon_lat else (land_shape.centroid.x, land_shape.centroid.y)
    poly = project_shape_to_local(land_shape, lon, lat).buffer(0)
    if poly.is_empty:
        raise ValueError("Selected land polygon becomes invalid after projection")
    return poly, lon, lat


def _model_polygon(width_m: float, depth_m: float, rotation_deg: float, offset_x_m: float, offset_y_m: float) -> Polygon:
    half_w = width_m / 2.0
    half_d = depth_m / 2.0
    rect = Polygon(
        [
            (-half_w, -half_d),
            (half_w, -half_d),
            (half_w, half_d),
            (-half_w, half_d),
            (-half_w, -half_d),
        ]
    )
    rotated = affinity.rotate(rect, rotation_deg, origin=(0, 0), use_radians=False)
    translated = affinity.translate(rotated, xoff=offset_x_m, yoff=offset_y_m)
    return translated.buffer(0)


def _cardinal_direction(dx: float, dy: float) -> str:
    angle = (math.degrees(math.atan2(dy, dx)) + 360.0) % 360.0
    labels = ["east", "north-east", "north", "north-west", "west", "south-west", "south", "south-east"]
    idx = int(((angle + 22.5) % 360.0) // 45.0)
    return labels[idx]


def _max_overflow_distance(overflow_geom: object, land_geom: Polygon | MultiPolygon) -> float:
    if not overflow_geom or getattr(overflow_geom, "is_empty", True):
        return 0.0

    polys = []
    if isinstance(overflow_geom, Polygon):
        polys.append(overflow_geom)
    elif isinstance(overflow_geom, MultiPolygon):
        polys.extend(list(overflow_geom.geoms))
    elif isinstance(overflow_geom, GeometryCollection):
        for geom in overflow_geom.geoms:
            if isinstance(geom, Polygon):
                polys.append(geom)
            elif isinstance(geom, MultiPolygon):
                polys.extend(list(geom.geoms))

    max_distance = 0.0
    for geom in polys:
        for x, y in geom.exterior.coords:
            point = Point(x, y)
            if land_geom.contains(point) or land_geom.touches(point):
                continue
            nearest = nearest_points(point, land_geom.boundary)[1]
            max_distance = max(max_distance, point.distance(nearest))
    return max_distance


def _evaluate_rotation(
    land_poly: Polygon | MultiPolygon,
    width_m: float,
    depth_m: float,
    rotation_deg: float,
    offset_x_m: float,
    offset_y_m: float,
) -> dict:
    model_poly = _model_polygon(width_m, depth_m, rotation_deg, offset_x_m, offset_y_m)
    model_area = model_poly.area
    inside_geom = model_poly.intersection(land_poly)
    overflow_geom = model_poly.difference(land_poly)
    inside_area = inside_geom.area
    overflow_area = overflow_geom.area
    fit_score = 0.0 if model_area <= EPSILON_M2 else (inside_area / model_area) * 100.0
    objective = fit_score - (overflow_area * 0.001)
    return {
        "model_poly": model_poly,
        "inside_geom": inside_geom,
        "overflow_geom": overflow_geom,
        "inside_area": inside_area,
        "overflow_area": overflow_area,
        "fit_score": fit_score,
        "objective": objective,
    }


def _optimize_rotation(land_poly: Polygon | MultiPolygon, width_m: float, depth_m: float, offset_x_m: float, offset_y_m: float) -> float:
    best_angle = 0.0
    best_eval = _evaluate_rotation(land_poly, width_m, depth_m, 0.0, offset_x_m, offset_y_m)

    for angle in range(0, 360, 5):
        curr = _evaluate_rotation(land_poly, width_m, depth_m, float(angle), offset_x_m, offset_y_m)
        if curr["objective"] > best_eval["objective"]:
            best_eval = curr
            best_angle = float(angle)

    start = int(best_angle) - 5
    end = int(best_angle) + 5
    for angle in range(start, end + 1):
        wrapped = float(angle % 360)
        curr = _evaluate_rotation(land_poly, width_m, depth_m, wrapped, offset_x_m, offset_y_m)
        if curr["objective"] > best_eval["objective"]:
            best_eval = curr
            best_angle = wrapped

    return best_angle


def _min_distance_to_features(land_poly_local: Polygon | MultiPolygon, features, origin_lon: float, origin_lat: float) -> float | None:
    min_distance = None
    for feature in features:
        local_shape = geometry_to_local_shape(feature.geometry, origin_lon, origin_lat)
        if local_shape is None:
            continue
        distance = land_poly_local.distance(local_shape)
        min_distance = distance if min_distance is None else min(min_distance, distance)
    return min_distance


def _road_access_result(
    land_poly_local: Polygon | MultiPolygon,
    origin_lon: float,
    origin_lat: float,
    osm,
    road_warning_distance_m: float,
) -> RoadAccessResult:
    if osm is None:
        return RoadAccessResult(
            nearest_road_distance_m=None,
            has_road_access=False,
            warning="Road accessibility check is temporarily unavailable because OSM data could not be fetched.",
        )
    if not osm.roads:
        return RoadAccessResult(
            nearest_road_distance_m=None,
            has_road_access=False,
            warning="No nearby OSM road features were found for the selected parcel.",
        )

    min_distance = _min_distance_to_features(land_poly_local, osm.roads, origin_lon, origin_lat)
    if min_distance is None:
        return RoadAccessResult(
            nearest_road_distance_m=None,
            has_road_access=False,
            warning="OSM roads were returned but no valid geometry could be measured.",
        )

    has_access = min_distance <= road_warning_distance_m
    return RoadAccessResult(
        nearest_road_distance_m=round(min_distance, 2),
        has_road_access=has_access,
        warning=None if has_access else f"No nearby road access: nearest known road is {min_distance:.1f} m away (threshold {road_warning_distance_m:.1f} m).",
    )


def _building_access_result(
    land_poly_local: Polygon | MultiPolygon,
    origin_lon: float,
    origin_lat: float,
    osm,
    nearby_building_distance_m: float,
) -> RoadAccessResult:
    if osm is None:
        return RoadAccessResult(
            nearest_road_distance_m=None,
            has_road_access=False,
            warning="Nearby building check is temporarily unavailable because OSM data could not be fetched.",
        )
    if not osm.buildings:
        return RoadAccessResult(
            nearest_road_distance_m=None,
            has_road_access=False,
            warning="No nearby OSM building features were found for the selected parcel.",
        )

    min_distance = _min_distance_to_features(land_poly_local, osm.buildings, origin_lon, origin_lat)
    if min_distance is None:
        return RoadAccessResult(
            nearest_road_distance_m=None,
            has_road_access=False,
            warning="OSM buildings were returned but no valid geometry could be measured.",
        )

    has_context = min_distance <= nearby_building_distance_m
    return RoadAccessResult(
        nearest_road_distance_m=round(min_distance, 2),
        has_road_access=has_context,
        warning=None if has_context else f"No nearby building context: nearest known building is {min_distance:.1f} m away (threshold {nearby_building_distance_m:.1f} m).",
    )


async def validate_fit(req: FitValidationRequest) -> FitValidationResult:
    land_poly, origin_lon, origin_lat = _land_polygon_from_geojson(req)

    width_m = req.model_dimensions.width_m
    depth_m = req.model_dimensions.depth_m
    model_area = width_m * depth_m
    land_area = land_poly.area

    min_lon_ll, min_lat_ll, max_lon_ll, max_lat_ll = shape(_extract_geojson_geometry(req.land_geojson)).bounds
    pad = 0.01
    bbox_ll = BoundingBox(
        min_lon=min_lon_ll - pad,
        min_lat=min_lat_ll - pad,
        max_lon=max_lon_ll + pad,
        max_lat=max_lat_ll + pad,
    )
    try:
        osm = await fetch_osm_context(bbox=bbox_ll, max_road_results=400, max_building_results=500)
    except Exception:
        osm = None

    eval_at_requested = _evaluate_rotation(
        land_poly=land_poly,
        width_m=width_m,
        depth_m=depth_m,
        rotation_deg=req.rotation_deg,
        offset_x_m=req.placement_offset_x_m,
        offset_y_m=req.placement_offset_y_m,
    )

    model_poly = eval_at_requested["model_poly"]
    suggested_rotation = req.rotation_deg
    if req.optimize_rotation:
        suggested_rotation = _optimize_rotation(
            land_poly=land_poly,
            width_m=width_m,
            depth_m=depth_m,
            offset_x_m=req.placement_offset_x_m,
            offset_y_m=req.placement_offset_y_m,
        )

    overflow_area = eval_at_requested["overflow_area"]
    inside_area = eval_at_requested["inside_area"]
    fit_score = eval_at_requested["fit_score"]
    utilization = 0.0 if land_area <= EPSILON_M2 else (model_area / land_area) * 100.0

    if overflow_area <= EPSILON_M2:
        fit_status = "valid"
    elif inside_area > EPSILON_M2:
        fit_status = "partial"
    else:
        fit_status = "invalid"

    utilization_class = "optimal"
    if utilization < 50:
        utilization_class = "underutilized"
    elif utilization <= 80:
        utilization_class = "moderate"

    overflow_direction = None
    overflow_distance = 0.0
    if overflow_area > EPSILON_M2:
        overflow_centroid = eval_at_requested["overflow_geom"].centroid
        land_centroid = land_poly.centroid
        overflow_direction = _cardinal_direction(
            overflow_centroid.x - land_centroid.x,
            overflow_centroid.y - land_centroid.y,
        )
        overflow_distance = _max_overflow_distance(eval_at_requested["overflow_geom"], land_poly)

    inside_geojson = _geom_local_to_geojson(eval_at_requested["inside_geom"], origin_lon, origin_lat)
    overflow_geojson = _geom_local_to_geojson(eval_at_requested["overflow_geom"], origin_lon, origin_lat)

    road_access = _road_access_result(land_poly, origin_lon, origin_lat, osm, req.road_warning_distance_m)
    nearby_building_access = _building_access_result(
        land_poly,
        origin_lon,
        origin_lat,
        osm,
        req.nearby_building_distance_m,
    )

    has_building_collision = False
    has_water_collision = False
    if osm:
        for building in osm.buildings:
            building_shape = geometry_to_local_shape(building.geometry, origin_lon, origin_lat)
            if building_shape and building_shape.intersects(model_poly):
                overlap = flatten_polygonal_area(building_shape.intersection(model_poly))
                if overlap > 1.0:
                    has_building_collision = True
                    break

        for feature in osm.exclusions:
            natural_tag = (feature.tags.get("natural") or "").lower()
            if natural_tag not in {"water", "wetland", "riverbank"}:
                continue
            water_shape = geometry_to_local_shape(feature.geometry, origin_lon, origin_lat)
            if water_shape and water_shape.intersects(model_poly):
                overlap = flatten_polygonal_area(water_shape.intersection(model_poly))
                if overlap > 1.0:
                    has_water_collision = True
                    break

    environmental_summary = assess_environmental_context(land_poly, model_poly, origin_lon, origin_lat, osm)
    infrastructure_summary = assess_infrastructure_context(
        land_poly,
        origin_lon,
        origin_lat,
        osm,
        road_access.nearest_road_distance_m,
    )

    messages: list[str] = []
    if has_building_collision:
        fit_status = "invalid"
        messages.append("CRITICAL: Model footprint overlaps with an existing building on the map.")
    if has_water_collision:
        fit_status = "invalid"
        messages.append("CRITICAL: Model footprint overlaps with a water body.")

    if fit_status == "valid":
        messages.append("Model footprint fits fully inside the selected land polygon.")
    elif fit_status == "partial":
        messages.append("Model footprint partially overlaps land boundary.")
    elif not has_building_collision and not has_water_collision:
        messages.append("Model footprint does not fit the selected land polygon.")

    if overflow_direction and overflow_distance > 0:
        messages.append(f"Boundary exceedance detected towards {overflow_direction} by up to {overflow_distance:.1f} m.")

    if utilization_class == "underutilized":
        messages.append(f"Low utilization: only {utilization:.1f}% of land is used.")
    elif utilization_class == "moderate":
        messages.append(f"Moderate utilization: {utilization:.1f}% land usage.")

    if road_access.warning:
        messages.append(road_access.warning)
    if nearby_building_access.warning:
        messages.append(nearby_building_access.warning)
    if environmental_summary:
        if environmental_summary.constraints:
            messages.extend(environmental_summary.constraints[:2])
        else:
            messages.append(
                f"Environmental suitability is {environmental_summary.suitability_score:.1f}/100 with {environmental_summary.flood_risk_level} flood risk."
            )
    if infrastructure_summary:
        messages.append(
            f"Infrastructure readiness is {infrastructure_summary.readiness_score:.1f}/100 with {infrastructure_summary.utility_coverage_level} utility coverage."
        )

    return FitValidationResult(
        fit_status=fit_status,
        fit_score=round(fit_score, 2),
        inside_area_sqm=round(inside_area, 2),
        overflow_area_sqm=round(overflow_area, 2),
        model_footprint_area_sqm=round(model_area, 2),
        land_area_sqm=round(land_area, 2),
        utilization_ratio=round(utilization, 2),
        utilization_class=utilization_class,
        overflow_direction=overflow_direction,
        overflow_distance_m=round(overflow_distance, 2),
        suggested_rotation_deg=round(suggested_rotation, 2),
        road_access=road_access,
        nearby_building_access=nearby_building_access,
        has_building_collision=has_building_collision,
        has_water_collision=has_water_collision,
        environmental_summary=environmental_summary,
        infrastructure_summary=infrastructure_summary,
        inside_geometry=inside_geojson,
        overflow_geometry=overflow_geojson,
        messages=messages,
    )
