"""
IFC to GLB converter utility.

Uses IfcOpenShell to parse IFC files and Trimesh to export geometry as GLB.
Extracts all physical building elements with native colors and full metadata.
"""

import json
import ifcopenshell
import ifcopenshell.geom
import trimesh
import trimesh.visual.material as trimesh_mat
import numpy as np


# Non-physical or abstract types to skip
SKIP_TYPES = {
    "IfcProject",
    "IfcSite",
    "IfcBuilding",
    "IfcBuildingStorey",
    "IfcSpace",
    "IfcOpeningElement",
    "IfcAnnotation",
    "IfcGrid",
    "IfcVirtualElement",
    "IfcDistributionPort",
    "IfcRelSpaceBoundary",
}


def _safe_value(val):
    """Convert an IFC wrapped value to a JSON-safe Python primitive."""
    if val is None:
        return None
    if hasattr(val, "wrappedValue"):
        v = val.wrappedValue
        # numpy / C-level floats → Python float
        if isinstance(v, (float, int, bool, str)):
            return v
        return str(v)
    if isinstance(v, (float, int, bool, str)):
        return val
    return str(val)


def _get_spatial_containment(element) -> dict:
    """Walk spatial relationships up to Building / Site."""
    result = {}
    for rel in getattr(element, "ContainedInStructure", []):
        spatial = rel.RelatingStructure
        result["Container"] = spatial.Name or spatial.is_a()
        result["ContainerType"] = spatial.is_a()
        # Walk parent aggregation chain
        parent = spatial
        while parent:
            found_parent = False
            for decomp in getattr(parent, "Decomposes", []):
                if decomp.is_a("IfcRelAggregates"):
                    parent = decomp.RelatingObject
                    result[parent.is_a()] = parent.Name or ""
                    found_parent = True
                    break
            if not found_parent:
                break
    return result


def _get_classifications(element) -> list:
    """Get classification references (Uniclass, Omniclass, etc.)."""
    classifications = []
    for assoc in getattr(element, "HasAssociations", []):
        if assoc.is_a("IfcRelAssociatesClassification"):
            ref = assoc.RelatingClassification
            entry = {}
            if hasattr(ref, "Name") and ref.Name:
                entry["Name"] = ref.Name
            if hasattr(ref, "ItemReference"):
                entry["ItemReference"] = str(ref.ItemReference) if ref.ItemReference else None
            elif hasattr(ref, "Identification"):
                entry["Identification"] = str(ref.Identification) if ref.Identification else None
            if hasattr(ref, "ReferencedSource") and ref.ReferencedSource:
                src = ref.ReferencedSource
                if hasattr(src, "Name"):
                    entry["Source"] = src.Name
            if entry:
                classifications.append(entry)
    return classifications


def _extract_property_value(prop) -> tuple:
    """Extract name and value from various IFC property types."""
    name = prop.Name
    if prop.is_a("IfcPropertySingleValue"):
        return name, _safe_value(prop.NominalValue)
    elif prop.is_a("IfcPropertyEnumeratedValue"):
        vals = [_safe_value(v) for v in (prop.EnumerationValues or [])]
        return name, vals if len(vals) != 1 else vals[0]
    elif prop.is_a("IfcPropertyListValue"):
        vals = [_safe_value(v) for v in (prop.ListValues or [])]
        return name, vals
    elif prop.is_a("IfcPropertyBoundedValue"):
        return name, {
            "Upper": _safe_value(prop.UpperBoundValue),
            "Lower": _safe_value(prop.LowerBoundValue),
        }
    elif prop.is_a("IfcComplexProperty"):
        sub = {}
        for sp in prop.HasProperties:
            k, v = _extract_property_value(sp)
            sub[k] = v
        return name, sub
    elif prop.is_a("IfcPropertyTableValue"):
        return name, "(table data)"
    return name, str(prop)


def get_all_properties(element) -> dict:
    """
    Exhaustively extract all available IFC metadata for an element:
      - Core identity (GlobalId, Name, Type, Description, ObjectType, Tag)
      - Property Sets (all property types)
      - Quantity Sets (all quantity types)
      - Materials
      - Type properties
      - Spatial containment
      - Classification references
    """
    metadata: dict = {
        "GlobalId": element.GlobalId,
        "Name": element.Name or "",
        "Type": element.is_a(),
    }

    # Optional core attributes
    if getattr(element, "Description", None):
        metadata["Description"] = str(element.Description)
    if getattr(element, "ObjectType", None):
        metadata["ObjectType"] = str(element.ObjectType)
    if getattr(element, "Tag", None):
        metadata["Tag"] = str(element.Tag)
    if getattr(element, "PredefinedType", None):
        metadata["PredefinedType"] = str(element.PredefinedType)

    # --- Property Sets & Quantity Sets ---
    metadata["Properties"] = {}
    metadata["Quantities"] = {}

    for definition in getattr(element, "IsDefinedBy", []):
        if definition.is_a("IfcRelDefinesByProperties"):
            prop_set = definition.RelatingPropertyDefinition

            if prop_set.is_a("IfcPropertySet"):
                pset_name = prop_set.Name or "Unnamed"
                pset_data = {}
                for prop in prop_set.HasProperties:
                    k, v = _extract_property_value(prop)
                    pset_data[k] = v
                metadata["Properties"][pset_name] = pset_data

            elif prop_set.is_a("IfcElementQuantity"):
                qset_name = prop_set.Name or "Unnamed"
                qset_data = {}
                for q in prop_set.Quantities:
                    if q.is_a("IfcQuantityLength"):
                        qset_data[q.Name] = q.LengthValue
                    elif q.is_a("IfcQuantityArea"):
                        qset_data[q.Name] = q.AreaValue
                    elif q.is_a("IfcQuantityVolume"):
                        qset_data[q.Name] = q.VolumeValue
                    elif q.is_a("IfcQuantityWeight"):
                        qset_data[q.Name] = q.WeightValue
                    elif q.is_a("IfcQuantityCount"):
                        qset_data[q.Name] = q.CountValue
                    elif q.is_a("IfcQuantityTime"):
                        qset_data[q.Name] = q.TimeValue
                    elif q.is_a("IfcPhysicalComplexQuantity"):
                        sub = {}
                        for sq in q.HasQuantities:
                            sub[sq.Name] = getattr(sq, "LengthValue",
                                          getattr(sq, "AreaValue",
                                          getattr(sq, "VolumeValue",
                                          getattr(sq, "WeightValue", str(sq)))))
                        qset_data[q.Name] = sub
                metadata["Quantities"][qset_name] = qset_data

    # --- Materials ---
    materials_list = []
    for assoc in getattr(element, "HasAssociations", []):
        if assoc.is_a("IfcRelAssociatesMaterial"):
            mat = assoc.RelatingMaterial
            if mat.is_a("IfcMaterial"):
                materials_list.append(mat.Name)
            elif mat.is_a("IfcMaterialList"):
                for m in mat.Materials:
                    materials_list.append(m.Name)
            elif mat.is_a("IfcMaterialLayerSetUsage"):
                for layer in mat.ForLayerSet.MaterialLayers:
                    entry = {}
                    if layer.Material:
                        entry["Material"] = layer.Material.Name
                    if layer.LayerThickness:
                        entry["Thickness"] = layer.LayerThickness
                    materials_list.append(entry if len(entry) > 1 else entry.get("Material", "Unknown"))
            elif mat.is_a("IfcMaterialLayerSet"):
                for layer in mat.MaterialLayers:
                    entry = {}
                    if layer.Material:
                        entry["Material"] = layer.Material.Name
                    if layer.LayerThickness:
                        entry["Thickness"] = layer.LayerThickness
                    materials_list.append(entry if len(entry) > 1 else entry.get("Material", "Unknown"))
            elif mat.is_a("IfcMaterialConstituentSet"):
                for constituent in getattr(mat, "MaterialConstituents", []):
                    entry = {}
                    if constituent.Material:
                        entry["Material"] = constituent.Material.Name
                    if constituent.Name:
                        entry["Name"] = constituent.Name
                    materials_list.append(entry if len(entry) > 1 else entry.get("Material", "Unknown"))
            elif mat.is_a("IfcMaterialProfileSetUsage"):
                ps = mat.ForProfileSet
                for profile in getattr(ps, "MaterialProfiles", []):
                    entry = {}
                    if profile.Material:
                        entry["Material"] = profile.Material.Name
                    if profile.Profile and profile.Profile.ProfileName:
                        entry["Profile"] = profile.Profile.ProfileName
                    materials_list.append(entry if len(entry) > 1 else entry.get("Material", "Unknown"))

    if materials_list:
        metadata["Materials"] = materials_list

    # --- Type Properties ---
    for rel in getattr(element, "IsTypedBy", []):
        if rel.is_a("IfcRelDefinesByType"):
            element_type = rel.RelatingType
            metadata["DeclaredType"] = element_type.Name or element_type.is_a()

            for definition in getattr(element_type, "HasPropertySets", []):
                if definition.is_a("IfcPropertySet"):
                    pset_name = f"Type: {definition.Name}"
                    pset_data = {}
                    for prop in definition.HasProperties:
                        k, v = _extract_property_value(prop)
                        pset_data[k] = v
                    metadata["Properties"][pset_name] = pset_data

    # --- Spatial Containment ---
    spatial = _get_spatial_containment(element)
    if spatial:
        metadata["SpatialContainment"] = spatial

    # --- Classification References ---
    classifications = _get_classifications(element)
    if classifications:
        metadata["Classifications"] = classifications

    # Filter out empty dicts/lists for cleaner JSON
    metadata = {k: v for k, v in metadata.items() if v is not None and v != {} and v != [] and v != ""}

    return metadata


def _extract_rgba(diffuse) -> list:
    """
    Robustly extract [R, G, B, A] as 0-255 ints from whatever
    IfcOpenShell gives us for a material's diffuse colour.

    Handles:
      - subscriptable list/tuple  (diffuse[0])
      - object with float attrs   (diffuse.r)
      - object with method attrs  (diffuse.r())
      - None / missing values
    """
    default = [180, 180, 180, 255]
    if diffuse is None:
        return default

    r = g = b = 0.7
    a = 1.0

    # Try list-like access first
    try:
        r, g, b = float(diffuse[0]), float(diffuse[1]), float(diffuse[2])
        try:
            a = float(diffuse[3])
        except (IndexError, TypeError, KeyError):
            a = 1.0
    except (TypeError, IndexError, KeyError):
        # Not subscriptable — try attribute access
        for attr in ("r", "red", "R"):
            val = getattr(diffuse, attr, None)
            if val is not None:
                r = float(val()) if callable(val) else float(val)
                break
        for attr in ("g", "green", "G"):
            val = getattr(diffuse, attr, None)
            if val is not None:
                g = float(val()) if callable(val) else float(val)
                break
        for attr in ("b", "blue", "B"):
            val = getattr(diffuse, attr, None)
            if val is not None:
                b = float(val()) if callable(val) else float(val)
                break
        for attr in ("a", "alpha", "A", "transparency"):
            val = getattr(diffuse, attr, None)
            if val is not None:
                a = float(val()) if callable(val) else float(val)
                break

    # Clamp very transparent to opaque
    if a < 0.1:
        a = 1.0

    return [
        max(0, min(255, int(r * 255))),
        max(0, min(255, int(g * 255))),
        max(0, min(255, int(b * 255))),
        max(0, min(255, int(a * 255))),
    ]


def convert_ifc_to_glb(input_path: str, output_path: str) -> None:
    """
    Load an IFC file, extract geometry for all physical building elements
    with native colors and full metadata, and export as a GLB file.

    Args:
        input_path: Path to the source .ifc file.
        output_path: Path where the resulting .glb file will be saved.
    """
    ifc_file = ifcopenshell.open(input_path)

    settings = ifcopenshell.geom.settings()
    settings.set(settings.USE_WORLD_COORDS, True)

    scene = trimesh.Scene()

    # Get all products (physical elements)
    products = ifc_file.by_type("IfcProduct")
    element_count = 0

    for element in products:
        # Skip abstract or non-physical items
        if element.is_a() in SKIP_TYPES:
            continue
        if not element.Representation:
            continue

        try:
            shape = ifcopenshell.geom.create_shape(settings, element)
            verts = np.array(shape.geometry.verts, dtype=np.float64).reshape(-1, 3)
            faces = np.array(shape.geometry.faces, dtype=np.int32).reshape(-1, 3)

            if len(verts) == 0 or len(faces) == 0:
                continue

            mesh = trimesh.Trimesh(vertices=verts, faces=faces)
            if mesh.is_empty:
                continue

            # --- Per-face color extraction ---
            materials = shape.geometry.materials if hasattr(shape.geometry, "materials") else []
            material_ids = shape.geometry.material_ids if hasattr(shape.geometry, "material_ids") else []

            if materials and material_ids and len(material_ids) == len(faces):
                # Build per-face RGBA colors from the material assignments
                face_colors = np.full((len(faces), 4), 180, dtype=np.uint8)
                for i, mat_idx in enumerate(material_ids):
                    if 0 <= mat_idx < len(materials):
                        mat = materials[mat_idx]
                        if hasattr(mat, "diffuse") and mat.diffuse:
                            face_colors[i] = _extract_rgba(mat.diffuse)
                # Average face colors → single PBR base color for GLTF material
                avg = face_colors.mean(axis=0)
                color_f = avg / 255.0
            elif materials:
                mat = materials[0]
                if hasattr(mat, "diffuse") and mat.diffuse:
                    rgba = _extract_rgba(mat.diffuse)
                else:
                    rgba = [180, 180, 180, 255]
                color_f = np.array(rgba) / 255.0
            else:
                color_f = np.array([0.706, 0.706, 0.706, 1.0])

            mesh.visual = trimesh.visual.TextureVisuals(
                material=trimesh_mat.PBRMaterial(
                    baseColorFactor=color_f.tolist(),
                    metallicFactor=0.0,
                    roughnessFactor=0.7,
                )
            )

            # --- Metadata ---
            all_meta = get_all_properties(element)

            # Store the full metadata as a JSON string so it survives
            # the Trimesh → GLTF extras pipeline without losing nested dicts.
            mesh.metadata["GlobalId"] = all_meta.get("GlobalId", "")
            mesh.metadata["Name"] = all_meta.get("Name", "")
            mesh.metadata["Type"] = all_meta.get("Type", "")
            mesh.metadata["_ifc_metadata"] = json.dumps(all_meta, default=str)

            # Add to scene with a unique name
            geom_name = f"{all_meta.get('Type', 'elem')}_{all_meta.get('GlobalId', str(element_count))}"
            scene.add_geometry(mesh, geom_name=geom_name)
            element_count += 1

        except Exception as e:
            # Skip elements whose geometry cannot be processed
            print(f"Skipping element {element.GlobalId}: {e}")
            continue

    if element_count == 0:
        raise ValueError(
            "No geometry could be extracted from the IFC file. "
            "Ensure the file contains valid 3D representations."
        )

    scene.export(output_path, file_type="glb")
