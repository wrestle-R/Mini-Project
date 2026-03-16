"""
IFC to GLB converter utility.

Uses IfcOpenShell to parse IFC files and Trimesh to export geometry as GLB.
Only extracts relevant building elements to keep the model lightweight.
"""

import ifcopenshell
import ifcopenshell.geom
import trimesh
import numpy as np


# Only extract these building element types
RELEVANT_IFC_TYPES = [
    "IfcWall",
    "IfcDoor",
    "IfcWindow",
    "IfcColumn",
    "IfcSlab",
]


def convert_ifc_to_glb(input_path: str, output_path: str) -> None:
    """
    Load an IFC file, extract geometry for relevant building elements,
    and export the combined result as a GLB file.

    Args:
        input_path: Path to the source .ifc file.
        output_path: Path where the resulting .glb file will be saved.
    """
    ifc_file = ifcopenshell.open(input_path)

    settings = ifcopenshell.geom.settings()
    settings.set(settings.USE_WORLD_COORDS, True)

    meshes: list[trimesh.Trimesh] = []

    for ifc_type in RELEVANT_IFC_TYPES:
        elements = ifc_file.by_type(ifc_type)
        for element in elements:
            try:
                shape = ifcopenshell.geom.create_shape(settings, element)
                # Geometry data comes as a flat list; reshape into Nx3 vertices
                verts = np.array(shape.geometry.verts, dtype=np.float64).reshape(-1, 3)
                faces = np.array(shape.geometry.faces, dtype=np.int32).reshape(-1, 3)

                mesh = trimesh.Trimesh(vertices=verts, faces=faces)
                if mesh.is_empty:
                    continue
                meshes.append(mesh)
            except Exception:
                # Skip elements whose geometry cannot be processed
                continue

    if not meshes:
        raise ValueError(
            "No geometry could be extracted from the IFC file. "
            "Ensure the file contains supported element types "
            "(IfcWall, IfcDoor, IfcWindow, IfcColumn, IfcSlab)."
        )

    scene = trimesh.Scene(meshes)
    scene.export(output_path, file_type="glb")
