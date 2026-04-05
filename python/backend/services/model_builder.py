"""
Model Builder: Parse IFC files into simplified internal JSON representation.
This is the single source of truth for the 3D model.

Output JSON schema:
{
    "project_id": str,
    "elements": [
        {
            "id": unique_id,
            "type": element_type (wall, column, slab, etc.),
            "geometry": {
                "type": "parametric" | "mesh",
                "data": {...}
            },
            "properties": {
                "height": number,
                "thickness": number,
                "material": string,
                ...
            },
            "transform": {
                "translation": [x, y, z],
                "rotation": [qx, qy, qz, qw],
                "scale": [sx, sy, sz]
            },
            "color": [r, g, b] optional
        }
    ]
}
"""

import ifcopenshell
import ifcopenshell.geom
import json
import numpy as np
from typing import Dict, List, Any, Tuple


ELEMENT_TYPES = {
    "IfcWall": "wall",
    "IfcColumn": "column",
    "IfcSlab": "slab",
    "IfcDoor": "door",
    "IfcWindow": "window",
    "IfcBeam": "beam",
    "IfcRoof": "roof",
    "IfcSpace": "space",
    "IfcStair": "stair",
    "IfcMember": "member",
}


def _map_ifc_type(ifc_class: str) -> str | None:
    """Map IFC class names (including subclass variants) to internal type names."""
    if ifc_class in ELEMENT_TYPES:
        return ELEMENT_TYPES[ifc_class]

    # Accept common subclass names like IfcWallStandardCase, etc.
    for key, value in ELEMENT_TYPES.items():
        if ifc_class.startswith(key):
            return value

    # Keep proxies/generic building elements instead of dropping everything.
    if ifc_class in {"IfcBuildingElementProxy", "IfcElementAssembly"}:
        return "member"

    return None


def build_internal_model(ifc_path: str, project_id: str) -> Dict[str, Any]:
    """
    Parse IFC file and build internal JSON model.
    
    Args:
        ifc_path: Path to IFC file
        project_id: Unique project identifier
        
    Returns:
        Model dict with elements array
    """
    ifc_file = ifcopenshell.open(ifc_path)
    
    model = {
        "project_id": project_id,
        "elements": []
    }
    
    # Get all geometry elements
    for element in ifc_file.by_type("IfcProduct"):
        ifc_class = element.is_a()

        element_type = _map_ifc_type(ifc_class)

        # Skip if not a recognized or mappable type
        if not element_type:
            continue
        
        # Extract element data
        element_id = element.GlobalId
        element_name = element.Name or f"{element_type}_{element_id[:8]}"
        
        # Get geometry
        geometry = _extract_geometry(element)
        if not geometry:
            continue
        
        # Get properties
        properties = _extract_properties(element)
        
        # Use identity transform: mesh geometry is already in world coords
        # (ifcopenshell USE_WORLD_COORDS=True).  The transform field now
        # exclusively represents user-driven modifications via the chatbot.
        transform = {
            "translation": [0.0, 0.0, 0.0],
            "rotation": [0.0, 0.0, 0.0, 1.0],
            "scale": [1.0, 1.0, 1.0]
        }
        
        # Get color if available
        color = _extract_color(element)
        
        model_element = {
            "id": element_id,
            "type": element_type,
            "name": element_name,
            "geometry": geometry,
            "properties": properties,
            "transform": transform,
        }
        
        if color:
            model_element["color"] = color
        
        model["elements"].append(model_element)
    
    return model


def _extract_geometry(element) -> Dict[str, Any] | None:
    """Extract geometry from IFC element."""
    try:
        representation = element.Representation
        if not representation:
            return None
        
        # Try parametric first (for standard shapes)
        parametric = _extract_parametric_geometry(element)
        if parametric:
            return parametric
        
        # Fall back to mesh
        mesh = _extract_mesh_geometry(element)
        if mesh:
            return mesh
        
        return None
    except Exception as e:
        print(f"Error extracting geometry for {element.GlobalId}: {e}")
        return None


def _extract_parametric_geometry(element) -> Dict[str, Any] | None:
    """Extract parametric geometry (dimensions) for standard shapes."""
    try:
        ifc_class = element.is_a()
        
        # Wall: height, thickness, start/end points
        if ifc_class == "IfcWall":
            height = _get_height(element)
            thickness = _get_thickness(element)
            
            if height and thickness:
                # Try to get baseline (start/end points)
                start, end = _get_baseline(element)
                return {
                    "type": "parametric",
                    "shape": "wall",
                    "height": height,
                    "thickness": thickness,
                    "start": start or [0, 0, 0],
                    "end": end or [1, 0, 0]
                }
        
        # Column: width, depth, height
        elif ifc_class == "IfcColumn":
            height = _get_height(element)
            width = _get_width(element)
            depth = _get_depth(element)
            
            if height and width and depth:
                return {
                    "type": "parametric",
                    "shape": "column",
                    "width": width,
                    "depth": depth,
                    "height": height
                }
        
        # Slab: length, width, thickness
        elif ifc_class == "IfcSlab":
            length = _get_length(element)
            width = _get_width(element)
            thickness = _get_thickness(element)
            
            if length and width and thickness:
                return {
                    "type": "parametric",
                    "shape": "slab",
                    "length": length,
                    "width": width,
                    "thickness": thickness
                }
        
        return None
    except Exception:
        return None


def _extract_mesh_geometry(element) -> Dict[str, Any] | None:
    """Extract mesh geometry from IFC element."""
    try:
        settings = ifcopenshell.geom.settings()
        settings.set(settings.USE_WORLD_COORDS, True)

        shape = ifcopenshell.geom.create_shape(settings, element)
        geom = getattr(shape, "geometry", None)
        if geom is None:
            return None

        verts = list(getattr(geom, "verts", []))
        faces = list(getattr(geom, "faces", []))

        if not verts or not faces:
            return None

        # ifcopenshell.geom provides flat arrays; reshape into triples
        if len(verts) % 3 != 0 or len(faces) % 3 != 0:
            return None

        vertices = np.array(verts, dtype=np.float64).reshape((-1, 3)).tolist()
        faces_list = np.array(faces, dtype=np.int32).reshape((-1, 3)).tolist()
        
        return {
            "type": "mesh",
            "vertices": vertices,
            "faces": faces_list
        }
    except Exception:
        return None


def _extract_properties(element) -> Dict[str, Any]:
    """Extract properties from IFC element."""
    properties = {
        "base": {}
    }
    
    # Basic properties
    if hasattr(element, "Description") and element.Description:
        properties["base"]["description"] = element.Description
    
    # Height
    height = _get_height(element)
    if height:
        properties["base"]["height"] = height
    
    # Thickness
    thickness = _get_thickness(element)
    if thickness:
        properties["base"]["thickness"] = thickness
    
    # Width
    width = _get_width(element)
    if width:
        properties["base"]["width"] = width
    
    # Depth
    depth = _get_depth(element)
    if depth:
        properties["base"]["depth"] = depth
    
    # Material
    material = _get_material(element)
    if material:
        properties["base"]["material"] = material
    
    # Property Sets
    try:
        for pset in element.IsDefinedBy:
            if pset.is_a("IfcRelDefinesByProperties"):
                rel_prop = pset.RelatingPropertyDefinition
                if rel_prop.is_a("IfcPropertySet"):
                    pset_name = rel_prop.Name
                    pset_dict = {}
                    
                    for prop in rel_prop.HasProperties:
                        if prop.is_a("IfcPropertySingleValue"):
                            prop_name = prop.Name
                            prop_value = prop.NominalValue
                            
                            if prop_value:
                                if hasattr(prop_value, "wrappedValue"):
                                    pset_dict[prop_name] = prop_value.wrappedValue
                                else:
                                    pset_dict[prop_name] = str(prop_value)
                    
                    if pset_dict:
                        properties[pset_name] = pset_dict
    except Exception:
        pass
    
    return properties


def _extract_transform(element) -> Dict[str, Any]:
    """Extract transformation (translation, rotation, scale) from IFC element."""
    transform = {
        "translation": [0.0, 0.0, 0.0],
        "rotation": [0.0, 0.0, 0.0, 1.0],  # quaternion [x, y, z, w]
        "scale": [1.0, 1.0, 1.0]
    }
    
    try:
        if element.ObjectPlacement:
            placement = element.ObjectPlacement
            
            # Extract local placement
            if placement.is_a("IfcLocalPlacement"):
                location = placement.RelativePlacement
                
                # Translation
                if location.Location:
                    coords = location.Location.Coordinates
                    transform["translation"] = [float(v) for v in coords[:3]]
                
                # Rotation (Axis2Placement3D)
                if location.is_a("IfcAxis2Placement3D"):
                    if location.MainDirection and location.RefDirection:
                        # Build rotation matrix from axes
                        axis_z = np.array(location.MainDirection.DirectionRatios, dtype=np.float64)
                        axis_x = np.array(location.RefDirection.DirectionRatios, dtype=np.float64)
                        axis_y = np.cross(axis_z, axis_x)
                        
                        # Normalize
                        axis_x = axis_x / (np.linalg.norm(axis_x) + 1e-10)
                        axis_y = axis_y / (np.linalg.norm(axis_y) + 1e-10)
                        axis_z = axis_z / (np.linalg.norm(axis_z) + 1e-10)
                        
                        # Convert rotation matrix to quaternion
                        quat = _matrix_to_quaternion(axis_x, axis_y, axis_z)
                        transform["rotation"] = list(quat)
    except Exception as e:
        print(f"Error extracting transform: {e}")
    
    return transform


def _extract_color(element) -> List[float] | None:
    """Extract RGB color from IFC element."""
    try:
        # Try to get color from presentation style
        if hasattr(element, "HasAssociations"):
            for assoc in element.HasAssociations:
                if assoc.is_a("IfcRelAssociatesMaterial"):
                    # Get material properties
                    pass
    except Exception:
        pass
    
    return None


def _get_baseline(element) -> Tuple[List[float] | None, List[float] | None]:
    """Best-effort wall baseline extraction from local placement; fallback to None."""
    try:
        if not getattr(element, "ObjectPlacement", None):
            return None, None

        placement = element.ObjectPlacement
        if not placement or not placement.is_a("IfcLocalPlacement"):
            return None, None

        rel = placement.RelativePlacement
        if not rel or not hasattr(rel, "Location") or not rel.Location:
            return None, None

        # Safely handle 2D coordinates by padding with 0.0
        raw_coords = list(rel.Location.Coordinates)
        while len(raw_coords) < 3:
            raw_coords.append(0.0)
        origin = [float(v) for v in raw_coords[:3]]

        ref_dir = [1.0, 0.0, 0.0]
        if hasattr(rel, "RefDirection") and rel.RefDirection:
            raw_dir = list(rel.RefDirection.DirectionRatios)
            while len(raw_dir) < 3:
                raw_dir.append(0.0)
            ref_dir = [float(v) for v in raw_dir[:3]]

        # Use a default segment length; true wall length is typically geometry-derived.
        length = 1.0
        start = [float(origin[0]), float(origin[1]), float(origin[2])]
        end = [
            float(origin[0] + ref_dir[0] * length),
            float(origin[1] + ref_dir[1] * length),
            float(origin[2] + ref_dir[2] * length),
        ]
        return start, end
    except Exception:
        return None, None


def _get_height(element) -> float | None:
    """Extract height property from element."""
    try:
        if hasattr(element, "Depth"):
            return element.Depth
        
        # Check properties
        for pset in getattr(element, "IsDefinedBy", []):
            if pset.is_a("IfcRelDefinesByProperties"):
                rel_prop = pset.RelatingPropertyDefinition
                if rel_prop.is_a("IfcPropertySet"):
                    for prop in rel_prop.HasProperties:
                        if prop.Name.lower() in ["height", "h"]:
                            if hasattr(prop, "NominalValue"):
                                val = prop.NominalValue
                                if hasattr(val, "wrappedValue"):
                                    return float(val.wrappedValue)
    except Exception:
        pass
    
    return None


def _get_thickness(element) -> float | None:
    """Extract thickness property from element."""
    try:
        # Check properties
        for pset in getattr(element, "IsDefinedBy", []):
            if pset.is_a("IfcRelDefinesByProperties"):
                rel_prop = pset.RelatingPropertyDefinition
                if rel_prop.is_a("IfcPropertySet"):
                    for prop in rel_prop.HasProperties:
                        if prop.Name.lower() in ["thickness", "thickness"]:
                            if hasattr(prop, "NominalValue"):
                                val = prop.NominalValue
                                if hasattr(val, "wrappedValue"):
                                    return float(val.wrappedValue)
    except Exception:
        pass
    
    return 0.1  # Default


def _get_width(element) -> float | None:
    """Extract width property from element."""
    try:
        if hasattr(element, "Width"):
            return element.Width
        
        for pset in getattr(element, "IsDefinedBy", []):
            if pset.is_a("IfcRelDefinesByProperties"):
                rel_prop = pset.RelatingPropertyDefinition
                if rel_prop.is_a("IfcPropertySet"):
                    for prop in rel_prop.HasProperties:
                        if prop.Name.lower() in ["width", "w"]:
                            if hasattr(prop, "NominalValue"):
                                val = prop.NominalValue
                                if hasattr(val, "wrappedValue"):
                                    return float(val.wrappedValue)
    except Exception:
        pass
    
    return None


def _get_depth(element) -> float | None:
    """Extract depth property from element."""
    try:
        if hasattr(element, "Depth"):
            return element.Depth
        
        for pset in getattr(element, "IsDefinedBy", []):
            if pset.is_a("IfcRelDefinesByProperties"):
                rel_prop = pset.RelatingPropertyDefinition
                if rel_prop.is_a("IfcPropertySet"):
                    for prop in rel_prop.HasProperties:
                        if prop.Name.lower() in ["depth", "d"]:
                            if hasattr(prop, "NominalValue"):
                                val = prop.NominalValue
                                if hasattr(val, "wrappedValue"):
                                    return float(val.wrappedValue)
    except Exception:
        pass
    
    return None


def _get_length(element) -> float | None:
    """Extract length property from element."""
    try:
        for pset in getattr(element, "IsDefinedBy", []):
            if pset.is_a("IfcRelDefinesByProperties"):
                rel_prop = pset.RelatingPropertyDefinition
                if rel_prop.is_a("IfcPropertySet"):
                    for prop in rel_prop.HasProperties:
                        if prop.Name.lower() in ["length", "l"]:
                            if hasattr(prop, "NominalValue"):
                                val = prop.NominalValue
                                if hasattr(val, "wrappedValue"):
                                    return float(val.wrappedValue)
    except Exception:
        pass
    
    return None


def _get_material(element) -> str | None:
    """Extract material from element."""
    try:
        # Try to get from material association
        if hasattr(element, "HasAssociations"):
            for assoc in element.HasAssociations:
                if assoc.is_a("IfcRelAssociatesMaterial"):
                    mat = assoc.RelatingMaterial
                    if hasattr(mat, "Name"):
                        return mat.Name
    except Exception:
        pass
    
    return None


def _matrix_to_quaternion(axis_x: np.ndarray, axis_y: np.ndarray, axis_z: np.ndarray) -> Tuple[float, float, float, float]:
    """Convert 3x3 rotation matrix (axes) to quaternion [x, y, z, w]."""
    # Build rotation matrix
    m = np.column_stack([axis_x, axis_y, axis_z])
    
    # Standard matrix to quaternion conversion
    trace = m[0, 0] + m[1, 1] + m[2, 2]
    
    if trace > 0:
        s = 0.5 / np.sqrt(trace + 1.0)
        w = 0.25 / s
        x = (m[2, 1] - m[1, 2]) * s
        y = (m[0, 2] - m[2, 0]) * s
        z = (m[1, 0] - m[0, 1]) * s
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = 2.0 * np.sqrt(1.0 + m[0, 0] - m[1, 1] - m[2, 2])
        w = (m[2, 1] - m[1, 2]) / s
        x = 0.25 * s
        y = (m[0, 1] + m[1, 0]) / s
        z = (m[0, 2] + m[2, 0]) / s
    elif m[1, 1] > m[2, 2]:
        s = 2.0 * np.sqrt(1.0 + m[1, 1] - m[0, 0] - m[2, 2])
        w = (m[0, 2] - m[2, 0]) / s
        x = (m[0, 1] + m[1, 0]) / s
        y = 0.25 * s
        z = (m[1, 2] + m[2, 1]) / s
    else:
        s = 2.0 * np.sqrt(1.0 + m[2, 2] - m[0, 0] - m[1, 1])
        w = (m[1, 0] - m[0, 1]) / s
        x = (m[0, 2] + m[2, 0]) / s
        y = (m[1, 2] + m[2, 1]) / s
        z = 0.25 * s
    
    return (x, y, z, w)
