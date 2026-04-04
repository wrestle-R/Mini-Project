"""
Geometry Generator: Convert internal JSON model to GLB (GLTF Binary format).
GLB is regenerable from JSON and never the source of truth.

Reads JSON model and generates Three.js-compatible GLB file using trimesh.
"""

import trimesh
import numpy as np
import json
from typing import Dict, Any, List, Tuple, cast
from pathlib import Path


def generate_glb_from_model(json_path: str, glb_path: str) -> str:
    """
    Generate GLB file from internal JSON model.
    
    Args:
        json_path: Path to JSON model file
        glb_path: Output path for GLB file
        
    Returns:
        Path to generated GLB file
    """
    # Load JSON model
    with open(json_path, 'r') as f:
        model = json.load(f)
    
    # Create trimesh scene
    scene = trimesh.Scene()
    total_elements = len(model.get("elements", []))
    added_meshes = 0
    
    # Process each element
    for element in model.get("elements", []):
        geometry = element.get("geometry", {})
        mesh = _create_mesh_for_element(element)
        if mesh:
            # IFC triangulated meshes are already exported in world coordinates.
            # Parametric meshes are created in local space and need transforms.
            if geometry.get("type") != "mesh":
                transform = element.get("transform", {})
                mesh = _apply_transform(mesh, transform)
            
            # Apply color if available
            if "color" in element:
                color = element["color"]
                vertex_colors = np.tile(
                    np.array(color + [255], dtype=np.uint8),
                    (len(mesh.vertices), 1)
                )
                cast(Any, mesh.visual).vertex_colors = vertex_colors
            
            # Set metadata
            mesh.metadata = {
                "element_id": element.get("id"),
                "element_type": element.get("type"),
                "element_name": element.get("name", "Unknown")
            }
            
            scene.add_geometry(mesh)
            added_meshes += 1

    if added_meshes == 0:
        raise ValueError(
            "GLB generation failed: no renderable meshes were produced from model JSON. "
            f"elements_in_model={total_elements}, meshes_added={added_meshes}."
        )
    
    # Export to GLB
    scene.export(glb_path, file_type="glb")
    
    return glb_path


def _create_mesh_for_element(element: Dict[str, Any]) -> trimesh.Trimesh | None:
    """Create trimesh from element geometry."""
    geometry = element.get("geometry")
    if not geometry:
        return None
    
    geom_type = geometry.get("type")
    
    if geom_type == "parametric":
        return _create_parametric_mesh(geometry)
    elif geom_type == "mesh":
        return _create_mesh_from_vertices(geometry)
    
    return None


def _create_parametric_mesh(geometry: Dict[str, Any]) -> trimesh.Trimesh | None:
    """Create mesh from parametric geometry (dimensions)."""
    shape = geometry.get("shape")
    
    if shape == "wall":
        return _create_wall_mesh(geometry)
    elif shape == "column":
        return _create_column_mesh(geometry)
    elif shape == "slab":
        return _create_slab_mesh(geometry)
    elif shape == "beam":
        return _create_beam_mesh(geometry)
    
    return None


def _create_wall_mesh(geom: Dict[str, Any]) -> trimesh.Trimesh:
    """Create wall mesh from parametric dimensions."""
    height = float(geom.get("height", 3.0))
    thickness = float(geom.get("thickness", 0.2))
    start = np.array(geom.get("start", [0.0, 0.0, 0.0]), dtype=np.float64)
    end = np.array(geom.get("end", [1.0, 0.0, 0.0]), dtype=np.float64)
    
    # Direction along wall
    direction = end - start
    direction = direction / (np.linalg.norm(direction) + 1e-10)
    
    # Perpendicular direction (thickness)
    perp = np.array([-direction[1], direction[0], 0.0], dtype=np.float64)
    perp = perp / (np.linalg.norm(perp) + 1e-10)
    perp *= thickness / 2
    
    # Create 4 corner points (bottom)
    p0 = start - perp
    p1 = start + perp
    p2 = end + perp
    p3 = end - perp
    
    # Create 4 corner points (top)
    p4 = p0 + np.array([0.0, height, 0.0])
    p5 = p1 + np.array([0.0, height, 0.0])
    p6 = p2 + np.array([0.0, height, 0.0])
    p7 = p3 + np.array([0.0, height, 0.0])
    
    vertices = np.array([p0, p1, p2, p3, p4, p5, p6, p7])
    
    faces = np.array([
        # Bottom
        [0, 2, 1], [0, 3, 2],
        # Top
        [4, 5, 6], [4, 6, 7],
        # Front
        [1, 2, 5], [2, 6, 5],
        # Back
        [3, 0, 7], [0, 4, 7],
        # Left
        [0, 1, 4], [1, 5, 4],
        # Right
        [2, 3, 6], [3, 7, 6],
    ])
    
    return trimesh.Trimesh(vertices=vertices, faces=faces)


def _create_column_mesh(geom: Dict[str, Any]) -> trimesh.Trimesh:
    """Create column mesh (box shape)."""
    width = geom.get("width", 0.3)
    depth = geom.get("depth", 0.3)
    height = geom.get("height", 3.0)
    
    # Create box centered at origin
    mesh = trimesh.creation.box(
        extents=[width, height, depth]
    )
    
    # Move up so bottom is at y=0
    mesh.apply_translation([0, height / 2, 0])
    
    return mesh


def _create_slab_mesh(geom: Dict[str, Any]) -> trimesh.Trimesh:
    """Create slab mesh (flat box)."""
    length = geom.get("length", 1.0)
    width = geom.get("width", 1.0)
    thickness = geom.get("thickness", 0.15)
    
    mesh = trimesh.creation.box(
        extents=[length, thickness, width]
    )
    
    # Move up so bottom is at y=0
    mesh.apply_translation([0, thickness / 2, 0])
    
    return mesh


def _create_beam_mesh(geom: Dict[str, Any]) -> trimesh.Trimesh:
    """Create beam mesh (elongated box)."""
    width = geom.get("width", 0.2)
    height = geom.get("height", 0.4)
    length = geom.get("length", 1.0)
    
    mesh = trimesh.creation.box(
        extents=[length, height, width]
    )
    
    return mesh


def _create_mesh_from_vertices(geometry: Dict[str, Any]) -> trimesh.Trimesh | None:
    """Create mesh from vertex and face data."""
    vertices = geometry.get("vertices", [])
    faces = geometry.get("faces", [])
    
    if not vertices or not faces:
        return None
    
    try:
        vertices_array = np.array(vertices, dtype=np.float64)
        faces_array = np.array(faces, dtype=np.uint32)
        
        return trimesh.Trimesh(
            vertices=vertices_array,
            faces=faces_array,
            process=True
        )
    except Exception as e:
        print(f"Error creating mesh from vertices: {e}")
        return None


def _apply_transform(mesh: trimesh.Trimesh, transform: Dict[str, Any]) -> trimesh.Trimesh:
    """Apply transformation (translation, rotation, scale) to mesh."""
    
    # Get components
    translation = transform.get("translation", [0, 0, 0])
    rotation = transform.get("rotation", [0, 0, 0, 1])  # [x, y, z, w]
    scale = transform.get("scale", [1, 1, 1])
    
    # Apply scale
    scale_array = np.array(scale)
    if not np.allclose(scale_array, 1.0):
        mesh.apply_scale(scale_array)
    
    # Apply rotation (quaternion to matrix)
    quat = np.array(rotation)  # [x, y, z, w]
    rot_matrix = _quaternion_to_matrix(quat)
    mesh.apply_transform(rot_matrix)
    
    # Apply translation
    translation_array = np.array(translation)
    if not np.allclose(translation_array, 0):
        mesh.apply_translation(translation_array)
    
    return mesh


def _quaternion_to_matrix(quat: np.ndarray) -> np.ndarray:
    """Convert quaternion [x, y, z, w] to 4x4 transformation matrix."""
    x, y, z, w = quat
    
    # Quaternion to rotation matrix
    rot_matrix = np.array([
        [1 - 2*(y*y + z*z), 2*(x*y - w*z), 2*(x*z + w*y)],
        [2*(x*y + w*z), 1 - 2*(x*x + z*z), 2*(y*z - w*x)],
        [2*(x*z - w*y), 2*(y*z + w*x), 1 - 2*(x*x + y*y)]
    ])
    
    # Create 4x4 matrix
    matrix = np.eye(4)
    matrix[:3, :3] = rot_matrix
    
    return matrix


def regenerate_glb(project_id: str, data_dir: str = "data") -> str:
    """
    Regenerate GLB file from JSON model.
    Used after model edits to update the 3D representation.
    
    Args:
        project_id: Project identifier
        data_dir: Data directory path
        
    Returns:
        Path to regenerated GLB file
    """
    json_path = f"{data_dir}/models/{project_id}.json"
    glb_path = f"{data_dir}/glb/{project_id}.glb"
    
    return generate_glb_from_model(json_path, glb_path)
