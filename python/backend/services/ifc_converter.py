"""
IFC to GLB converter utility.

Uses IfcOpenShell to parse IFC files and Trimesh to export geometry as GLB.
Extracts all physical building elements with native colors and full metadata.
"""

import json
import struct
import ifcopenshell
import ifcopenshell.geom
import trimesh
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
    if isinstance(val, (float, int, bool, str)):
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


def _postprocess_glb(glb_path: str, element_extras: list) -> None:
    """
    Post-process a Trimesh-exported GLB to inject GLTF materials and metadata.

    Trimesh does not reliably export PBRMaterial colours or mesh.metadata into
    the GLB binary.  This function re-opens the file, modifies only the JSON
    chunk (leaving the binary buffer untouched), and rewrites the GLB.

    Args:
        glb_path:       Path to the GLB file to modify in-place.
        element_extras: List of dicts, one per element in the SAME order they
                        were added to the Trimesh Scene.  Each dict contains:
                          - "color":    [r, g, b, a] as floats in [0.0, 1.0]
                          - "metadata": dict with at minimum GlobalId/Name/Type
    """
    with open(glb_path, "rb") as fh:
        raw = bytearray(fh.read())

    # ── GLB binary layout ─────────────────────────────────────────────────
    # Byte  0-3:  magic "glTF"
    # Byte  4-7:  version (2)
    # Byte  8-11: total file length
    # Byte 12-15: JSON chunk length (J)
    # Byte 16-19: JSON chunk type  (0x4E4F534A = "JSON")
    # Byte 20..20+J-1: JSON chunk data (4-byte padded with spaces)
    # Byte 20+J..:     BIN chunk (optional; preserved verbatim)
    # ──────────────────────────────────────────────────────────────────────
    json_chunk_len = struct.unpack_from("<I", raw, 12)[0]
    gltf = json.loads(raw[20: 20 + json_chunk_len])

    # ── Build one GLTF material per element ───────────────────────────────
    materials = []
    for item in element_extras:
        r, g, b, a = item["color"]
        materials.append({
            "pbrMetallicRoughness": {
                "baseColorFactor": [
                    round(float(r), 4),
                    round(float(g), 4),
                    round(float(b), 4),
                    round(float(a), 4),
                ],
                "metallicFactor": 0.0,
                "roughnessFactor": 0.7,
            },
            "doubleSided": True,
        })
    gltf["materials"] = materials

    # ── Walk geometry nodes in order and assign material + extras ─────────
    # Trimesh always emits: node[0] = "world" (no mesh), then geometry_0,
    # geometry_1, … in the same order as add_geometry() calls.
    elem_idx = 0
    for node in gltf.get("nodes", []):
        mesh_idx = node.get("mesh")
        if mesh_idx is None:
            continue                        # skip the root "world" node
        if elem_idx >= len(element_extras):
            break

        # Assign colour material to every primitive of this mesh
        for prim in gltf["meshes"][mesh_idx]["primitives"]:
            prim["material"] = elem_idx

        # Inject IFC metadata into the GLTF node's extras so Three.js can
        # read them via mesh.userData after GLTFLoader parses the file.
        meta = element_extras[elem_idx]["metadata"]
        node["extras"] = {
            "GlobalId":      meta.get("GlobalId", ""),
            "Name":          meta.get("Name", ""),
            "Type":          meta.get("Type", ""),
            "_ifc_metadata": json.dumps(meta, default=str),
        }
        elem_idx += 1

    # ── Re-serialise JSON and rebuild the GLB ─────────────────────────────
    new_json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    # GLB spec requires the JSON chunk to be padded to a 4-byte boundary
    # using space characters (0x20).
    pad = (-len(new_json_bytes)) % 4
    new_json_bytes += b" " * pad

    # Preserve the BIN chunk (and any further chunks) verbatim
    bin_tail = bytes(raw[20 + json_chunk_len:])

    new_total_len = 12 + 8 + len(new_json_bytes) + len(bin_tail)

    with open(glb_path, "wb") as fh:
        fh.write(struct.pack("<4sII", b"glTF", 2, new_total_len))
        fh.write(struct.pack("<II", len(new_json_bytes), 0x4E4F534A))  # "JSON"
        fh.write(new_json_bytes)
        fh.write(bin_tail)


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
    # Parallel list to scene geometry: one entry per successfully added mesh.
    # Used by _postprocess_glb to inject colours and metadata after export.
    element_extras: list = []

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

            # --- Per-face color extraction → single averaged RGBA ---
            geo_mats = shape.geometry.materials if hasattr(shape.geometry, "materials") else []
            mat_ids = shape.geometry.material_ids if hasattr(shape.geometry, "material_ids") else []

            if geo_mats and mat_ids and len(mat_ids) == len(faces):
                face_colors = np.full((len(faces), 4), 180, dtype=np.uint8)
                for i, mat_idx in enumerate(mat_ids):
                    if 0 <= mat_idx < len(geo_mats):
                        gm = geo_mats[mat_idx]
                        if hasattr(gm, "diffuse") and gm.diffuse:
                            face_colors[i] = _extract_rgba(gm.diffuse)
                color_f = face_colors.mean(axis=0) / 255.0
            elif geo_mats:
                gm = geo_mats[0]
                rgba = _extract_rgba(gm.diffuse) if (hasattr(gm, "diffuse") and gm.diffuse) else [180, 180, 180, 255]
                color_f = np.array(rgba) / 255.0
            else:
                color_f = np.array([0.706, 0.706, 0.706, 1.0])

            # --- Metadata ---
            all_meta = get_all_properties(element)

            # Add geometry to scene (colours and metadata are injected into
            # the GLB via _postprocess_glb after export — Trimesh does not
            # reliably round-trip PBRMaterial or mesh.metadata to GLB).
            geom_name = f"{all_meta.get('Type', 'elem')}_{all_meta.get('GlobalId', str(element_count))}"
            scene.add_geometry(mesh, geom_name=geom_name)

            # Record colour and metadata in the same order as geometry
            element_extras.append({
                "color":    color_f.tolist(),
                "metadata": all_meta,
            })
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

    # Inject colours and IFC metadata that Trimesh cannot export by itself
    _postprocess_glb(output_path, element_extras)
