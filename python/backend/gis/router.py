"""
FastAPI router for GIS / Spatial Intelligence endpoints.
Prefix: /api/gis   (registered in main.py)
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from .agent import run_agent
from .fit_validation import validate_fit
from .geocoder import geocode, region_polygon
from .osm_adapter import fetch_osm_context
from .schemas import (
    FitValidationRequest,
    GisChatRequest,
    GeocodeRequest,
    OsmContextRequest,
    RegionPolygonRequest,
    SuggestLandRequest,
    SuitableRegionsRequest,
)
from .scorer import score_candidates, score_suitability

router = APIRouter(prefix="/api/gis", tags=["GIS"])


# ---------------------------------------------------------------------------
# POST /api/gis/suitable-regions
# ---------------------------------------------------------------------------
@router.post("/suitable-regions")
async def suitable_regions_endpoint(req: SuitableRegionsRequest):
    """
    Returns ranked construction-suitable locations using OSM data within a polygon.
    """
    try:
        # 1. Get bbox
        geom = req.polygon.get("geometry", req.polygon)
        coords = geom.get("coordinates", [[]])[0]
        if not coords:
             raise HTTPException(status_code=400, detail="Invalid polygon")
        
        from .schemas import BoundingBox
        lons = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        bbox = BoundingBox(min_lon=min(lons), min_lat=min(lats), max_lon=max(lons), max_lat=max(lats))

        # 2. Fetch OSM
        osm = await fetch_osm_context(bbox)
        
        # 3. Score
        candidates = score_suitability(req.polygon, osm, max_results=req.max_results)
        
        return JSONResponse(content=[c.model_dump() for c in candidates])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Suitability analysis failed: {exc}")


# ---------------------------------------------------------------------------
# POST /api/gis/geocode
# ---------------------------------------------------------------------------
@router.post("/geocode")
async def geocode_endpoint(req: GeocodeRequest):
    """Forward-geocode a place name to coordinates + bounding box (India only)."""
    result = await geocode(req.query)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"No geocoding result found for '{req.query}'"
        )
    return JSONResponse(content=result.model_dump())


# ---------------------------------------------------------------------------
# POST /api/gis/region-polygon
# ---------------------------------------------------------------------------
@router.post("/region-polygon")
async def region_polygon_endpoint(req: RegionPolygonRequest):
    """Return a GeoJSON polygon boundary for a named region in India."""
    result = await region_polygon(req.query)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"No polygon found for region '{req.query}'"
        )
    return JSONResponse(content=result.model_dump())


# ---------------------------------------------------------------------------
# POST /api/gis/osm-context
# ---------------------------------------------------------------------------
@router.post("/osm-context")
async def osm_context_endpoint(req: OsmContextRequest):
    """Fetch normalised OSM roads, land-use polygons, and place nodes within a bbox."""
    try:
        result = await fetch_osm_context(
            bbox=req.bbox,
            max_road_results=req.max_road_results,
            max_landuse_results=req.max_landuse_results,
        )
        return JSONResponse(content=result.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OSM fetch failed: {exc}")


# ---------------------------------------------------------------------------
# POST /api/gis/suggest-land
# ---------------------------------------------------------------------------
@router.post("/suggest-land")
async def suggest_land_endpoint(req: SuggestLandRequest):
    """
    Score and rank candidate land parcels within the given bounding box.
    Returns top-N parcels with weighted scores and explanation strings.
    """
    try:
        osm = await fetch_osm_context(req.bbox)
        candidates = score_candidates(
            bbox=req.bbox,
            osm=osm,
            preference=req.preference,
            near_highway=req.near_highway,
            avoid_industrial=req.avoid_industrial,
            top_n=req.top_n,
        )
        return JSONResponse(content={
            "candidates": [c.model_dump() for c in candidates],
            "bbox": req.bbox.model_dump(),
        })
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Scoring failed: {exc}")


# ---------------------------------------------------------------------------
# POST /api/gis/chat
# ---------------------------------------------------------------------------
@router.post("/chat")
async def gis_chat_endpoint(req: GisChatRequest):
    """
    Natural-language GIS chat endpoint.
    Runs the LangGraph Spatial Intelligence Agent and returns a ChatActionEvent
    that the frontend translates into map actions.
    """
    try:
        event = await run_agent(message=req.message, history=req.history, context=req.context)
        return JSONResponse(content=event.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Agent error: {exc}")


# ---------------------------------------------------------------------------
# POST /api/gis/validate-fit
# ---------------------------------------------------------------------------
@router.post("/validate-fit")
async def validate_fit_endpoint(req: FitValidationRequest):
    """
    Validate whether a model footprint can fit on the selected land polygon.
    Returns fit score, overflow diagnostics, suggested rotation, and road checks.
    """
    try:
        result = await validate_fit(req)
        return JSONResponse(content=result.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Validation input error: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Fit validation failed: {exc}")
