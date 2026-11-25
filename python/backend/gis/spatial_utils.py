from __future__ import annotations

import math
from typing import Iterable

from shapely.geometry import GeometryCollection, LineString, MultiPolygon, Point, Polygon

EARTH_RADIUS_M = 6_371_000.0


def to_local_xy(lon: float, lat: float, origin_lon: float, origin_lat: float) -> tuple[float, float]:
    lon_rad = math.radians(lon)
    lat_rad = math.radians(lat)
    origin_lon_rad = math.radians(origin_lon)
    origin_lat_rad = math.radians(origin_lat)

    x = (lon_rad - origin_lon_rad) * math.cos(origin_lat_rad) * EARTH_RADIUS_M
    y = (lat_rad - origin_lat_rad) * EARTH_RADIUS_M
    return x, y


def to_lon_lat(x: float, y: float, origin_lon: float, origin_lat: float) -> tuple[float, float]:
    origin_lon_rad = math.radians(origin_lon)
    origin_lat_rad = math.radians(origin_lat)

    lat_rad = origin_lat_rad + (y / EARTH_RADIUS_M)
    lon_rad = origin_lon_rad + (x / (EARTH_RADIUS_M * math.cos(origin_lat_rad)))
    return math.degrees(lon_rad), math.degrees(lat_rad)


def transform_coords_to_lonlat(coords: object, origin_lon: float, origin_lat: float) -> object:
    if isinstance(coords, (list, tuple)):
        if len(coords) == 2 and all(isinstance(v, (int, float)) for v in coords):
            lon, lat = to_lon_lat(float(coords[0]), float(coords[1]), origin_lon, origin_lat)
            return [lon, lat]
        return [transform_coords_to_lonlat(c, origin_lon, origin_lat) for c in coords]
    return coords


def project_ring(ring: Iterable[tuple[float, float]], origin_lon: float, origin_lat: float) -> list[tuple[float, float]]:
    return [to_local_xy(point[0], point[1], origin_lon, origin_lat) for point in ring]


def project_shape_to_local(
    source_shape: Polygon | MultiPolygon,
    origin_lon: float,
    origin_lat: float,
) -> Polygon | MultiPolygon:
    if isinstance(source_shape, Polygon):
        shell = project_ring(source_shape.exterior.coords, origin_lon, origin_lat)
        holes = [project_ring(h.coords, origin_lon, origin_lat) for h in source_shape.interiors]
        return Polygon(shell, holes).buffer(0)

    polys = []
    for poly in source_shape.geoms:
        shell = project_ring(poly.exterior.coords, origin_lon, origin_lat)
        holes = [project_ring(h.coords, origin_lon, origin_lat) for h in poly.interiors]
        polys.append(Polygon(shell, holes).buffer(0))
    return MultiPolygon(polys).buffer(0)


def geometry_to_local_shape(
    geometry: dict | None,
    origin_lon: float,
    origin_lat: float,
) -> Polygon | MultiPolygon | LineString | Point | None:
    if not geometry:
        return None

    geom_type = geometry.get("type")
    if geom_type == "Polygon":
        rings = geometry.get("coordinates", [])
        if not rings:
            return None
        shell = [to_local_xy(c[0], c[1], origin_lon, origin_lat) for c in rings[0]]
        holes = [[to_local_xy(c[0], c[1], origin_lon, origin_lat) for c in ring] for ring in rings[1:]]
        return Polygon(shell, holes).buffer(0)

    if geom_type == "MultiPolygon":
        polys = []
        for polygon_coords in geometry.get("coordinates", []):
            if not polygon_coords:
                continue
            shell = [to_local_xy(c[0], c[1], origin_lon, origin_lat) for c in polygon_coords[0]]
            holes = [[to_local_xy(c[0], c[1], origin_lon, origin_lat) for c in ring] for ring in polygon_coords[1:]]
            polys.append(Polygon(shell, holes).buffer(0))
        return MultiPolygon(polys).buffer(0) if polys else None

    if geom_type == "LineString":
        coords = geometry.get("coordinates", [])
        if len(coords) < 2:
            return None
        return LineString([to_local_xy(c[0], c[1], origin_lon, origin_lat) for c in coords])

    if geom_type == "Point":
        coords = geometry.get("coordinates")
        if isinstance(coords, list) and len(coords) == 2:
            return Point(to_local_xy(coords[0], coords[1], origin_lon, origin_lat))

    return None
def level_for_score(score: float) -> str:
    if score >= 80:
        return "high"
    if score >= 55:
        return "moderate"
    if score >= 30:
        return "elevated"
    return "low"


def risk_level_for_score(score: float) -> str:
    if score >= 75:
        return "critical"
    if score >= 55:
        return "high"
    if score >= 30:
        return "moderate"
    return "low"


def flatten_polygonal_area(source) -> float:
    if source is None or getattr(source, "is_empty", True):
        return 0.0
    if isinstance(source, (Polygon, MultiPolygon)):
        return source.area
    if isinstance(source, GeometryCollection):
        return sum(flatten_polygonal_area(item) for item in source.geoms)
    return 0.0
