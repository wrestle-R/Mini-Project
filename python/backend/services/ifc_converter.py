"""
IFC to GLB converter with color preservation and metadata extraction.

Uses IfcOpenShell to parse IFC files, extracts ALL geometry with original
colors/materials, and exports as GLB with a sidecar metadata JSON file
for element inspection.
"""

import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.util.element
import trimesh
import numpy as np
import json


def _serialize_value(val):
    """Convert IFC property values to JSON-serializable types."""
    if val is None:
        return None
    if isinstance(val, (str, int, float, bool)):
        return val
    if isinstance(val, (list, tuple)):
        return [_serialize_value(v) for v in val]
    return str(val)


def _extract_element_metadata(ifc_file, element):
    """Extract all available metadata and properties for an IFC element."""
    meta = {
        "globalId": element.GlobalId,
        "type": element.is_a(),
        "name": getattr(element, "Name", None) or "",
        "description": getattr(element, "Description", None) or "",
    }

    # Extract property sets and quantity sets
    try:
        psets = ifcopenshell.util.element.get_psets(element)
        props = {}
        for pset_name, pset_props in psets.items():
            serialized = {}
            for k, v in pset_props.items():
                if k == "id":
                    continue
                serialized[k] = _serialize_value(v)
            if serialized:
                props[pset_name] = serialized
        meta["properties"] = props
    except Exception:
        meta["properties"] = {}

    # Extract type information
    try:
        element_type = ifcopenshell.util.element.get_type(element)
        if element_type:
            meta["objectType"] = getattr(element_type, "Name", None) or ""
    except Exception:
        pass

    return meta


def _get_face_colors(shape):
    """
    Extract per-face RGBA colors from shape materials.
    Returns an Nx4 uint8 numpy array, or None if no materials are available.
    """
    try:
        materials = shape.geometry.materials
        material_ids = shape.geometry.material_ids
        num_faces = len(shape.geometry.faces) // 3

        if not materials or len(materials) == 0:
            return None

        face_colors = np.full((num_faces, 4), [200, 200, 200, 255], dtype=np.uint8)

        for face_idx in range(num_faces):
            if face_idx >= len(material_ids):
                continue
            mat_id = material_ids[face_idx]
            if mat_id < 0 or mat_id >= len(materials):
                continue
            mat = materials[mat_id]
            try:
                diffuse = mat.diffuse
                if diffuse and len(diffuse) >= 3:
                    r = max(0, min(255, int(diffuse[0] * 255)))
                    g = max(0, min(255, int(diffuse[1] * 255)))
                    b = max(0, min(255, int(diffuse[2] * 255)))
                    a = 255
                    try:
                        if mat.transparency and mat.transparency > 0:
                            a = max(0, min(255, int((1.0 - mat.transparency) * 255)))
                    except (AttributeError, TypeError):
                        pass
                    face_colors[face_idx] = [r, g, b, a]
            except (AttributeError, TypeError, IndexError):
                continue

        return face_colors
    except Exception:
        return None


def convert_ifc_to_glb(input_path: str, output_path: str) -> str:
    """
    Load an IFC file, extract ALL geometry with original colors,
    and export as GLB. Also saves a metadata JSON alongside the GLB.

    Args:
        input_path: Path to the source .ifc file.
        output_path: Path where the resulting .glb file will be saved.

    Returns:
        Path to the generated metadata JSON file.
    """
    ifc_file = ifcopenshell.open(input_path)

    settings = ifcopenshell.geom.settings()
    settings.set(settings.USE_WORLD_COORDS, True)

    scene = trimesh.Scene()
    metadata = {}

    # Use the geometry iterator to process ALL elements with geometry
    iterator = ifcopenshell.geom.iterator(settings, ifc_file)
    if not iterator.initialize():
        raise ValueError(
            "No geometry could be extracted from the IFC file. "
            "The file may be empty or contain no geometric representations."
        )

    while True:
        shape = iterator.get()
        guid = shape.guid

        try:
            verts_flat = shape.geometry.verts
            faces_flat = shape.geometry.faces

            if len(verts_flat) == 0 or len(faces_flat) == 0:
                if not iterator.next():
                    break
                continue

            verts = np.array(verts_flat, dtype=np.float64).reshape(-1, 3)
            faces = np.array(faces_flat, dtype=np.int32).reshape(-1, 3)

            mesh = trimesh.Trimesh(vertices=verts, faces=faces)
            if mesh.is_empty:
                if not iterator.next():
                    break
                continue

            # Apply per-face colors from IFC material definitions
            face_colors = _get_face_colors(shape)
            if face_colors is not None:
                mesh.visual.face_colors = face_colors

            scene.add_geometry(mesh, node_name=guid, geom_name=guid)

        except Exception:
            if not iterator.next():
                break
            continue

        # Extract element metadata for the inspection panel
        try:
            element = ifc_file.by_guid(guid)
            metadata[guid] = _extract_element_metadata(ifc_file, element)
        except Exception:
            pass

        if not iterator.next():
            break

    if len(scene.geometry) == 0:
        raise ValueError(
            "No geometry could be extracted from the IFC file. "
            "The file may contain unsupported element types."
        )

    scene.export(output_path, file_type="glb")

    # Save metadata JSON alongside the GLB
    metadata_path = output_path.rsplit(".", 1)[0] + "_metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False)

    return metadata_path
