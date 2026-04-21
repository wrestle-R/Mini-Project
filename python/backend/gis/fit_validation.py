"""
Geometric fit validation for map-aligned model placement.

Given a selected land polygon (lon/lat) and model footprint dimensions (meters),
this module computes:
- fit status (valid/partial/invalid)
- inside vs overflow geometry (for green/red map overlays)
- fit score and utilization
- suggested best rotation angle
- road accessibility warning from OSM road data
"""

from __future__ import annotations

import math
from typing import Iterable

from shapely import affinity
from shapely.geometry import GeometryCollection, LineString, MultiPolygon, Point, Polygon, shape, mapping
from shapely.ops import nearest_points

from .osm_adapter import fetch_osm_context
from .schemas import (
    BoundingBox,
    FitValidationRequest,
    FitValidationResult,
    RoadAccessResult,
)

EARTH_RADIUS_M = 6_371_000.0
EPSILON_M2 = 1e-4


def _to_local_xy(lon: float, lat: float, origin_lon: float, origin_lat: float) -> tuple[float, float]:
    lon_rad = math.radians(lon)
    lat_rad = math.radians(lat)
    origin_lon_rad = math.radians(origin_lon)
    origin_lat_rad = math.radians(origin_lat)

    x = (lon_rad - origin_lon_rad) * math.cos(origin_lat_rad) * EARTH_RADIUS_M
    y = (lat_rad - origin_lat_rad) * EARTH_RADIUS_M
    return x, y


def _to_lon_lat(x: float, y: float, origin_lon: float, origin_lat: float) -> tuple[float, float]:
    origin_lon_rad = math.radians(origin_lon)
    origin_lat_rad = math.radians(origin_lat)

    lat_rad = origin_lat_rad + (y / EARTH_RADIUS_M)
    lon_rad = origin_lon_rad + (x / (EARTH_RADIUS_M * math.cos(origin_lat_rad)))
    return math.degrees(lon_rad), math.degrees(lat_rad)


def _transform_coords_to_lonlat(coords: object, origin_lon: float, origin_lat: float) -> object:
    if isinstance(coords, (list, tuple)):
        if len(coords) == 2 and all(isinstance(v, (int, float)) for v in coords):
            lon, lat = _to_lon_lat(float(coords[0]), float(coords[1]), origin_lon, origin_lat)
            return [lon, lat]
        return [_transform_coords_to_lonlat(c, origin_lon, origin_lat) for c in coords]
    return coords


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
        for g in geoms:
            coords = g.get("coordinates")
            if coords is not None:
                g["coordinates"] = _transform_coords_to_lonlat(coords, origin_lon, origin_lat)
            transformed.append(g)
        gj["geometries"] = transformed
    else:
        gj["coordinates"] = _transform_coords_to_lonlat(gj.get("coordinates"), origin_lon, origin_lat)
    return gj


def _land_polygon_from_geojson(req: FitValidationRequest) -> tuple[Polygon, float, float]:
    land_shape = shape(req.land_geojson)
    if land_shape.is_empty:
        raise ValueError("Selected land polygon is empty")

    if not isinstance(land_shape, (Polygon, MultiPolygon)):
        raise ValueError("Selected land geometry must be Polygon or MultiPolygon")

    lon, lat = req.anchor_lon_lat if req.anchor_lon_lat else (land_shape.centroid.x, land_shape.centroid.y)

    def project_ring(ring: Iterable[tuple[float, float]]) -> list[tuple[float, float]]:
        return [_to_local_xy(p[0], p[1], lon, lat) for p in ring]

    if isinstance(land_shape, Polygon):
        shell = project_ring(land_shape.exterior.coords)
        holes = [project_ring(h.coords) for h in land_shape.interiors]
        poly = Polygon(shell, holes).buffer(0)
    else:
        polys = []
        for p in land_shape.geoms:
            shell = project_ring(p.exterior.coords)
            holes = [project_ring(h.coords) for h in p.interiors]
            polys.append(Polygon(shell, holes).buffer(0))
        poly = MultiPolygon(polys).buffer(0)

    from shapely.validation import make_valid
    poly = make_valid(poly)

    if poly.is_empty:
        raise ValueError("Selected land polygon becomes invalid after projection")

    return poly, lon, lat



def _model_polygon(width_m: float, depth_m: float, rotation_deg: float, offset_x_m: float, offset_y_m: float) -> Polygon:
    half_w = width_m / 2.0
    half_d = depth_m / 2.0
    rect = Polygon([
        (-half_w, -half_d),
        (half_w, -half_d),
        (half_w, half_d),
        (-half_w, half_d),
        (-half_w, -half_d),
    ])
    rotated = affinity.rotate(rect, rotation_deg, origin=(0, 0), use_radians=False)
    translated = affinity.translate(rotated, xoff=offset_x_m, yoff=offset_y_m)
    return translated.buffer(0)


def _cardinal_direction(dx: float, dy: float) -> str:
    angle = (math.degrees(math.atan2(dy, dx)) + 360.0) % 360.0
    labels = ["east", "north-east", "north", "north-west", "west", "south-west", "south", "south-east"]
    idx = int(((angle + 22.5) % 360.0) // 45.0)
    return labels[idx]


def _max_overflow_distance(overflow_geom: object, land_geom: Polygon | MultiPolygon) -> float:
    from shapely.geometry import GeometryCollection, Polygon, MultiPolygon
    if not overflow_geom or getattr(overflow_geom, "is_empty", True):
        return 0.0

    # Extract all polygons from whatever geometry we have
    polys = []
    if isinstance(overflow_geom, Polygon):
        polys.append(overflow_geom)
    elif isinstance(overflow_geom, MultiPolygon):
        polys.extend(list(overflow_geom.geoms))
    elif isinstance(overflow_geom, GeometryCollection):
        for g in overflow_geom.geoms:
            if isinstance(g, Polygon):
                polys.append(g)
            elif isinstance(g, MultiPolygon):
                polys.extend(list(g.geoms))

    max_d = 0.0
    for geom in polys:
        for x, y in geom.exterior.coords:
            p = Point(x, y)
            if land_geom.contains(p) or land_geom.touches(p):
                continue
            nearest = nearest_points(p, land_geom.boundary)[1]
            max_d = max(max_d, p.distance(nearest))
    return max_d


def _evaluate_rotation(land_poly: Polygon | MultiPolygon, width_m: float, depth_m: float, rotation_deg: float, offset_x_m: float, offset_y_m: float) -> dict:
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


async def _road_distance_m(land_geojson: dict, origin_lon: float, origin_lat: float, road_warning_distance_m: float) -> RoadAccessResult:
    land_shape_ll = shape(land_geojson)
    min_lon, min_lat, max_lon, max_lat = land_shape_ll.bounds
    pad = 0.01
    bbox = BoundingBox(
        min_lon=min_lon - pad,
        min_lat=min_lat - pad,
        max_lon=max_lon + pad,
        max_lat=max_lat + pad,
    )
    osm = await fetch_osm_context(bbox=bbox, max_road_results=400, max_landuse_results=60)

    if not osm.roads:
        return RoadAccessResult(
            nearest_road_distance_m=None,
            has_road_access=False,
            warning=f"No nearby OSM road features found within search window (~{pad} degrees).",
        )

    def project_coords(coords: list[list[float]]) -> list[tuple[float, float]]:
        return [_to_local_xy(c[0], c[1], origin_lon, origin_lat) for c in coords]

    if isinstance(land_shape_ll, Polygon):
        shell = [_to_local_xy(p[0], p[1], origin_lon, origin_lat) for p in land_shape_ll.exterior.coords]
        holes = [[_to_local_xy(p[0], p[1], origin_lon, origin_lat) for p in h.coords] for h in land_shape_ll.interiors]
        land_poly_local: Polygon | MultiPolygon = Polygon(shell, holes).buffer(0)
    elif isinstance(land_shape_ll, MultiPolygon):
        polys = []
        for p in land_shape_ll.geoms:
            shell = [_to_local_xy(c[0], c[1], origin_lon, origin_lat) for c in p.exterior.coords]
            holes = [[_to_local_xy(c[0], c[1], origin_lon, origin_lat) for c in h.coords] for h in p.interiors]
            polys.append(Polygon(shell, holes).buffer(0))
        land_poly_local = MultiPolygon(polys).buffer(0)
    else:
        return RoadAccessResult(
            nearest_road_distance_m=None,
            has_road_access=False,
            warning="Land geometry is not polygonal for road-distance check.",
        )

    min_distance = float("inf")
    for road in osm.roads:
        geom = road.geometry
        if not geom:
            continue
        if geom.get("type") == "LineString":
            pts = project_coords(geom.get("coordinates", []))
            if len(pts) < 2:
                continue
            d = LineString(pts).distance(land_poly_local)
            min_distance = min(min_distance, d)
        elif geom.get("type") == "Point":
            coords = geom.get("coordinates")
            if isinstance(coords, list) and len(coords) == 2:
                p = Point(_to_local_xy(coords[0], coords[1], origin_lon, origin_lat))
                d = p.distance(land_poly_local)
                min_distance = min(min_distance, d)

    if math.isinf(min_distance):
        return RoadAccessResult(
            nearest_road_distance_m=None,
            has_road_access=False,
            warning="OSM roads were returned but no valid geometry could be measured.",
        )

    has_access = min_distance <= road_warning_distance_m
    warning = None if has_access else (
        f"No nearby road access: nearest known road is {min_distance:.1f} m away "
        f"(threshold {road_warning_distance_m:.1f} m)."
    )
    return RoadAccessResult(
        nearest_road_distance_m=round(min_distance, 2),
        has_road_access=has_access,
        warning=warning,
    )


async def validate_fit(req: FitValidationRequest) -> FitValidationResult:
    land_poly, origin_lon, origin_lat = _land_polygon_from_geojson(req)

    width_m = req.model_dimensions.width_m
    depth_m = req.model_dimensions.depth_m
    model_area = width_m * depth_m
    land_area = land_poly.area

    eval_at_requested = _evaluate_rotation(
        land_poly=land_poly,
        width_m=width_m,
        depth_m=depth_m,
        rotation_deg=req.rotation_deg,
        offset_x_m=req.placement_offset_x_m,
        offset_y_m=req.placement_offset_y_m,
    )

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

    road_access = await _road_distance_m(
        land_geojson=req.land_geojson,
        origin_lon=origin_lon,
        origin_lat=origin_lat,
        road_warning_distance_m=req.road_warning_distance_m,
    )

    messages: list[str] = []
    if fit_status == "valid":
        messages.append("Model footprint fits fully inside the selected land polygon.")
    elif fit_status == "partial":
        messages.append("Model footprint partially overlaps land boundary.")
    else:
        messages.append("Model footprint does not fit the selected land polygon.")

    if overflow_direction and overflow_distance > 0:
        messages.append(
            f"Boundary exceedance detected towards {overflow_direction} by up to {overflow_distance:.1f} m."
        )

    if utilization_class == "underutilized":
        messages.append(f"Low utilization: only {utilization:.1f}% of land is used by the model footprint.")
    elif utilization_class == "moderate":
        messages.append(f"Moderate utilization: {utilization:.1f}% land usage.")
    else:
        messages.append(f"Optimal utilization zone: {utilization:.1f}% land usage.")

    if road_access.warning:
        messages.append(road_access.warning)

    if req.optimize_rotation:
        delta = (suggested_rotation - req.rotation_deg + 360.0) % 360.0
        if delta > 180:
            delta -= 360
        messages.append(
            f"Suggested rotation: {suggested_rotation:.1f}° (change by {delta:+.1f}° from current angle)."
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
        inside_geometry=inside_geojson,
        overflow_geometry=overflow_geojson,
        messages=messages,
    )
