from __future__ import annotations

import json
import math
import os
import re
import traceback
from typing import Any, Dict, List, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from langgraph.graph import END, StateGraph
from dotenv import find_dotenv, load_dotenv


load_dotenv(find_dotenv(), override=False)


class ReportState(TypedDict, total=False):
    request: Dict[str, Any]
    analysis: Dict[str, Any]
    timeline: List[Dict[str, Any]]
    phaseMaterials: List[Dict[str, Any]]
    workforceByPhase: List[Dict[str, Any]]
    report: Dict[str, Any]


STRUCTURAL_TYPES = ["wall", "column", "slab", "beam", "roof", "stair", "member", "proxy", "unknown"]
OPENING_TYPES = ["door", "window"]


def _round(value: float) -> float:
    return float(f"{value:.2f}")


def _positive(value: Any, fallback: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if math.isfinite(parsed) and parsed > 0 else fallback


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def _range_from_quantity(value: float, min_factor: float = 0.9, max_factor: float = 1.15) -> Dict[str, float]:
    return {"min": _round(value * min_factor), "max": _round(value * max_factor)}


def _get_dimensions_from_properties(element: Dict[str, Any]):
    properties = element.get("properties")
    if not isinstance(properties, dict):
        return None
    dims = properties.get("Dimensions")
    if not isinstance(dims, dict):
        return None
    width = _positive(dims.get("Width") or dims.get("width"), 0.0)
    depth = _positive(dims.get("Depth") or dims.get("depth"), 0.0)
    height = _positive(dims.get("Height") or dims.get("height"), 0.0)
    if not width and not depth and not height:
        return None
    return {"width": width or 0.01, "depth": depth or 0.01, "height": height or 0.01}


def _get_dimensions_from_geometry(element: Dict[str, Any]):
    geometry = element.get("geometry")
    if not isinstance(geometry, dict):
        return None
    positions = geometry.get("positions")
    if not isinstance(positions, list) or len(positions) < 9:
        return None

    min_x = min_y = min_z = float("inf")
    max_x = max_y = max_z = float("-inf")
    for index in range(0, len(positions), 3):
        try:
            x = float(positions[index])
            y = float(positions[index + 1])
            z = float(positions[index + 2])
        except (TypeError, ValueError, IndexError):
            continue
        min_x = min(min_x, x)
        min_y = min(min_y, y)
        min_z = min(min_z, z)
        max_x = max(max_x, x)
        max_y = max(max_y, y)
        max_z = max(max_z, z)

    if not math.isfinite(min_x):
        return None

    return {
        "width": max(0.01, _round(max_x - min_x)),
        "depth": max(0.01, _round(max_y - min_y)),
        "height": max(0.01, _round(max_z - min_z)),
    }


def _get_conservative_dimensions(element: Dict[str, Any]):
    from_properties = _get_dimensions_from_properties(element)
    from_geometry = _get_dimensions_from_geometry(element)
    if from_properties and from_geometry:
        return {
            "width": max(from_properties["width"], from_geometry["width"], 0.01),
            "depth": max(from_properties["depth"], from_geometry["depth"], 0.01),
            "height": max(from_properties["height"], from_geometry["height"], 0.01),
        }
    if from_geometry:
        return from_geometry
    if from_properties:
        return from_properties
    return {"width": 1.0, "depth": 1.0, "height": 1.0}


def _get_base_properties(element: Dict[str, Any]):
    properties = element.get("properties")
    if not isinstance(properties, dict):
        return {}
    base = properties.get("base")
    return base if isinstance(base, dict) else {}


def _dimension_metrics(dimensions: Dict[str, float]):
    sides = sorted([dimensions["width"], dimensions["depth"], dimensions["height"]], reverse=True)
    longest, middle, shortest = sides
    face_area = _round(longest * middle)
    footprint_area = _round(dimensions["width"] * dimensions["depth"])
    volume = _round(dimensions["width"] * dimensions["depth"] * dimensions["height"])
    surface_area = _round(2 * (dimensions["width"] * dimensions["depth"] + dimensions["width"] * dimensions["height"] + dimensions["depth"] * dimensions["height"]))
    perimeter = _round(2 * (longest + middle))
    return {
        "longest": longest,
        "middle": middle,
        "shortest": shortest,
        "faceArea": face_area,
        "footprintArea": footprint_area,
        "volume": volume,
        "surfaceArea": surface_area,
        "perimeter": perimeter,
    }


def _normalize_kind(raw_type: str | None):
    upper = (raw_type or "").upper()
    if "WALL" in upper:
        return "wall"
    if "SLAB" in upper or "PLATE" in upper:
        return "slab"
    if "FOOTING" in upper:
        return "column"
    if "DOOR" in upper:
        return "door"
    if "WINDOW" in upper:
        return "window"
    if "COLUMN" in upper:
        return "column"
    if "BEAM" in upper:
        return "beam"
    if "ROOF" in upper:
        return "roof"
    if "STAIR" in upper:
        return "stair"
    if "MEMBER" in upper:
        return "member"
    if "SPACE" in upper:
        return "space"
    if "PROXY" in upper:
        return "proxy"
    return "unknown"


def _infer_kind_from_dimensions(metrics: Dict[str, float]):
    flatness = metrics["shortest"] / max(metrics["middle"], 0.01)
    elongation = metrics["longest"] / max(metrics["middle"], 0.01)
    squatness = metrics["middle"] / max(metrics["longest"], 0.01)
    if flatness <= 0.28 and elongation <= 1.9:
        return "slab"
    if flatness <= 0.28 and elongation > 1.9:
        return "beam" if metrics["middle"] <= 1.1 else "wall"
    if flatness <= 0.45 and squatness <= 0.45:
        return "column"
    if elongation >= 2.5 and metrics["middle"] >= 0.35 * metrics["longest"]:
        return "beam"
    return "unknown"


def _kind_stress_score(kind: str, metrics: Dict[str, float]):
    if kind == "wall":
        return metrics["faceArea"] * 1.6 + metrics["volume"] * 8
    if kind == "slab":
        return metrics["footprintArea"] * 1.5 + metrics["volume"] * 7
    if kind == "column":
        return metrics["volume"] * 12
    if kind == "beam":
        return metrics["volume"] * 11
    if kind == "roof":
        return metrics["faceArea"] * 1.4 + metrics["volume"] * 8
    if kind == "stair":
        return metrics["volume"] * 13
    if kind == "door":
        return metrics["faceArea"] * 0.8 + metrics["perimeter"]
    if kind == "window":
        return metrics["faceArea"] * 0.7 + metrics["perimeter"] * 0.8
    if kind == "member":
        return metrics["volume"] * 15
    return metrics["volume"] * 10 + metrics["surfaceArea"] * 0.5


def _choose_conservative_kind(raw_kind: str, inferred_kind: str, metrics: Dict[str, float]):
    if raw_kind in {"proxy", "unknown"}:
        return inferred_kind if inferred_kind != "unknown" else "proxy"
    if raw_kind == inferred_kind:
        return raw_kind
    return inferred_kind if _kind_stress_score(inferred_kind, metrics) > _kind_stress_score(raw_kind, metrics) else raw_kind


def _get_material_plan(kind: str, dimensions: Dict[str, float], metrics: Dict[str, float]):
    basis = f"bbox {dimensions['width']:.2f}m x {dimensions['depth']:.2f}m x {dimensions['height']:.2f}m"
    volume = metrics["volume"]
    face_area = metrics["faceArea"]
    footprint_area = metrics["footprintArea"]
    surface_area = metrics["surfaceArea"]
    perimeter = metrics["perimeter"]

    def finalize(lines):
        result = []
        for line in lines:
            result.append({**line, "quantityRange": line.get("quantityRange") or _range_from_quantity(line["quantity"])})
        return result

    if kind == "wall":
        wall_length = max(dimensions["width"], dimensions["depth"])
        wall_height = max(0.01, dimensions["height"])
        wall_thickness = _clamp(min(dimensions["width"], dimensions["depth"]) or 0.2, 0.15, 0.23)
        core_volume = _round(wall_length * wall_height * wall_thickness)
        return finalize([
            {"material": "reinforced concrete", "quantity": core_volume, "unit": "cum", "basis": f"{basis}; wall volume = L x H x t ({wall_length:.2f} x {wall_height:.2f} x {wall_thickness:.2f})"},
            {"material": "TMT rebar steel", "quantity": _round(core_volume * 100), "quantityRange": {"min": _round(core_volume * 80), "max": _round(core_volume * 120)}, "unit": "kg", "basis": f"{basis}; steel thumb-rule 80-120 kg/cum"},
            {"material": "formwork / shuttering", "quantity": _round(face_area * 2.1), "unit": "sqm", "basis": f"{basis}; both wall faces"},
            {"material": "cement plaster", "quantity": _round(face_area * 2.2), "unit": "sqm", "basis": f"{basis}; both wall faces"},
        ])

    if kind in {"slab", "roof"}:
        core_volume = _round(volume * 1.18)
        return finalize([
            {"material": "reinforced concrete", "quantity": core_volume, "unit": "cum", "basis": f"{basis}; flat structural core"},
            {"material": "TMT rebar steel", "quantity": _round(core_volume * 100), "quantityRange": {"min": _round(core_volume * 80), "max": _round(core_volume * 120)}, "unit": "kg", "basis": f"{basis}; steel thumb-rule 80-120 kg/cum"},
            {"material": "formwork / shuttering", "quantity": _round(face_area * 1.08), "unit": "sqm", "basis": f"{basis}; soffit formwork"},
            {"material": "waterproofing membrane" if kind == "roof" else "screed / finishing mortar", "quantity": _round(footprint_area * 1.12), "unit": "sqm", "basis": f"{basis}; top surface finish"},
        ])

    if kind in {"column", "beam", "member"}:
        if kind == "member":
            steel_kg = _round(volume * 7850 * 1.08)
            return finalize([
                {"material": "structural steel", "quantity": steel_kg, "unit": "kg", "basis": f"{basis}; member volume to steel weight"},
                {"material": "shop primer / coating", "quantity": _round(surface_area * 1.08), "unit": "sqm", "basis": f"{basis}; exposed steel surface"},
                {"material": "high-strength bolts", "quantity": 1, "unit": "set", "basis": f"{basis}; connection allowance"},
            ])
        core_volume = _round(volume * 1.18)
        return finalize([
            {"material": "reinforced concrete", "quantity": core_volume, "unit": "cum", "basis": f"{basis}; vertical / horizontal structural core"},
            {"material": "TMT rebar steel", "quantity": _round(core_volume * 100), "quantityRange": {"min": _round(core_volume * 80), "max": _round(core_volume * 120)}, "unit": "kg", "basis": f"{basis}; steel thumb-rule 80-120 kg/cum"},
            {"material": "formwork / shuttering", "quantity": _round(surface_area * 0.95), "unit": "sqm", "basis": f"{basis}; external faces"},
            {"material": "patch repair mortar", "quantity": _round(face_area * 0.1), "unit": "sqm", "basis": f"{basis}; edges and corrections"},
        ])

    if kind == "stair":
        core_volume = _round(volume * 1.2)
        return finalize([
            {"material": "reinforced concrete", "quantity": core_volume, "unit": "cum", "basis": f"{basis}; stair core volume"},
            {"material": "TMT rebar steel", "quantity": _round(core_volume * 100), "quantityRange": {"min": _round(core_volume * 80), "max": _round(core_volume * 120)}, "unit": "kg", "basis": f"{basis}; steel thumb-rule 80-120 kg/cum"},
            {"material": "formwork / shuttering", "quantity": _round(surface_area * 0.9), "unit": "sqm", "basis": f"{basis}; stair soffit and risers"},
            {"material": "finishing mortar / treads", "quantity": _round(footprint_area * 1.15), "unit": "sqm", "basis": f"{basis}; stair finish surface"},
        ])

    if kind == "door":
        return finalize([
            {"material": "solid-core door leaf", "quantity": 1, "unit": "each", "basis": f"{basis}; one door assembly"},
            {"material": "door frame", "quantity": _round(perimeter * 1.05), "unit": "lm", "basis": f"{basis}; perimeter frame"},
            {"material": "hardware set", "quantity": 1, "unit": "set", "basis": f"{basis}; hinges, lock, handles"},
            {"material": "sealant / filler", "quantity": _round(perimeter * 0.5), "unit": "lm", "basis": f"{basis}; perimeter sealing"},
        ])

    if kind == "window":
        return finalize([
            {"material": "laminated glass", "quantity": _round(face_area * 1.1), "unit": "sqm", "basis": f"{basis}; glazing area"},
            {"material": "aluminum window frame", "quantity": _round(perimeter * 1.08), "unit": "lm", "basis": f"{basis}; perimeter frame"},
            {"material": "sealant / gasket", "quantity": _round(perimeter * 0.55), "unit": "lm", "basis": f"{basis}; perimeter sealing"},
            {"material": "fixing hardware", "quantity": 1, "unit": "set", "basis": f"{basis}; anchors and locks"},
        ])

    fallback_volume = _round(volume * 1.2)
    return finalize([
        {"material": "reinforced concrete", "quantity": fallback_volume, "unit": "cum", "basis": f"{basis}; fallback structural allowance"},
        {"material": "TMT rebar steel", "quantity": _round(fallback_volume * 100), "quantityRange": {"min": _round(fallback_volume * 80), "max": _round(fallback_volume * 120)}, "unit": "kg", "basis": f"{basis}; steel thumb-rule 80-120 kg/cum"},
        {"material": "formwork / shuttering", "quantity": _round(surface_area * 1.05), "unit": "sqm", "basis": f"{basis}; fallback exposed surfaces"},
    ])


def _labor_days(kind: str, metrics: Dict[str, float]):
    if kind == "wall":
        return _round(max(metrics["faceArea"] / 42, metrics["volume"] * 0.48))
    if kind == "slab":
        return _round(max(metrics["footprintArea"] / 38, metrics["volume"] * 0.52))
    if kind == "roof":
        return _round(max(metrics["footprintArea"] / 36, metrics["volume"] * 0.56))
    if kind == "column":
        return _round(max(metrics["volume"] * 0.92, metrics["surfaceArea"] / 28))
    if kind == "beam":
        return _round(max(metrics["volume"] * 0.82, metrics["surfaceArea"] / 30))
    if kind == "stair":
        return _round(max(metrics["volume"] * 0.96, metrics["surfaceArea"] / 24))
    if kind == "door":
        return _round(max(0.35, metrics["faceArea"] / 8))
    if kind == "window":
        return _round(max(0.4, metrics["faceArea"] / 7))
    if kind == "member":
        return _round(max(metrics["volume"] * 1.0, metrics["surfaceArea"] / 24))
    if kind == "space":
        return _round(max(0.5, metrics["volume"] * 0.1))
    return _round(max(metrics["volume"] * 0.64, metrics["surfaceArea"] / 28))


def _build_element_assessment(element: Dict[str, Any]):
    base_props = _get_base_properties(element)
    classifier_input = " ".join(
        str(value)
        for value in [
            element.get("type"),
            element.get("name"),
            base_props.get("ObjectType"),
            base_props.get("PredefinedType"),
            base_props.get("Name"),
        ]
        if value
    )
    raw_type = _normalize_kind(classifier_input)
    dimensions = _get_conservative_dimensions(element)
    metrics = _dimension_metrics(dimensions)
    inferred_kind = _infer_kind_from_dimensions(metrics)
    classification = _choose_conservative_kind(raw_type, inferred_kind, metrics)
    material_lines = _get_material_plan(classification, dimensions, metrics)
    labor_days = _labor_days(classification, metrics)
    return {
        "id": element.get("id") or element.get("name") or classification,
        "name": element.get("name") or classification,
        "rawType": raw_type,
        "classification": classification,
        "dimensions": dimensions,
        "metrics": metrics,
        "materialLines": material_lines,
        "laborDays": labor_days,
    }


def _detect_building_type(project_id: str | None, fit_result: Dict[str, Any], element_counts: Dict[str, int]):
    label = str(project_id or "").lower()
    if any(token in label for token in ["house", "residential", "villa"]):
        return "house"
    land_area = _positive(fit_result.get("land_area_sqm") or fit_result.get("landAreaSqm"), 0.0)
    footprint = _positive(fit_result.get("model_footprint_area_sqm") or fit_result.get("footprintAreaSqm"), 0.0)
    floors = max(1, round((element_counts.get("slab", 1)) / 2))
    if (land_area > 0 and land_area <= 1200 and footprint <= 450 and floors <= 3) or footprint <= 280:
        return "house"
    return "generic"


def _safe_model_project_id(model: Dict[str, Any]):
    return model.get("project_id") if isinstance(model, dict) else None


def _material_rates():
    return {
        "reinforced concrete": 5000,
        "TMT rebar steel": 65,
        "formwork / shuttering": 350,
        "cement plaster": 250,
        "screed / finishing mortar": 200,
        "waterproofing membrane": 450,
        "structural steel": 85,
        "shop primer / coating": 150,
        "high-strength bolts": 4000,
        "patch repair mortar": 200,
        "finishing mortar / treads": 300,
        "solid-core door leaf": 6000,
        "door frame": 400,
        "hardware set": 1200,
        "sealant / filler": 80,
        "laminated glass": 1800,
        "aluminum window frame": 500,
        "sealant / gasket": 80,
        "fixing hardware": 600,
    }


def _labor_rates():
    return {
        "project_manager": 2200,
        "architect": 2400,
        "structural_engineer": 2600,
        "civil_engineer": 2200,
        "quantity_surveyor": 1800,
        "site_supervisor": 1500,
        "safety_officer": 1400,
        "surveyor": 1200,
        "equipment_operator": 1100,
        "excavation_worker": 800,
        "helper": 600,
        "mason": 900,
        "carpenter": 900,
        "steel_fixer": 900,
        "concrete_worker": 850,
        "welder": 1000,
        "electrician": 1000,
        "plumber": 950,
        "hvac_technician": 1200,
        "painter": 850,
        "tile_setter": 900,
        "glass_installer": 950,
        "false_ceiling_worker": 850,
        "polisher": 850,
    }


def _classify_material_phase(material_name: str):
    name = material_name.lower()
    if any(token in name for token in ["survey", "permit", "stake", "site", "excav", "clearing", "temporary"]):
        return "site_preparation"
    if any(token in name for token in ["concrete", "rebar", "steel", "formwork", "shuttering", "mortar", "masonry", "brick", "beam", "column", "slab", "roof", "stair"]):
        return "structural_construction"
    if any(token in name for token in ["electrical", "wire", "plumb", "pipe", "hvac", "duct", "switch", "light"]):
        return "mep"
    if any(token in name for token in ["paint", "tile", "glass", "door", "window", "ceiling", "finish", "plaster", "polish", "membrane", "frame"]):
        return "finishing_work"
    return "core_planning"


def _default_phases(duration_days: int, building_type: str, element_counts: Dict[str, int]):
    phase_specs = [
        ("core_planning_design", "Core Planning & Design", 0.12),
        ("site_preparation", "Site Preparation", 0.10),
        ("structural_construction", "Structural Construction", 0.38),
        ("mep", "Mechanical, Electrical & Plumbing", 0.15),
        ("finishing_work", "Finishing Work", 0.17),
        ("management_oversight", "Management & Oversight", 0.08),
    ]
    if building_type == "house" and element_counts.get("door", 0) <= 2 and element_counts.get("window", 0) <= 4:
        phase_specs[1] = ("site_preparation", "Site Preparation", 0.08)
        phase_specs[4] = ("finishing_work", "Finishing Work", 0.20)

    remaining = max(1, duration_days)
    phases = []
    for index, (phase_id, name, share) in enumerate(phase_specs, start=1):
        if index < len(phase_specs):
            days = max(1, round(duration_days * share))
            remaining -= days
        else:
            days = max(1, remaining)
        phases.append({
            "id": phase_id,
            "name": name,
            "sequence": index,
            "durationDays": days,
            "durationPercent": round((days / max(duration_days, 1)) * 100, 1),
            "deliverables": _phase_deliverables(phase_id),
            "tasks": _phase_tasks(phase_id),
            "dependencies": [] if index == 1 else [phases[-1]["id"]],
        })
    return phases


def _phase_deliverables(phase_id: str):
    return {
        "core_planning_design": ["Approved concept plan", "Structural scheme", "Cost baseline", "Execution roadmap"],
        "site_preparation": ["Survey control points", "Cleared site", "Excavation levels", "Access and logistics setup"],
        "structural_construction": ["Foundation", "Frame and slabs", "Walls and stair structure", "Curing and inspection records"],
        "mep": ["Electrical rough-in", "Plumbing rough-in", "HVAC duct and equipment rough-in"],
        "finishing_work": ["Paint and coatings", "Floor finishes", "Doors and glazing", "Ceilings and final fixtures"],
        "management_oversight": ["Progress sign-off", "Safety compliance", "Budget variance review", "Handover package"],
    }.get(phase_id, ["Phase complete"])


def _phase_tasks(phase_id: str):
    return {
        "core_planning_design": ["Validate requirements", "Freeze drawings", "Quantify major materials"],
        "site_preparation": ["Set out boundaries", "Clear site", "Excavate foundations", "Place temporary utilities"],
        "structural_construction": ["Build formwork", "Fix reinforcement", "Pour concrete", "Cure and strip"],
        "mep": ["Install conduits", "Lay pipes", "Mount equipment", "Test services"],
        "finishing_work": ["Paint surfaces", "Install tiles", "Fit doors and glass", "Finish ceilings"],
        "management_oversight": ["Monitor schedule", "Review quality", "Control budget", "Close out handover"],
    }.get(phase_id, ["Execute phase work"])


def _safe_json_from_response(content: Any):
    if not isinstance(content, str):
        return None
    match = re.search(r"\{.*\}", content, re.S)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except Exception:
        return None


def _analysis_node(state: ReportState):
    request = state["request"]
    model = request.get("model") or {}
    elements = model.get("elements") if isinstance(model.get("elements"), list) else []
    print("[workflow/report][analysis] start", {
        "elements": len(elements),
        "project_id": model.get("project_id"),
        "groq_key_present": bool(os.getenv("GROQ_API_KEY", "").strip()),
    }, flush=True)
    assessments = [_build_element_assessment(element if isinstance(element, dict) else {}) for element in elements]

    element_counts: Dict[str, int] = {}
    type_quantities: Dict[str, Dict[str, Any]] = {}
    material_estimate: Dict[str, Dict[str, Any]] = {}
    warnings: List[str] = []
    assumptions = [
        "The report uses element bounding dimensions, not just IFC type labels.",
        "Missing or ambiguous geometry is classified using the safer material and labor profile.",
        "Material allowances include additional waste, shuttering, reinforcement, and finishing overhead.",
    ]
    fit_result = request.get("fitResult") or {}
    environmental_summary = fit_result.get("environmental_summary") or fit_result.get("environmentalSummary") or {}
    infrastructure_summary = fit_result.get("infrastructure_summary") or fit_result.get("infrastructureSummary") or {}

    total_labor_days = 0.0
    total_volume = 0.0
    total_footprint_area = 0.0
    total_surface_area = 0.0

    for assessment in assessments:
        classification = assessment["classification"]
        element_counts[classification] = element_counts.get(classification, 0) + 1
        takeoff_quantity = assessment["metrics"]["faceArea"] if classification in {"door", "window"} else assessment["metrics"]["volume"]
        unit = "sqm" if classification in {"door", "window"} else "cum"
        current = type_quantities.get(classification) or {"count": 0, "quantity": 0.0, "unit": unit}
        current["count"] += 1
        current["quantity"] = _round(current["quantity"] + takeoff_quantity)
        current["unit"] = unit
        type_quantities[classification] = current
        for line in assessment["materialLines"]:
            key = f"{line['material']}:{classification}:{line['unit']}"
            existing = material_estimate.get(key) or {
                "elementCount": 0,
                "quantity": 0.0,
                "quantityRange": {"min": 0.0, "max": 0.0},
                "unit": line["unit"],
                "basis": line["basis"],
            }
            existing["elementCount"] += 1
            existing["quantity"] = _round(existing["quantity"] + line["quantity"])
            existing["quantityRange"]["min"] = _round(existing["quantityRange"]["min"] + line["quantityRange"]["min"])
            existing["quantityRange"]["max"] = _round(existing["quantityRange"]["max"] + line["quantityRange"]["max"])
            existing["unit"] = line["unit"]
            existing["basis"] = line["basis"]
            material_estimate[key] = existing
        total_labor_days = _round(total_labor_days + assessment["laborDays"])
        total_volume = _round(total_volume + assessment["metrics"]["volume"])
        total_footprint_area = _round(total_footprint_area + assessment["metrics"]["footprintArea"])
        total_surface_area = _round(total_surface_area + assessment["metrics"]["surfaceArea"])

    if not elements:
        warnings.append("No IFC elements were found in the uploaded model, so the report falls back to minimal allowances.")
    if not element_counts.get("wall"):
        warnings.append("No wall-like elements were detected in the model geometry.")
    if not element_counts.get("slab"):
        warnings.append("No slab-like elements were detected in the model geometry.")
    if environmental_summary.get("flood_risk_level") in {"high", "critical"}:
        warnings.append("GIS screening flagged elevated flood or water-edge risk for the selected parcel.")
    if environmental_summary.get("sensitivity_level") in {"high", "critical"}:
        warnings.append("GIS screening detected environmentally sensitive context that may affect approvals and setbacks.")
    if infrastructure_summary.get("readiness_level") in {"low", "elevated"}:
        warnings.append("GIS screening indicates below-target infrastructure readiness, so utility extension scope should be validated.")
    if infrastructure_summary.get("missing_utilities"):
        warnings.append(
            "Missing or distant utility categories: "
            + ", ".join(sorted(str(item) for item in infrastructure_summary.get("missing_utilities", [])))
            + "."
        )

    assumptions.extend([
        "Environmental and infrastructure scores are GIS screening indicators derived from mapped OSM context and should be confirmed during due diligence.",
        "Utility readiness reflects mapped proximity, not guaranteed service capacity or entitlement.",
    ])

    building_type = _detect_building_type(_safe_model_project_id(model), request.get("fitResult") or {}, element_counts)
    if building_type == "house":
        concrete_keys = [key for key in material_estimate if key.startswith("reinforced concrete:") and key.endswith(":cum")]
        steel_keys = [key for key in material_estimate if key.startswith("TMT rebar steel:") and key.endswith(":kg")]
        for keys, limit, warning in [
            (concrete_keys, 200, "Concrete total capped for house profile to keep estimates within practical residential range."),
            (steel_keys, 15000, "Steel total capped for house profile to keep estimates within practical residential range."),
        ]:
            total = sum(material_estimate[key]["quantity"] for key in keys)
            if total > limit and total > 0:
                factor = limit / total
                for key in keys:
                    material_estimate[key]["quantity"] = _round(material_estimate[key]["quantity"] * factor)
                    material_estimate[key]["quantityRange"]["min"] = _round(material_estimate[key]["quantityRange"]["min"] * factor)
                    material_estimate[key]["quantityRange"]["max"] = _round(material_estimate[key]["quantityRange"]["max"] * factor)
                    material_estimate[key]["basis"] = f"{material_estimate[key]['basis']}; house cap applied"
                warnings.append(warning)

    material_totals = {
        "totalElements": 0,
        "totalQuantity": 0.0,
        "totalQuantityRange": {"min": 0.0, "max": 0.0},
    }
    for item in material_estimate.values():
        material_totals["totalElements"] += item["elementCount"]
        material_totals["totalQuantity"] = _round(material_totals["totalQuantity"] + item["quantity"])
        material_totals["totalQuantityRange"]["min"] = _round(material_totals["totalQuantityRange"]["min"] + item["quantityRange"]["min"])
        material_totals["totalQuantityRange"]["max"] = _round(material_totals["totalQuantityRange"]["max"] + item["quantityRange"]["max"])

    duration_scale = 0.42 if building_type == "house" else 0.55
    duration_mid = max(1, math.ceil(total_labor_days * duration_scale))
    phase_shares = {
        "planning": 0.13,
        "sitePreparation": 0.09,
        "structural": 0.34,
        "mep": 0.16,
        "finishes": 0.20,
        "management": 0.08,
    }
    # compute preliminary phase days from mid estimate
    phase_days = {k: max(1, math.ceil(duration_mid * v)) for k, v in phase_shares.items()}
    estimated_duration_days = sum(phase_days.values())
    # enforce sensible project duration bounds (6 - 12 months) so small samples don't produce unrealistically short timelines
    MIN_DURATION_DAYS = 180  # ~6 months
    MAX_DURATION_DAYS = 365  # ~12 months
    if estimated_duration_days < MIN_DURATION_DAYS:
        scale = MIN_DURATION_DAYS / max(estimated_duration_days, 1)
        phase_days = {k: max(1, math.ceil(v * scale)) for k, v in phase_days.items()}
        estimated_duration_days = sum(phase_days.values())
    elif estimated_duration_days > MAX_DURATION_DAYS:
        scale = MAX_DURATION_DAYS / estimated_duration_days
        phase_days = {k: max(1, math.ceil(v * scale)) for k, v in phase_days.items()}
        estimated_duration_days = sum(phase_days.values())

    duration_range_days = {
        "min": max(1, math.ceil(estimated_duration_days * 0.8)),
        "max": max(1, math.ceil(estimated_duration_days * 1.3)),
    }
    print("[workflow/report][analysis] done", {
        "building_type": building_type,
        "element_counts": element_counts,
        "material_lines": len(material_estimate),
        "estimated_duration_days": estimated_duration_days,
    }, flush=True)
    worker_mid = max(
        4,
        math.ceil(
            math.sqrt(max(total_footprint_area, 1.0)) / 10 +
            math.cbrt(max(total_volume, 1.0)) / 5 +
            len(elements) / 25 +
            (0.8 if building_type == "house" else 1.0)
        ),
    )
    workforce_estimate = {
        "totalRecommendedWorkers": worker_mid,
        "peakCrewSize": worker_mid,
        "totalWorkerRange": {"min": max(3, math.ceil(worker_mid * 0.75)), "max": max(4, math.ceil(worker_mid * 1.2))},
        "recommendedWorkerMix": [],
    }

    material_cost_rates = _material_rates()
    labor_cost_rates = _labor_rates()
    total_material_cost = 0.0
    material_costs: Dict[str, float] = {}
    for key, item in material_estimate.items():
        material = key.split(":")[0]
        cost = material_cost_rates.get(material, 0) * item["quantity"]
        material_costs[key] = cost
        total_material_cost += cost

    total_labor_cost = 0

    return {
        "analysis": {
            "elementCounts": element_counts,
            "detailedTakeoff": {
                "structural": [{"type": item_type, **(type_quantities.get(item_type) or {"count": 0, "quantity": 0.0, "unit": "cum"})} for item_type in [t for t in STRUCTURAL_TYPES if t not in {"proxy", "unknown"}]],
                "openings": [{"type": item_type, **(type_quantities.get(item_type) or {"count": 0, "quantity": 0.0, "unit": "sqm"})} for item_type in OPENING_TYPES],
                "others": [{"type": item_type, **data} for item_type, data in type_quantities.items() if item_type not in STRUCTURAL_TYPES and item_type not in OPENING_TYPES],
            },
            "dimensionSummary": {
                "totalElements": len(elements),
                "totalVolume": _round(total_volume),
                "totalFootprintArea": _round(total_footprint_area),
                "totalSurfaceArea": _round(total_surface_area),
            },
            "materialEstimate": [
                {"material": key.split(":")[0], "elementType": key.split(":")[1], **value}
                for key, value in material_estimate.items()
            ],
            "materialTotals": material_totals,
            "estimatedDurationDays": estimated_duration_days,
            "durationRangeDays": duration_range_days,
            "phaseDays": phase_days,
            "workforceEstimate": workforce_estimate,
            "costEstimate": {
                "totalMaterialCost": round(total_material_cost),
                "totalLaborCost": round(total_labor_cost),
                "subtotalCost": 0,
                "contingencyCost": 0,
                "totalBudget": 0,
                "materialCosts": material_costs,
            },
            "elementAssessments": assessments,
            "warnings": warnings,
            "assumptions": assumptions,
            "buildingType": building_type,
        }
    }


def _timeline_node(state: ReportState):
    analysis = state["analysis"]
    prompt = SystemMessage(content=(
        "You are a construction planning agent. Return only strict JSON. "
        "Generate 6 phases for a building project. Each phase must include id, name, sequence, durationDays, durationPercent, deliverables, tasks, and dependencies. "
        "Use conventional construction sequencing and make the plan practical for the provided project metrics."
    ))
    summary = HumanMessage(content=json.dumps({
        "buildingType": analysis["buildingType"],
        "estimatedDurationDays": analysis["estimatedDurationDays"],
        "phaseDays": analysis["phaseDays"],
        "elementCounts": analysis["elementCounts"],
        "dimensionSummary": analysis["dimensionSummary"],
    }))
    fallback_phases = _default_phases(analysis["estimatedDurationDays"], analysis["buildingType"], analysis["elementCounts"])
    try:
        api_key = os.getenv("GROQ_API_KEY", "").strip()
        if not api_key:
            print("[workflow/report][timeline] GROQ_API_KEY missing, using fallback phases", flush=True)
            return {"timeline": fallback_phases}

        llm = ChatGroq(
            model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            api_key=api_key,
            temperature=0.2,
        )
        response = llm.invoke([prompt, summary])
        parsed = _safe_json_from_response(getattr(response, "content", ""))
        phases = parsed.get("phases") if isinstance(parsed, dict) else None
        if not isinstance(phases, list) or not phases:
            raise ValueError("Timeline agent returned no phases")
        print("[workflow/report][timeline] groq phases received", {"phases": len(phases)}, flush=True)
        normalized = []
        for index, phase in enumerate(phases, start=1):
            phase_duration = int(phase.get("durationDays") or fallback_phases[index - 1]["durationDays"])
            canonical_id = _canonical_phase_id(phase.get("id"), phase.get("name"), fallback_phases[index - 1]["id"])
            normalized.append({
                "id": canonical_id,
                "name": str(phase.get("name") or fallback_phases[index - 1]["name"]),
                "sequence": int(phase.get("sequence") or index),
                "durationDays": max(1, phase_duration),
                "durationPercent": float(phase.get("durationPercent") or round((phase_duration / max(analysis["estimatedDurationDays"], 1)) * 100, 1)),
                "deliverables": phase.get("deliverables") if isinstance(phase.get("deliverables"), list) else fallback_phases[index - 1]["deliverables"],
                "tasks": phase.get("tasks") if isinstance(phase.get("tasks"), list) else fallback_phases[index - 1]["tasks"],
                "dependencies": phase.get("dependencies") if isinstance(phase.get("dependencies"), list) else fallback_phases[index - 1]["dependencies"],
            })
        return {"timeline": normalized}
    except Exception:
        print("[workflow/report][timeline] fallback due to exception", traceback.format_exc(), flush=True)
        return {"timeline": fallback_phases}


def _phase_deliverables(phase_id: str):
    return {
        "core_planning_design": ["Approved concept plan", "Structural scheme", "Cost baseline", "Execution roadmap"],
        "site_preparation": ["Survey control points", "Cleared site", "Excavation levels", "Access and logistics setup"],
        "structural_construction": ["Foundation", "Frame and slabs", "Walls and stair structure", "Curing and inspection records"],
        "mep": ["Electrical rough-in", "Plumbing rough-in", "HVAC duct and equipment rough-in"],
        "finishing_work": ["Paint and coatings", "Floor finishes", "Doors and glazing", "Ceilings and final fixtures"],
        "management_oversight": ["Progress sign-off", "Safety compliance", "Budget variance review", "Handover package"],
    }.get(phase_id, ["Phase complete"])


def _phase_tasks(phase_id: str):
    return {
        "core_planning_design": ["Validate requirements", "Freeze drawings", "Quantify major materials"],
        "site_preparation": ["Set out boundaries", "Clear site", "Excavate foundations", "Place temporary utilities"],
        "structural_construction": ["Build formwork", "Fix reinforcement", "Pour concrete", "Cure and strip"],
        "mep": ["Install conduits", "Lay pipes", "Mount equipment", "Test services"],
        "finishing_work": ["Paint surfaces", "Install tiles", "Fit doors and glass", "Finish ceilings"],
        "management_oversight": ["Monitor schedule", "Review quality", "Control budget", "Close out handover"],
    }.get(phase_id, ["Execute phase work"])


def _materials_node(state: ReportState):
    analysis = state["analysis"]
    timeline = state["timeline"]
    phase_map = {phase["id"]: {"phaseId": phase["id"], "phaseName": phase["name"], "materials": []} for phase in timeline}
    canonical_lookup = {_canonical_phase_id(phase.get("id"), phase.get("name")): phase["id"] for phase in timeline}
    structural_phase_id = canonical_lookup.get("structural_construction") or next(iter(phase_map.keys()), "core_planning_design")
    print("[workflow/report][materials] start", {"timeline_phases": len(timeline), "material_lines": len(analysis["materialEstimate"])}, flush=True)
    for material in analysis["materialEstimate"]:
        phase_bucket = _classify_material_phase(str(material["material"]))
        target_phase = canonical_lookup.get(phase_bucket, structural_phase_id)
        phase_map[target_phase]["materials"].append(material)
    print("[workflow/report][materials] done", {"phases": len(phase_map)}, flush=True)
    return {"phaseMaterials": list(phase_map.values())}


def _classify_material_phase(material_name: str):
    name = material_name.lower()
    if any(token in name for token in ["survey", "permit", "stake", "site", "excav", "clearing", "temporary"]):
        return "site_preparation"
    if any(token in name for token in ["concrete", "rebar", "steel", "formwork", "shuttering", "mortar", "masonry", "brick", "beam", "column", "slab", "roof", "stair"]):
        return "structural_construction"
    if any(token in name for token in ["electrical", "wire", "plumb", "pipe", "hvac", "duct", "switch", "light"]):
        return "mep"
    if any(token in name for token in ["paint", "tile", "glass", "door", "window", "ceiling", "finish", "plaster", "polish", "membrane", "frame"]):
        return "finishing_work"
    return "core_planning_design"


def _canonical_phase_id(phase_id: Any = None, phase_name: Any = None, fallback: str = "core_planning_design"):
    text = f"{phase_id or ''} {phase_name or ''}".lower()
    if any(token in text for token in ["planning", "design", "core"]):
        return "core_planning_design"
    if any(token in text for token in ["site", "preparation", "excavat", "survey"]):
        return "site_preparation"
    if any(token in text for token in ["structural", "structure", "frame", "skeleton", "construction"]):
        return "structural_construction"
    if any(token in text for token in ["mep", "mechanical", "electrical", "plumb", "hvac", "services"]):
        return "mep"
    if any(token in text for token in ["finish", "finishing", "interior", "fit-out"]):
        return "finishing_work"
    if any(token in text for token in ["management", "oversight", "handover", "closeout"]):
        return "management_oversight"
    return fallback


def _build_phase_workers(phase: Dict[str, Any], analysis: Dict[str, Any], phase_materials: Dict[str, Any]):
    complexity = _clamp(
        math.sqrt(max(analysis["dimensionSummary"]["totalFootprintArea"], 1.0)) / 12 +
        math.cbrt(max(analysis["dimensionSummary"]["totalVolume"], 1.0)) / 8 +
        len(phase_materials["materials"]) / 12,
        0.75,
        3.0,
    )
    phase_name = phase["name"].lower()
    role_templates: List[tuple[str, str, str, float, List[str]]] = [
        ("project_manager", "Project Manager", "management", 0.55, ["Coordinate the project", "Track schedule and budget"]),
        ("site_supervisor", "Site Supervisor", "management", 0.7, ["Direct daily site execution", "Check trade coordination"]),
        ("safety_officer", "Safety Officer", "management", 0.45, ["Enforce safety controls", "Monitor risk on site"]),
    ]
    if "planning" in phase_name or "design" in phase_name:
        role_templates += [
            ("architect", "Architect", "engineering", 0.6, ["Define layout and aesthetics", "Resolve spatial coordination"]),
            ("structural_engineer", "Structural Engineer", "engineering", 0.6, ["Validate structure", "Confirm load strategy"]),
            ("civil_engineer", "Civil Engineer", "engineering", 0.55, ["Plan site works", "Coordinate foundation and drainage"]),
            ("quantity_surveyor", "Quantity Surveyor", "engineering", 0.55, ["Estimate quantities", "Prepare budget baseline"]),
        ]
    elif "site" in phase_name or "preparation" in phase_name:
        role_templates += [
            ("surveyor", "Surveyor", "specialized", 0.75, ["Set out boundaries", "Mark levels and control points"]),
            ("equipment_operator", "Equipment Operator", "specialized", 0.9, ["Operate JCB, cranes, and dozers"]),
            ("excavation_worker", "Excavation Worker", "labor", 1.2, ["Clear land", "Dig and prepare foundations"]),
            ("helper", "General Helper", "labor", 1.4, ["Support setup and logistics"]),
        ]
    elif "structural" in phase_name or "construction" in phase_name:
        role_templates += [
            ("mason", "Mason", "labor", 1.4, ["Brickwork and wall building"]),
            ("carpenter", "Carpenter", "labor", 1.1, ["Formwork and shuttering"]),
            ("steel_fixer", "Steel Fixer", "labor", 1.3, ["Reinforcement placement"]),
            ("concrete_worker", "Concrete Worker", "labor", 1.2, ["Pouring and finishing concrete"]),
            ("welder", "Welder", "specialized", 0.65, ["Structural joints and metal frame connections"]),
            ("equipment_operator", "Equipment Operator", "specialized", 0.75, ["Hoisting and heavy equipment handling"]),
        ]
    elif "mep" in phase_name or "mechanical" in phase_name or "electrical" in phase_name:
        role_templates += [
            ("electrician", "Electrician", "specialized", 1.2, ["Wiring and lighting systems"]),
            ("plumber", "Plumber", "specialized", 1.0, ["Water supply and drainage"]),
            ("hvac_technician", "HVAC Technician", "specialized", 0.7, ["Ventilation and AC systems"]),
            ("helper", "General Helper", "labor", 1.0, ["Material handling and support"]),
        ]
    elif "finish" in phase_name:
        role_templates += [
            ("painter", "Painter", "labor", 1.0, ["Interior and exterior painting"]),
            ("tile_setter", "Tile Setter", "labor", 0.9, ["Flooring and wet-area finishes"]),
            ("glass_installer", "Glass Installer", "specialized", 0.7, ["Windows and glazing"]),
            ("false_ceiling_worker", "False Ceiling Worker", "labor", 0.8, ["Ceiling systems and trim"]),
            ("polisher", "Polisher", "specialized", 0.6, ["Final surface polish and detailing"]),
        ]
    else:
        role_templates += [("quantity_surveyor", "Quantity Surveyor", "engineering", 0.5, ["Monitor quantities and handoff progress"])]

    materials_factor = 1.0 + min(0.45, len(phase_materials["materials"]) / 30)
    workers = []
    for role, title, category, base_share, responsibilities in role_templates:
        quantity = max(1, round(base_share * complexity * materials_factor))
        if role == "project_manager":
            quantity = 1
        if role == "site_supervisor" and phase["sequence"] > 1:
            quantity = 1
        workers.append({
            "role": role,
            "title": title,
            "category": category,
            "quantity": quantity,
            "phaseId": phase["id"],
            "phaseName": phase["name"],
            "duration": "full_phase",
            "responsibilities": responsibilities,
        })
    return workers


def _workforce_node(state: ReportState):
    analysis = state["analysis"]
    timeline = state["timeline"]
    phase_materials = state["phaseMaterials"]
    print("[workflow/report][workforce] start", {"timeline_phases": len(timeline)}, flush=True)
    workforce_by_phase: List[Dict[str, Any]] = []
    aggregate: Dict[str, int] = {}

    for phase in timeline:
        phase_pack = next((item for item in phase_materials if item["phaseId"] == phase["id"]), {"phaseId": phase["id"], "phaseName": phase["name"], "materials": []})
        workers = _build_phase_workers(phase, analysis, phase_pack)
        total_crew = sum(worker["quantity"] for worker in workers)
        workforce_by_phase.append({
            "phaseId": phase["id"],
            "phaseName": phase["name"],
            "sequence": phase["sequence"],
            "workers": workers,
            "totalCrew": total_crew,
            "peakCrew": total_crew,
        })
        for worker in workers:
            aggregate[worker["role"]] = aggregate.get(worker["role"], 0) + worker["quantity"]
    # Deduplicate management roles: assume the same project manager, site supervisor and safety officer cover all phases
    for mgmt_role in ("project_manager", "site_supervisor", "safety_officer"):
        if aggregate.get(mgmt_role, 0) > 0:
            aggregate[mgmt_role] = 1

    recommended_worker_mix = [{"role": role, "count": count} for role, count in sorted(aggregate.items(), key=lambda item: item[0])]
    peak = max((phase["peakCrew"] for phase in workforce_by_phase), default=0)
    print("[workflow/report][workforce] done", {"peak": peak, "roles": len(recommended_worker_mix)}, flush=True)
    return {
        "workforceByPhase": workforce_by_phase,
        "recommendedWorkerMix": recommended_worker_mix,
        "workforceEstimate": {
            "totalRecommendedWorkers": peak,
            "peakCrewSize": peak,
            "totalWorkerRange": {"min": max(2, math.ceil(peak * 0.8)), "max": max(3, math.ceil(peak * 1.25))},
            "recommendedWorkerMix": recommended_worker_mix,
        },
    }


def _assemble_node(state: ReportState):
    analysis = state["analysis"]
    timeline = state["timeline"]
    phase_materials = state["phaseMaterials"]
    workforce = state["workforceByPhase"]
    total_material_cost = float(analysis["costEstimate"]["totalMaterialCost"])
    labor_rates = _labor_rates()
    total_labor_cost = 0.0
    phase_duration_lookup = {phase["id"]: phase["durationDays"] for phase in timeline}
    for phase in workforce:
        phase_daily_cost = sum(labor_rates.get(worker["role"], 600) * worker["quantity"] for worker in phase["workers"])
        total_labor_cost += phase_daily_cost * phase_duration_lookup.get(phase["phaseId"], 1)
    subtotal = total_material_cost + total_labor_cost
    contingency = subtotal * 0.1
    total_budget = subtotal + contingency
    aggregated_mix = state.get("recommendedWorkerMix") or analysis["workforceEstimate"]["recommendedWorkerMix"]
    if not aggregated_mix:
        aggregated_mix = []
        aggregate_counts: Dict[str, int] = {}
        for phase in workforce:
            for worker in phase["workers"]:
                aggregate_counts[worker["role"]] = aggregate_counts.get(worker["role"], 0) + worker["quantity"]
        aggregated_mix = [{"role": role, "count": count} for role, count in sorted(aggregate_counts.items(), key=lambda item: item[0])]

    peak_crew = max((phase["peakCrew"] for phase in workforce), default=analysis["workforceEstimate"]["peakCrewSize"])
    if not os.getenv("GROQ_API_KEY", "").strip():
        warnings = list(analysis["warnings"])
        warnings.append("GROQ_API_KEY is not set, so the timeline used deterministic fallback phases instead of Grok.")
    else:
        warnings = list(analysis["warnings"])

    print("[workflow/report][assemble] done", {
        "peak_crew": peak_crew,
        "total_budget": round(total_budget),
        "warnings": len(warnings),
    }, flush=True)

    return {
        "report": {
            "schemaVersion": 3,
            "generatedFrom": {
                "ifcSessionId": state["request"]["ifcSessionId"],
                "ifcProjectId": state["request"]["model"].get("project_id") or None,
                "ifcVersionNumber": state["request"]["ifcVersionNumber"],
                "validationSnapshotId": state["request"]["validationSnapshotId"],
            },
            "fitSummary": {
                "fitStatus": state["request"]["fitResult"].get("fit_status") or state["request"]["fitResult"].get("fitStatus") or None,
                "fitScore": state["request"]["fitResult"].get("fit_score") or state["request"]["fitResult"].get("fitScore") or None,
                "landAreaSqm": state["request"]["fitResult"].get("land_area_sqm") or state["request"]["fitResult"].get("landAreaSqm") or None,
                "footprintAreaSqm": state["request"]["fitResult"].get("model_footprint_area_sqm") or state["request"]["fitResult"].get("footprintAreaSqm") or None,
                "utilizationRatio": state["request"]["fitResult"].get("utilization_ratio") or state["request"]["fitResult"].get("utilizationRatio") or None,
                "roadAccess": state["request"]["fitResult"].get("road_access") or state["request"]["fitResult"].get("roadAccess") or None,
                "environmentalSummary": state["request"]["fitResult"].get("environmental_summary") or state["request"]["fitResult"].get("environmentalSummary") or None,
                "infrastructureSummary": state["request"]["fitResult"].get("infrastructure_summary") or state["request"]["fitResult"].get("infrastructureSummary") or None,
            },
            "dimensionSummary": analysis["dimensionSummary"],
            "elementCounts": analysis["elementCounts"],
            "elementAssessments": analysis["elementAssessments"],
            "detailedTakeoff": {
                "structural": analysis["detailedTakeoff"]["structural"],
                "openings": analysis["detailedTakeoff"]["openings"],
                "others": analysis["detailedTakeoff"]["others"],
                "totalElements": analysis["dimensionSummary"]["totalElements"],
                "totalMaterialLines": len(analysis["materialEstimate"]),
            },
            "materialEstimate": analysis["materialEstimate"],
            "materialTotals": analysis["materialTotals"],
            "timeEstimate": {
                "estimatedDurationDays": analysis["estimatedDurationDays"],
                "durationRangeDays": analysis["durationRangeDays"],
                "phaseDays": {
                    "structural": analysis["phaseDays"]["structural"],
                    "envelope": analysis["phaseDays"]["finishes"],
                    "finishes": analysis["phaseDays"]["finishes"],
                    "services": analysis["phaseDays"]["mep"],
                },
                "basis": "LangGraph sequential planning with geometry-led takeoff and phase-aware productivity.",
            },
            "projectTimeline": timeline,
            "materialsByPhase": phase_materials,
            "recommendedWorkerMix": aggregated_mix,
            "workforceByPhase": workforce,
            "workforceEstimate": {
                "totalRecommendedWorkers": peak_crew,
                "peakCrewSize": peak_crew,
                "totalWorkerRange": {
                    "min": max(2, math.ceil(peak_crew * 0.8)),
                    "max": max(3, math.ceil(peak_crew * 1.25)),
                },
                "recommendedWorkerMix": aggregated_mix,
            },
            "costEstimate": {
                "totalMaterialCost": round(total_material_cost),
                "totalLaborCost": round(total_labor_cost),
                "subtotalCost": round(subtotal),
                "contingencyCost": round(contingency),
                "totalBudget": round(total_budget),
                "materialCosts": analysis["costEstimate"]["materialCosts"],
            },
            "projectHandoff": {
                "warnings": warnings,
                "assumptions": analysis["assumptions"],
                "nextStep": "Review the animated timeline and phase-based workforce plan before moving to hiring and procurement.",
            },
        }
    }


def build_report_payload(request: Dict[str, Any]):
    graph = StateGraph(ReportState)
    graph.add_node("analysis", _analysis_node)
    graph.add_node("timeline", _timeline_node)
    graph.add_node("materials", _materials_node)
    graph.add_node("workforce", _workforce_node)
    graph.add_node("assemble", _assemble_node)
    graph.set_entry_point("analysis")
    graph.add_edge("analysis", "timeline")
    graph.add_edge("timeline", "materials")
    graph.add_edge("materials", "workforce")
    graph.add_edge("workforce", "assemble")
    graph.add_edge("assemble", END)
    compiled = graph.compile()
    result = compiled.invoke({"request": request})
    return result["report"]
