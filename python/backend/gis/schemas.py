"""
Pydantic schemas for GIS / Spatial Intelligence endpoints.
All data contracts are defined here so they are shared across
the router, agent, and scorer modules.
"""

from __future__ import annotations
from typing import Any, List, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Geocoding
# ---------------------------------------------------------------------------

class GeocodeRequest(BaseModel):
    query: str = Field(..., description="Place name or address to geocode")


class BoundingBox(BaseModel):
    min_lon: float
    min_lat: float
    max_lon: float
    max_lat: float


class GeocodeResult(BaseModel):
    display_name: str
    lat: float
    lon: float
    bbox: BoundingBox


# ---------------------------------------------------------------------------
# Region polygon
# ---------------------------------------------------------------------------

class RegionPolygonRequest(BaseModel):
    query: str = Field(..., description="Region/district/state name")


class RegionPolygonResult(BaseModel):
    display_name: str
    geojson: dict  # GeoJSON Feature


# ---------------------------------------------------------------------------
# OSM context
# ---------------------------------------------------------------------------

class OsmContextRequest(BaseModel):
    bbox: BoundingBox
    max_road_results: int = 200
    max_landuse_results: int = 100


class OsmFeature(BaseModel):
    feature_type: str   # "road" | "landuse" | "place" | "building"
    tags: dict[str, str]
    geometry: Optional[dict] = None  # GeoJSON geometry snippet


class OsmContextResult(BaseModel):
    bbox: BoundingBox
    roads: List[OsmFeature]
    landuse: List[OsmFeature]
    places: List[OsmFeature]
    buildings: List[OsmFeature] = Field(default_factory=list)
    exclusions: List[OsmFeature] = Field(default_factory=list)
    infrastructure: List[OsmFeature] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Land suggestion / scoring
# ---------------------------------------------------------------------------

class SuggestLandRequest(BaseModel):
    bbox: BoundingBox
    preference: str = Field(
        "mixed",
        description="'urban' | 'rural' | 'mixed'"
    )
    near_highway: bool = False
    avoid_industrial: bool = False
    top_n: int = Field(5, ge=1, le=20)


class SuggestionItem(BaseModel):
    id: str
    geometry: dict           # GeoJSON Polygon
    score: float             # 0–1
    reasons: List[str]
    tags: dict[str, Any]     # urbanity, roadDistance, landUseMix …
    area_sqm: float
    centroid: List[float]    # [lon, lat]
    bbox: BoundingBox
    confidence_label: str    # "high" | "medium" | "low"


class SuggestLandResult(BaseModel):
    candidates: List[SuggestionItem]
    bbox: BoundingBox


# ---------------------------------------------------------------------------
# Suitability Engine (Fix 1)
# ---------------------------------------------------------------------------

class SuitableRegionsRequest(BaseModel):
    polygon: dict = Field(..., description="GeoJSON polygon geometry")
    max_results: int = Field(5, description="Maximum number of ranked results")


class SuitableRegionItem(BaseModel):
    lat: float
    lng: float
    score: int
    reasons: List[str]
    geometry: Optional[dict] = None  # To highlight on map


# ---------------------------------------------------------------------------
# Fit validation (map-aligned GLB footprint)
# ---------------------------------------------------------------------------

class ModelDimensions(BaseModel):
    width_m: float = Field(..., gt=0)
    depth_m: float = Field(..., gt=0)
    height_m: float = Field(..., gt=0)


class FitValidationRequest(BaseModel):
    land_geojson: dict
    model_dimensions: ModelDimensions
    rotation_deg: float = 0.0
    optimize_rotation: bool = True
    road_warning_distance_m: float = Field(50.0, gt=0)
    nearby_building_distance_m: float = Field(50.0, gt=0)
    area_unit: str = Field("sqm", description="sqm | acres | hectares")
    placement_offset_x_m: float = 0.0
    placement_offset_y_m: float = 0.0
    anchor_lon_lat: Optional[List[float]] = Field(
        default=None,
        description="Optional [lon, lat] anchor for local projection. Defaults to land centroid.",
    )


class RoadAccessResult(BaseModel):
    nearest_road_distance_m: Optional[float] = None
    has_road_access: bool
    warning: Optional[str] = None


class EnvironmentalMetricSet(BaseModel):
    nearest_water_distance_m: Optional[float] = None
    nearest_forest_distance_m: Optional[float] = None
    nearest_wetland_distance_m: Optional[float] = None
    natural_cover_ratio: float = 0.0
    water_overlap_area_sqm: float = 0.0
    protected_overlap_area_sqm: float = 0.0
    hazardous_landuse_count: int = 0


class EnvironmentalSummary(BaseModel):
    suitability_score: float
    sensitivity_level: str
    flood_risk_level: str
    biodiversity_level: str
    constraints: List[str] = Field(default_factory=list)
    opportunities: List[str] = Field(default_factory=list)
    nearby_features: List[str] = Field(default_factory=list)
    metrics: EnvironmentalMetricSet


class InfrastructureMetricSet(BaseModel):
    nearest_power_distance_m: Optional[float] = None
    nearest_water_infra_distance_m: Optional[float] = None
    nearest_sewer_distance_m: Optional[float] = None
    nearest_telecom_distance_m: Optional[float] = None
    nearest_transit_distance_m: Optional[float] = None
    nearest_rail_distance_m: Optional[float] = None


class InfrastructureSummary(BaseModel):
    readiness_score: float
    readiness_level: str
    utility_coverage_level: str
    transit_access_level: str
    available_utilities: List[str] = Field(default_factory=list)
    missing_utilities: List[str] = Field(default_factory=list)
    logistics_notes: List[str] = Field(default_factory=list)
    metrics: InfrastructureMetricSet


class FitValidationResult(BaseModel):
    fit_status: str  # valid | partial | invalid
    fit_score: float
    inside_area_sqm: float
    overflow_area_sqm: float
    model_footprint_area_sqm: float
    land_area_sqm: float
    utilization_ratio: float
    utilization_class: str  # underutilized | moderate | optimal
    overflow_direction: Optional[str] = None
    overflow_distance_m: Optional[float] = None
    suggested_rotation_deg: float
    road_access: RoadAccessResult
    nearby_building_access: RoadAccessResult
    has_building_collision: bool = False
    has_water_collision: bool = False
    environmental_summary: Optional[EnvironmentalSummary] = None
    infrastructure_summary: Optional[InfrastructureSummary] = None
    inside_geometry: Optional[dict] = None
    overflow_geometry: Optional[dict] = None
    messages: List[str]


# ---------------------------------------------------------------------------
# Agent / Chat
# ---------------------------------------------------------------------------

class GisChatRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = None
    context: Optional[dict] = None   # optional selected polygon / viewport


class ChatActionEvent(BaseModel):
    action_type: str   # "flyTo" | "drawPolygon" | "suggestAreas" | "filterAreas" | "none"
    payload: dict
    explanation: str
    follow_up: Optional[str] = None
