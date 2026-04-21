"""
LangGraph Agent 1 — Spatial Intelligence Agent.

State machine:
  parse_intent → resolve_entities → choose_tool → execute_tool → summarize

LLM: ChatGroq (llama-3.3-70b-versatile)
Tools: geocodePlace, regionToPolygon, getLandContext, rankCandidateParcels
"""

from __future__ import annotations

import json
import os
import math
import re
from typing import Annotated, Any, Dict, List, Optional, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage, SystemMessage
from langchain_core.tools import tool
from langchain_groq import ChatGroq
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from .geocoder import geocode, region_polygon
from .osm_adapter import fetch_osm_context
from .schemas import BoundingBox, ChatActionEvent, SuggestLandRequest
from .scorer import score_candidates


# ---------------------------------------------------------------------------
# LLM
# ---------------------------------------------------------------------------

def _get_llm():
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        api_key=os.environ.get("GROQ_API_KEY", ""),
        temperature=0,
    )


# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------

@tool
async def geocodePlace(place_name: str) -> str:
    """
    Geocode a city, district, or landmark in India.
    Returns JSON with lat, lon, bbox, display_name.
    Use this when the user wants to navigate to or fly to a location.
    """
    result = await geocode(place_name)
    if result is None:
        return json.dumps({"error": f"Could not geocode '{place_name}'"})
    return json.dumps(result.model_dump())


@tool
async def regionToPolygon(region_name: str) -> str:
    """
    Fetch the GeoJSON polygon boundary of a named region (state or district) in India.
    Use this when the user wants to draw or select a regional boundary polygon.
    """
    result = await region_polygon(region_name)
    if result is None:
        return json.dumps({"error": f"No polygon found for '{region_name}'"})
    return json.dumps(result.model_dump())


@tool
async def getLandContext(
    min_lat: float, min_lon: float, max_lat: float, max_lon: float
) -> str:
    """
    Fetch OSM roads and land-use data for a bounding box.
    Returns roads, landuse polygons, and place nodes.
    Use this to analyse what is around a selected area.
    """
    bbox = BoundingBox(min_lat=min_lat, min_lon=min_lon, max_lat=max_lat, max_lon=max_lon)
    result = await fetch_osm_context(bbox)
    # Return a compact summary to keep token count low
    summary = {
        "road_count": len(result.roads),
        "landuse_count": len(result.landuse),
        "place_count": len(result.places),
        "road_types": list({r.tags.get("highway", "") for r in result.roads})[:10],
        "landuse_types": list({l.tags.get("landuse", "") for l in result.landuse})[:10],
    }
    return json.dumps(summary)


@tool
async def rankCandidateParcels(
    min_lat: float, min_lon: float, max_lat: float, max_lon: float,
    preference: str = "mixed",
    near_highway: bool = False,
    avoid_industrial: bool = False,
    top_n: int = 5,
) -> str:
    """
    Score and rank candidate land parcels within a bounding box.
    preference: 'urban' | 'rural' | 'mixed'
    Returns top-N parcels with scores, reasons, and GeoJSON geometry.
    Use this when the user asks 'show me good spots', 'find land', or similar.
    """
    bbox = BoundingBox(min_lat=min_lat, min_lon=min_lon, max_lat=max_lat, max_lon=max_lon)
    osm = await fetch_osm_context(bbox)
    candidates = score_candidates(
        bbox=bbox,
        osm=osm,
        preference=preference,
        near_highway=near_highway,
        avoid_industrial=avoid_industrial,
        top_n=top_n,
    )
    return json.dumps([c.model_dump() for c in candidates])


@tool
async def suggestSkyscraperLand(
    min_lat: float, min_lon: float, max_lat: float, max_lon: float,
    target_sqm: float
) -> str:
    """
    Search for perfectly empty, building-free parcels of land capable of fitting a large footprint (like a skyscraper).
    Required input: bounding box and target_sqm (e.g. 5000 to 15000).
    It ensures building overlap is mathematically zero.
    Returns GeoJSON geometry of candidate free spots.
    Make sure to use smaller bounding boxes (e.g. a specific city neighborhood) to avoid timeouts.
    """
    # Calculate tile size dynamically based on target_sqm
    tile_m = math.sqrt(target_sqm)
    bbox = BoundingBox(min_lat=min_lat, min_lon=min_lon, max_lat=max_lat, max_lon=max_lon)
    
    # Needs more building context, so request up to 1000 buildings
    osm = await fetch_osm_context(bbox, max_building_results=1000)
    
    candidates = score_candidates(
        bbox=bbox,
        osm=osm,
        preference="mixed",
        near_highway=True,
        top_n=3,
        tile_m=tile_m,
        free_land_only=True
    )
    if not candidates:
        return json.dumps({"error": "No completely empty land matching the target area found in this bounding box."})
    
    return json.dumps([c.model_dump() for c in candidates])


@tool
async def get_suitable_regions(min_lat: float, min_lon: float, max_lat: float, max_lon: float, max_results: int = 5) -> str:
    """
    Search for construction-suitable land parcels within a bounding box.
    Uses real OSM data (roads, landuse, buildings) to score and rank locations.
    Use this when the user asks for suggestions or 'find spots'.
    """
    bbox = BoundingBox(min_lat=min_lat, min_lon=min_lon, max_lat=max_lat, max_lon=max_lon)
    
    # Create a simple polygon from bbox for scoring
    polygon = {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [min_lon, min_lat],
                [min_lon, max_lat],
                [max_lon, max_lat],
                [max_lon, min_lat],
                [min_lon, min_lat]
            ]]
        }
    }

    # 2. Fetch OSM
    osm = await fetch_osm_context(bbox, max_building_results=500)
    
    # 3. Score
    from .scorer import score_suitability
    candidates = score_suitability(polygon, osm, max_results=max_results)
    
    return json.dumps([c.model_dump() for c in candidates])


TOOLS = [geocodePlace, regionToPolygon, getLandContext, get_suitable_regions]


# ---------------------------------------------------------------------------
# Graph state
# ---------------------------------------------------------------------------

class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    full_tool_results: Dict[str, str] # tool_call_id -> raw_json


# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are the Spatial Intelligence Agent for InfraSaathi (India).
Ground all responses in tool data. Use only available tools.

ACTION FORMAT:
Return ONLY a JSON object:
{
  "action_type": "flyTo" | "drawPolygon" | "suggestAreas" | "none",
  "payload": {
    "geojson": <Feature>,
    "center": [lon, lat],
    "candidates": [...]
  },
  "explanation": "Human summary",
  "follow_up": "Next step?"
}
"""


async def agent_node(state: AgentState) -> AgentState:
    """Main LLM reasoning + tool-call node."""
    llm = _get_llm()
    llm_with_tools = llm.bind_tools(TOOLS)

    # Keep only last 10 messages to save context
    msgs = list(state["messages"])
    if len(msgs) > 10:
        msgs = msgs[-10:]

    # Prepend system prompt if not present
    if not msgs or not isinstance(msgs[0], SystemMessage):
        msgs = [SystemMessage(content=SYSTEM_PROMPT)] + msgs
    
    # Add a hidden hint to avoid XML syntax
    msgs.append(HumanMessage(content="IMPORTANT: Call tools natively. Do NOT use <function> tags or XML. Return ONLY the requested JSON after tool results are in."))

    response = await llm_with_tools.ainvoke(msgs)
    return {"messages": [response]}


async def tool_node(state: AgentState) -> AgentState:
    """Execute any tool calls requested by the LLM."""
    last_msg = state["messages"][-1]
    tool_messages: List[ToolMessage] = []
    full_results: Dict[str, str] = {}

    tool_map = {t.name: t for t in TOOLS}

    for tc in last_msg.tool_calls:
        fn = tool_map.get(tc["name"])
        if fn is None:
            result = json.dumps({"error": f"Unknown tool {tc['name']}"})
        else:
            try:
                raw_result = await fn.ainvoke(tc["args"])
                full_results[tc["id"]] = raw_result
                
                # OPTIMIZATION: Strip heavy data for the LLM's next reasoning step
                try:
                    data = json.loads(raw_result)
                    if isinstance(data, list):
                        for item in data:
                            if isinstance(item, dict):
                                item.pop("geometry", None)
                                item.pop("bbox", None)
                        result = json.dumps(data)
                    elif isinstance(data, dict):
                        data.pop("geometry", None)
                        data.pop("geojson", None)
                        result = json.dumps(data)
                    else:
                        result = raw_result
                except:
                    result = raw_result
            except Exception as exc:
                result = json.dumps({"error": str(exc)})

        tool_messages.append(
            ToolMessage(content=result, tool_call_id=tc["id"])
        )

    return {"messages": tool_messages, "full_tool_results": full_results}


async def summarize_node(state: AgentState) -> AgentState:
    """
    Produce the final JSON ChatActionEvent.
    Inject full data (geometries) back into the prompt context for this final step only.
    """
    llm = _get_llm()
    # Build a special prompt for the final JSON generation that includes the raw data
    raw_data_summary = "\n".join([f"Tool {tid} full data: {val}" for tid, val in state.get("full_tool_results", {}).items()])
    
    msgs = list(state["messages"])
    if len(msgs) > 10:
        msgs = msgs[-10:]
    
    if not msgs or not isinstance(msgs[0], SystemMessage):
        msgs = [SystemMessage(content=SYSTEM_PROMPT)] + msgs

    msgs.append(HumanMessage(
        content=f"FULL DATA REFERENCE:\n{raw_data_summary}\n\n"
                "Based on the tool results and the FULL DATA above, output the final JSON ChatActionEvent. "
                "Ensure geometries are included in the payload. Output ONLY valid JSON."
    ))
    response = await llm.ainvoke(msgs)
    return {"messages": [response]}


def route_after_agent(state: AgentState) -> str:
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and getattr(last, "tool_calls", None):
        return "tools"
    return "summarize"


def route_after_summarize(state: AgentState) -> str:
    return END


def _first_polygon_feature(geojson_obj: Any) -> Optional[dict]:
    if not isinstance(geojson_obj, dict):
        return None

    gj_type = geojson_obj.get("type")
    if gj_type == "FeatureCollection":
        for feature in geojson_obj.get("features", []):
            normalized = _first_polygon_feature(feature)
            if normalized:
                return normalized
        return None

    if gj_type == "Feature":
        geom = geojson_obj.get("geometry")
        if isinstance(geom, dict) and geom.get("type") in {"Polygon", "MultiPolygon"}:
            return geojson_obj
        return None

    if gj_type in {"Polygon", "MultiPolygon"}:
        return {"type": "Feature", "geometry": geojson_obj, "properties": {}}

    return None


def _normalize_chat_action_payload(data: dict) -> dict:
    payload = data.get("payload")
    if not isinstance(payload, dict):
        return data

    if data.get("action_type") == "drawPolygon":
        geojson = payload.get("geojson") or payload.get("feature") or payload.get("geometry")
        polygon_feature = _first_polygon_feature(geojson)
        if polygon_feature:
            payload["geojson"] = polygon_feature
            payload.pop("feature", None)
            payload.pop("geometry", None)

    if data.get("action_type") == "suggestAreas":
        candidates = payload.get("candidates")
        if isinstance(candidates, list):
            for candidate in candidates:
                if not isinstance(candidate, dict):
                    continue
                feature = _first_polygon_feature(candidate.get("geometry"))
                if feature:
                    candidate["geometry"] = feature["geometry"]

    return data


# ---------------------------------------------------------------------------
# Build graph
# ---------------------------------------------------------------------------

def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)
    graph.add_node("summarize", summarize_node)

    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", route_after_agent, {"tools": "tools", "summarize": "summarize"})
    graph.add_edge("tools", "agent")
    graph.add_conditional_edges("summarize", route_after_summarize, {END: END})

    return graph.compile()


_compiled_graph = None


def get_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_graph()
    return _compiled_graph


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def run_agent(
    message: str, 
    history: Optional[List[Dict]] = None,
    context: Optional[Dict] = None
) -> ChatActionEvent:
    """
    Run the spatial agent on a user message.
    Returns a structured ChatActionEvent.
    """
    lower_msg = message.lower()

    # Deterministic fast-path for skyscraper empty-land queries.
    if "skyscraper" in lower_msg and ("empty" in lower_msg or "vacant" in lower_msg or "free land" in lower_msg):
        sqm_match = re.search(r"(\d[\d,\.]*)\s*(sqm|sq\.?m|m2|m\^2)", lower_msg)
        target_sqm = 5000.0
        if sqm_match:
            try:
                target_sqm = float(sqm_match.group(1).replace(",", ""))
            except ValueError:
                target_sqm = 5000.0

        place_match = re.search(r"\bin\s+([a-zA-Z\s]+)", message)
        place = (place_match.group(1).strip() if place_match else "Mumbai")
        geo = await geocode(place)
        if geo is None:
            return ChatActionEvent(
                action_type="none",
                payload={},
                explanation=f"I could not geocode '{place}'. Please try a different city or district name.",
                follow_up=None,
            )

        tile_m = math.sqrt(max(target_sqm, 100.0))
        osm = await fetch_osm_context(geo.bbox, max_building_results=1000)
        candidates = score_candidates(
            bbox=geo.bbox,
            osm=osm,
            preference="mixed",
            near_highway=True,
            avoid_industrial=True,
            top_n=5,
            tile_m=tile_m,
            free_land_only=True,
        )
        if not candidates:
            return ChatActionEvent(
                action_type="none",
                payload={},
                explanation=(
                    f"No fully empty parcel around {geo.display_name} matched about {target_sqm:.0f} sqm. "
                    "Try a nearby city area, a smaller target area, or a wider search box."
                ),
                follow_up="You can ask: 'Find 3000sqm empty land in Navi Mumbai'.",
            )

        best = candidates[0]
        return ChatActionEvent(
            action_type="drawPolygon",
            payload={
                "geojson": {
                    "type": "Feature",
                    "geometry": best.geometry,
                    "properties": {
                        "score": best.score,
                        "confidence": best.confidence_label,
                        "area_sqm": best.area_sqm,
                        "reason": "empty-land skyscraper candidate",
                    },
                }
            },
            explanation=(
                f"Found an empty parcel near {geo.display_name} (~{best.area_sqm:.0f} sqm, "
                f"confidence {best.confidence_label}). I have drawn the best candidate polygon on the map."
            ),
            follow_up="Want me to show top alternative empty parcels in the same region?",
        )

    context_prefix = ""
    if context:
        context_prefix = f"[Context: {json.dumps(context)}]\n\n"

    # Convert history to LangChain messages
    history_messages = []
    if history:
        for m in history:
            role = m.get("role")
            content = m.get("content", "")
            if role == "user":
                history_messages.append(HumanMessage(content=content))
            elif role == "agent":
                history_messages.append(AIMessage(content=content))

    graph = get_graph()
    initial_state: AgentState = {
        "messages": history_messages + [HumanMessage(content=context_prefix + message)],
        "full_tool_results": {},
    }

    final_state = await graph.ainvoke(initial_state)
    last_msg = final_state["messages"][-1]
    raw = last_msg.content if hasattr(last_msg, "content") else str(last_msg)

    # Strip markdown fences if present
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1]) if len(lines) > 2 else raw

    try:
        data = json.loads(raw)
        data = _normalize_chat_action_payload(data)
        return ChatActionEvent(**data)
    except Exception:
        # Fallback: conversational response with no map action
        return ChatActionEvent(
            action_type="none",
            payload={},
            explanation=raw,
            follow_up=None,
        )
