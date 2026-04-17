"""
Model Editor: Execute actions on internal JSON model.
Tools modify the JSON source of truth, then GLB is regenerated.

Actions:
- add_element: Add new element to model
- remove_element: Remove element by ID or type
- update_property: Modify element property
- transform_element: Update translation/rotation/scale
- duplicate_element: Clone element with new ID
- add_colour: Set element color
"""

import json
import uuid
from typing import Dict, Any, List
from typing import Dict, Any, List, Tuple
from copy import deepcopy


class ModelEditorError(Exception):
    """Raised when model edit operation fails."""
    pass


def execute_action(model: Dict[str, Any], action: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """
    Execute action on model.
    Modifies model in-place and returns it.
    
    Args:
        model: Internal model dict
        action: Validated action dict from LLM
        
    Returns:
        Tuple of (Modified model dict, String message)
        
    Raises:
        ModelEditorError: If action cannot be executed
    """
    action_type = action.get("action")
    
    try:
        if action_type == "add_element":
            return add_element(model, action)
        elif action_type == "remove_element":
            return remove_element(model, action)
        elif action_type == "update_property":
            return update_property(model, action)
        elif action_type == "transform_element":
            return transform_element(model, action)
        elif action_type == "duplicate_element":
            return duplicate_element(model, action)
        elif action_type == "add_colour":
            return add_colour(model, action)
        else:
            raise ModelEditorError(f"Unknown action: {action_type}")
    except ModelEditorError:
        raise
    except Exception as e:
        raise ModelEditorError(f"Error executing action: {str(e)}")

def add_element(model: Dict[str, Any], action: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """
    Add new element to model.
    
    Expected action fields:
    - element_type: type of element (wall, column, etc.)
    - properties: dict of properties
    - count: number of copies (optional)
    """
    element_type = action.get("element_type")
    if not element_type:
        raise ModelEditorError("add_element requires 'element_type'")
    
    count = action.get("count", 1)
    properties = action.get("properties", {})
    
    for _ in range(count):
        element_id = f"{element_type}_{uuid.uuid4().hex[:8]}"
        
        new_element = {
            "id": element_id,
            "type": element_type,
            "name": f"{element_type.capitalize()}_{element_id[:8]}",
            "geometry": {
                "type": "parametric",
                "shape": element_type,
                "height": properties.get("height", 3.0),
                "width": properties.get("width", 1.0),
                "depth": properties.get("depth", 1.0),
                "thickness": properties.get("thickness", 0.1),
            },
            "properties": {
                "base": {
                    "height": properties.get("height", 3.0),
                    "material": properties.get("material", "concrete"),
                    **(properties if isinstance(properties, dict) else {})
                }
            },
            "transform": {
                "translation": properties.get("translation", [0, 0, 0]),
                "rotation": properties.get("rotation", [0, 0, 0, 1]),
                "scale": properties.get("scale", [1, 1, 1])
            }
        }
        
        if "color" in properties:
            new_element["color"] = properties["color"]
        
        new_element["_edited"] = True
        model["elements"].append(new_element)
    
    msg = f"Added {count} new {element_type} element(s)."
    return model, msg

def remove_element(model: Dict[str, Any], action: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """
    Remove element(s) from model.
    
    Expected action fields (one of):
    - element_id: remove single element
    - target: remove all elements of this type
    """
    element_id = action.get("element_id")
    target = action.get("target")
    
    if element_id:
        # Remove single element
        model["elements"] = [
            e for e in model["elements"] 
            if e["id"] != element_id
        ]
    elif target:
        # Remove all elements of type
        model["elements"] = [
            e for e in model["elements"] 
            if e["type"] != target
        ]
    else:
        raise ModelEditorError("remove_element requires 'element_id' or 'target'")
    
    removed = initial_count - len(model["elements"])
    msg = f"Removed {removed} {target or 'selected'} element(s)."
    return model, msg

def update_property(model: Dict[str, Any], action: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """
    Update property on element(s).
    
    Expected action fields:
    - property: property name (height, width, material, etc.)
    - value: new value
    - element_id or target: which element(s)
    """
    prop_name = action.get("property")
    prop_value = action.get("value")
    element_id = action.get("element_id")
    target = action.get("target")
    
    if not prop_name:
        raise ModelEditorError("update_property requires 'property'")
    
    # Update geometry properties
    elements_to_update = []
    if element_id:
        elements_to_update = [e for e in model["elements"] if e["id"] == element_id]
    elif target:
        elements_to_update = [e for e in model["elements"] if e["type"] == target]
    else:
        raise ModelEditorError("update_property requires 'element_id' or 'target'")
    
    for elem in elements_to_update:
        # Update geometry
        if "geometry" in elem and elem["geometry"].get("type") == "parametric":
            if prop_name in ["height", "width", "depth", "thickness"]:
                actual_value = prop_value
                if prop_name == "height":
                    actual_value = _clip_height_to_bounds(model, elem, prop_value)
                elem["geometry"][prop_name] = actual_value
        
        # Update properties
        if "properties" not in elem:
            elem["properties"] = {"base": {}}
        
        if "base" not in elem["properties"]:
            elem["properties"]["base"] = {}
        
        elem["properties"]["base"][prop_name] = prop_value
        elem["_edited"] = True
    
    msg = f"Updated {prop_name} to {prop_value} for {len(elements_to_update)} element(s)."
    if prop_name == "height" and any(e["geometry"].get("height") != prop_value for e in elements_to_update if "geometry" in e):
        msg += "\n\n⚠️ Some heights were clipped to respect connected roofs/slabs bounds."
        
    return model, msg

def transform_element(model: Dict[str, Any], action: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """
    Transform element(s) (move, rotate, scale).
    
    Expected action fields:
    - element_id or target: which element(s)
    - translation: [x, y, z] (optional)
    - rotation: [x, y, z, w] quaternion (optional)
    - scale: [sx, sy, sz] (optional)
    """
    element_id = action.get("element_id")
    target = action.get("target")
    
    elements_to_update = []
    if element_id:
        elements_to_update = [e for e in model["elements"] if e["id"] == element_id]
    elif target:
        elements_to_update = [e for e in model["elements"] if e["type"] == target]
    else:
        raise ModelEditorError("transform_element requires 'element_id' or 'target'")
    
    for elem in elements_to_update:
        if "transform" not in elem:
            elem["transform"] = {
                "translation": [0, 0, 0],
                "rotation": [0, 0, 0, 1],
                "scale": [1, 1, 1]
            }
        
        if "translation" in action:
            old_translation = elem["transform"].get("translation", [0, 0, 0])
            new_translation = action["translation"]
            delta = [new_translation[i] - old_translation[i] for i in range(3)]
            elem["transform"]["translation"] = new_translation
            _propagate_translation(model, elem["id"], delta)
        
        if "rotation" in action:
            elem["transform"]["rotation"] = action["rotation"]
        
        if "scale" in action:
            elem["transform"]["scale"] = action["scale"]
        
        elem["_edited"] = True
    
    msg = f"Transformed {len(elements_to_update)} element(s)."
    if "translation" in action:
        msg += "\n\n🔗 Dependent hosted elements were moved automatically."
        
    return model, msg

def duplicate_element(model: Dict[str, Any], action: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """
    Duplicate element(s).
    
    Expected action fields:
    - element_id: element to duplicate
    - count: number of copies (default 1)
    - offset: [x, y, z] offset for each copy (optional)
    """
    element_id = action.get("element_id")
    if not element_id:
        raise ModelEditorError("duplicate_element requires 'element_id'")
    
    # Find element to duplicate
    original = None
    for elem in model["elements"]:
        if elem["id"] == element_id:
            original = elem
            break
    
    if not original:
        raise ModelEditorError(f"Element not found: {element_id}")
    
    count = action.get("count", 1)
    offset = action.get("offset", [0, 0, 0])
    
    for i in range(count):
        # Deep copy
        new_elem = deepcopy(original)
        
        # Generate new ID
        new_elem["id"] = f"{original['type']}_{uuid.uuid4().hex[:8]}"
        
        # Apply offset if provided
        if offset and (offset[0] != 0 or offset[1] != 0 or offset[2] != 0):
            old_trans = new_elem["transform"]["translation"]
            new_elem["transform"]["translation"] = [
                old_trans[0] + offset[0] * (i + 1),
                old_trans[1] + offset[1] * (i + 1),
                old_trans[2] + offset[2] * (i + 1),
            ]
        
        new_elem["_edited"] = True
        model["elements"].append(new_elem)
    
    msg = f"Duplicated element {count} time(s)."
    return model, msg

def add_colour(model: Dict[str, Any], action: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """
    Add or update color on element(s).
    
    Expected action fields:
    - color: [r, g, b] or [r, g, b, a]
    - element_id or target: which element(s)
    """
    color = action.get("color")
    if not color:
        raise ModelEditorError("add_colour requires 'color'")
    
    element_id = action.get("element_id")
    target = action.get("target")
    
    elements_to_update = []
    if element_id:
        elements_to_update = [e for e in model["elements"] if e["id"] == element_id]
    elif target:
        elements_to_update = [e for e in model["elements"] if e["type"] == target]
    else:
        raise ModelEditorError("add_colour requires 'element_id' or 'target'")
    
    for elem in elements_to_update:
        # Store RGB (first 3 values)
        elem["color"] = color[:3] if len(color) >= 3 else color
        elem["_edited"] = True
    
    msg = f"Applied custom color to {len(elements_to_update)} element(s)."
    return model, msg

def validate_model(model: Dict[str, Any]) -> None:
    """
    Validate model after edits.
    Checks for issues like duplicate IDs, missing fields, etc.
    
    Raises:
        ModelEditorError: If model is invalid
    """
    if not isinstance(model, dict):
        raise ModelEditorError("Model must be a dictionary")
    
    if "elements" not in model:
        raise ModelEditorError("Model must have 'elements' array")
    
    if not isinstance(model["elements"], list):
        raise ModelEditorError("'elements' must be an array")
    
    # Check for duplicate IDs
    ids = set()
    for elem in model["elements"]:
        elem_id = elem.get("id")
        if not elem_id:
            raise ModelEditorError("Element missing 'id' field")
        
        if elem_id in ids:
            raise ModelEditorError(f"Duplicate element ID: {elem_id}")
        
        ids.add(elem_id)
        
        # Check required fields
        if "type" not in elem:
            raise ModelEditorError(f"Element {elem_id} missing 'type'")
        
        if "geometry" not in elem:
            raise ModelEditorError(f"Element {elem_id} missing 'geometry'")
        
        if "transform" not in elem:
            raise ModelEditorError(f"Element {elem_id} missing 'transform'")

def _propagate_translation(model: Dict[str, Any], host_id: str, delta: List[float]) -> None:
    """Propagate translation delta to elements hosted by or contained in the host_id."""
    relationships = model.get("relationships", {})
    if not relationships:
        return
        
    hosted_ids = relationships.get("contains", {}).get(host_id, [])
    contained_ids = relationships.get("contains_spatial", {}).get(host_id, [])
    
    # Elements to move along with the host
    dependent_ids = set(hosted_ids) | set(contained_ids)
    
    for elem in model.get("elements", []):
        if elem["id"] in dependent_ids:
            trans = elem.get("transform", {}).get("translation", [0, 0, 0])
            elem["transform"]["translation"] = [
                trans[0] + delta[0],
                trans[1] + delta[1],
                trans[2] + delta[2]
            ]
            elem["_edited"] = True
            # Recursively propagate
            _propagate_translation(model, elem["id"], delta)

def _clip_height_to_bounds(model: Dict[str, Any], elem: Dict[str, Any], target_height: float) -> float:
    """Clip target height to not exceed bounds of elements above it, e.g., roofs/slabs."""
    relationships = model.get("relationships", {})
    if not relationships:
        return target_height
        
    bounded_by_ids = relationships.get("bounded_by", {}).get(elem["id"], [])
    if not bounded_by_ids:
        return target_height
        
    # We find bounding elements that are "above" the current element.
    # To keep this resilient without heavy bounding-box intersection, 
    # we just look for roofs or slabs in the bounded list that are above the element's start Z.
    
    element_z = elem.get("transform", {}).get("translation", [0, 0, 0])[2]
    
    max_allowed_height = target_height
    for bound_elem in model.get("elements", []):
        if bound_elem["id"] in bounded_by_ids:
            if bound_elem["type"] in ["roof", "slab"]:
                bound_z = bound_elem.get("transform", {}).get("translation", [0, 0, 0])[2]
                bound_geom = bound_elem.get("geometry", {})
                # If bound is mesh, we would need BB. For parametric, we check its base Z.
                # Just estimating the delta Z.
                if bound_z > element_z:
                    available_height = bound_z - element_z
                    # If this roof/slab acts as a cap, we constrain height
                    if available_height < max_allowed_height and available_height > 0:
                        max_allowed_height = available_height
                        
    return max_allowed_height

