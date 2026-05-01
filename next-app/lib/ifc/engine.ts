import { nanoid } from "nanoid";
import path from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";
import { Euler, Matrix3, Matrix4, Quaternion, Vector3 } from "three";
import { IfcAPI } from "web-ifc";

const IFC_WASM_PATH = path.join(
  process.cwd(),
  "node_modules",
  "web-ifc",
  "web-ifc-node.wasm"
);

type Rgba = [number, number, number, number];

type AccessorArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array;

interface SelectedContext {
  element_id?: string;
  element_type?: string;
}

type DebugLog = Array<{ expressID: number; typeName: string; reason: string }>;

interface IfcMeshGeometryRecord {
  type: "mesh";
  positions: number[];
  normals: number[];
  indices: number[];
}

interface IfcTransformRecord {
  translation: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
}

export interface IfcElementRecord {
  id: string;
  type: string;
  name: string;
  geometry: IfcMeshGeometryRecord;
  transform: IfcTransformRecord;
  properties: Record<string, Record<string, unknown>>;
}

export interface IfcModelRecord {
  project_id: string;
  created_at: string;
  elements: IfcElementRecord[];
  debugLog?: DebugLog;
}

type IfcApiSingleton = {
  api?: IfcAPI;
  promise?: Promise<IfcAPI>;
};

declare global {
  var ifcApiSingleton: IfcApiSingleton | undefined;
}

const ifcApiSingletonGlobal = global.ifcApiSingleton ?? {};
if (!global.ifcApiSingleton) {
  global.ifcApiSingleton = ifcApiSingletonGlobal;
}

async function getIfcApi() {
  if (ifcApiSingletonGlobal.api) return ifcApiSingletonGlobal.api;
  if (!ifcApiSingletonGlobal.promise) {
    ifcApiSingletonGlobal.promise = (async () => {
      const api = new IfcAPI();
      await api.Init(() => IFC_WASM_PATH, true);
      ifcApiSingletonGlobal.api = api;
      return api;
    })();
  }
  return ifcApiSingletonGlobal.promise;
}

function typeColor(type: string): Rgba {
  const upper = type.toUpperCase();
  if (upper.includes("WALL")) return [0.73, 0.74, 0.77, 1.0];
  if (upper.includes("SLAB")) return [0.56, 0.57, 0.6, 1.0];
  if (upper.includes("DOOR")) return [0.64, 0.42, 0.25, 1.0];
  if (upper.includes("WINDOW")) return [0.45, 0.69, 0.88, 1.0];
  if (upper.includes("COLUMN")) return [0.81, 0.82, 0.84, 1.0];
  if (upper.includes("BEAM")) return [0.76, 0.65, 0.52, 1.0];
  if (upper.includes("ROOF")) return [0.67, 0.31, 0.25, 1.0];
  if (upper.includes("STAIR")) return [0.55, 0.35, 0.65, 1.0];
  if (upper.includes("RAILING")) return [0.70, 0.60, 0.50, 1.0];
  if (upper.includes("PLATE")) return [0.60, 0.65, 0.70, 1.0];
  if (upper.includes("MEMBER")) return [0.65, 0.60, 0.55, 1.0];
  if (upper.includes("FOUNDATION")) return [0.50, 0.45, 0.40, 1.0];
  if (upper.includes("SHAFT")) return [0.45, 0.50, 0.55, 1.0];
  if (upper.includes("CURTAINWALL")) return [0.50, 0.60, 0.75, 1.0];
  return [0.68, 0.74, 0.81, 1.0];
}

const ELEMENT_TYPE_PATTERNS: Map<string, RegExp> = new Map([
  ["WALL", /WALL/i],
  ["SLAB", /SLAB/i],
  ["DOOR", /DOOR/i],
  ["WINDOW", /WINDOW/i],
  ["COLUMN", /COLUMN/i],
  ["BEAM", /BEAM/i],
  ["ROOF", /ROOF/i],
  ["STAIR", /STAIR/i],
  ["SPACE", /SPACE/i],
  ["MEMBER", /MEMBER/i],
  ["PLATE", /PLATE/i],
  ["RAILING", /RAILING/i],
  ["CURTAINWALL", /CURTAINWALL/i],
  ["SHAFT", /SHAFT/i],
  ["FOUNDATION", /FOUNDATION/i],
  ["CHILDELEMENT", /CHILDELEMENT/i],
  ["BUILDINGELEMENTPROXY", /BUILDINGELEMENTPROXY/i],
  ["ASSEMBLY", /ASSEMBLY/i],
  ["GROVE", /GROVE/i],
  ["ELEMENT", /ELEMENT/i],
  ["PROXY", /PROXY/i],
  ["FURNITURE", /FURNITURE/i],
  ["SIGN", /SIGN/i],
  ["AIRTERMINAL", /AIRTERMINAL/i],
  ["LIGHTFIXTURE", /LIGHTFIXTURE/i],
  ["UNITARY", /UNITARY/i],
]);

function shouldKeepIfcType(typeName: string): boolean {
  const upper = typeName.toUpperCase();
  let matched = false;
  ELEMENT_TYPE_PATTERNS.forEach((pattern) => {
    if (pattern.test(upper)) matched = true;
  });
  return matched;
}

function createAccessor(
  doc: Document,
  backingBuffer: ReturnType<Document["createBuffer"]>,
  array: AccessorArray,
  type: "SCALAR" | "VEC3"
) {
  return doc
    .createAccessor()
    .setBuffer(backingBuffer)
    .setArray(array as never)
    .setType(type);
}

function getBBoxFromPositions(positions: number[]) {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < positions.length; i += 3) {
    min.x = Math.min(min.x, positions[i]);
    min.y = Math.min(min.y, positions[i + 1]);
    min.z = Math.min(min.z, positions[i + 2]);
    max.x = Math.max(max.x, positions[i]);
    max.y = Math.max(max.y, positions[i + 1]);
    max.z = Math.max(max.z, positions[i + 2]);
  }
  return { min, max };
}

function updateDimensionsFromGeometry(element: IfcElementRecord) {
  const { min, max } = getBBoxFromPositions(element.geometry.positions);
  const dims = {
    Height: Number((max.z - min.z).toFixed(4)),
    Width: Number((max.x - min.x).toFixed(4)),
    Depth: Number((max.y - min.y).toFixed(4)),
  };
  element.properties.Dimensions = dims;
}

function extractTransformFromElement(
  api: IfcAPI,
  modelID: number,
  line: Record<string, unknown>
): IfcTransformRecord {
  const defaultTransform: IfcTransformRecord = {
    translation: [0, 0, 0],
    rotation: [0, 0, 0, 1],
    scale: [1, 1, 1],
  };

  interface IfcRecord { value: number; [key: string]: unknown }

  try {
    const placement = line?.ObjectPlacement as IfcRecord | undefined;
    if (!placement || typeof placement !== "object") {
      return defaultTransform;
    }

    const placementData = api.GetLine(modelID, placement.value, false);
    if (!placementData) return defaultTransform;

    const relPlacement = placementData?.RelativePlacement as IfcRecord | undefined;
    if (!relPlacement || typeof relPlacement !== "object") {
      return defaultTransform;
    }

    const locationData = api.GetLine(modelID, relPlacement.value, false);
    if (!locationData) return defaultTransform;

    const location = locationData?.Location as IfcRecord | undefined;
    const refDirection = locationData?.RefDirection as IfcRecord | undefined;

    let translation: [number, number, number] = [0, 0, 0];
    if (location && typeof location === "object") {
      const coords = api.GetLine(modelID, location.value, false);
      if (coords) {
        const x = (coords as { X?: number }).X ?? 0;
        const y = (coords as { Y?: number }).Y ?? 0;
        const z = (coords as { Z?: number }).Z ?? 0;
        translation = [x, y, z];
      }
    }

    let rotation: [number, number, number, number] = [0, 0, 0, 1];
    if (refDirection && typeof refDirection === "object") {
      const dirData = api.GetLine(modelID, refDirection.value, false);
      if (dirData) {
        const dr = (dirData as { DirectionRatios?: [number, number, number] }).DirectionRatios;
        if (dr && dr.length >= 4) {
          const q = new Quaternion();
          const dirVec = new Vector3(dr[0], dr[1], dr[2]);
          const upVec = new Vector3(0, 0, 1);
          if (dirVec.length() > 0.0001) {
            q.setFromUnitVectors(upVec, dirVec.normalize());
            rotation = [q.x, q.y, q.z, q.w];
          }
        }
      }
    }

    return {
      translation,
      rotation,
      scale: [1, 1, 1],
    };
  } catch {
    return defaultTransform;
  }
}

function mergePlacedGeometry(
  api: IfcAPI,
  modelID: number,
  flatMesh: {
    geometries: { size(): number; get(index: number): { color: { x: number; y: number; z: number; w: number }; geometryExpressID: number; flatTransformation: number[] } };
  }
) {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const allColors: Rgba[] = [];

  for (let geomIndex = 0; geomIndex < flatMesh.geometries.size(); geomIndex += 1) {
    const placed = flatMesh.geometries.get(geomIndex);
    allColors.push([placed.color.x, placed.color.y, placed.color.z, placed.color.w]);

    const geometry = api.GetGeometry(modelID, placed.geometryExpressID);
    const rawVertexData = api.GetVertexArray(
      geometry.GetVertexData(),
      geometry.GetVertexDataSize()
    );
    const rawIndexData = api.GetIndexArray(
      geometry.GetIndexData(),
      geometry.GetIndexDataSize()
    );

    const transformMatrix = new Matrix4().fromArray(placed.flatTransformation);
    const normalMatrix = new Matrix3().getNormalMatrix(transformMatrix);
    const vertexOffset = positions.length / 3;

    for (let i = 0; i < rawVertexData.length; i += 6) {
      const position = new Vector3(
        rawVertexData[i],
        rawVertexData[i + 1],
        rawVertexData[i + 2]
      ).applyMatrix4(transformMatrix);
      const normal = new Vector3(
        rawVertexData[i + 3],
        rawVertexData[i + 4],
        rawVertexData[i + 5]
      )
        .applyMatrix3(normalMatrix)
        .normalize();

      positions.push(position.x, position.y, position.z);
      normals.push(normal.x, normal.y, normal.z);
    }

    for (let i = 0; i < rawIndexData.length; i += 1) {
      indices.push(rawIndexData[i] + vertexOffset);
    }

    geometry.delete();
  }

  const resolvedColor = allColors.length > 0 ? allColors[0] : null;

  return {
    geometry: {
      type: "mesh" as const,
      positions,
      normals,
      indices,
    },
    color: resolvedColor,
    allColors,
  };
}

function createFallbackModel(sourceFileName: string): IfcModelRecord {
  const fallbackElement: IfcElementRecord = {
    id: `E_${nanoid(8)}`,
    type: "IFCBUILDINGELEMENTPROXY",
    name: sourceFileName.replace(/\.ifc$/i, "") || "IFC Model",
    geometry: {
      type: "mesh",
      positions: [
        -1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0,
        -1, -1, 2, 1, -1, 2, 1, 1, 2, -1, 1, 2,
      ],
      normals: [
        0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
        0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
      ],
      indices: [
        0, 1, 2, 0, 2, 3,
        4, 6, 5, 4, 7, 6,
        0, 4, 5, 0, 5, 1,
        1, 5, 6, 1, 6, 2,
        2, 6, 7, 2, 7, 3,
        3, 7, 4, 3, 4, 0,
      ],
    },
    transform: {
      translation: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    properties: {
      Identity: { SourceFile: sourceFileName },
      Appearance: { Color: [0.7, 0.72, 0.75, 1.0] },
      Dimensions: { Height: 2, Width: 2, Depth: 2 },
    },
  };
  return {
    project_id: `project_${nanoid(10)}`,
    created_at: new Date().toISOString(),
    elements: [fallbackElement],
  };
}

export async function createModelFromIfcBuffer(
  buffer: Buffer,
  sourceFileName: string
): Promise<IfcModelRecord> {
  const api = await getIfcApi();
  const modelID = api.OpenModel(new Uint8Array(buffer), {
    COORDINATE_TO_ORIGIN: true,
  });

  const debugLog: DebugLog = [];

  try {
    const meshes = api.LoadAllGeometry(modelID);
    const elements: IfcElementRecord[] = [];

    for (let meshIndex = 0; meshIndex < meshes.size(); meshIndex += 1) {
      const flatMesh = meshes.get(meshIndex);
      const expressID = flatMesh.expressID;
      const typeCode = api.GetLineType(modelID, expressID);
      const typeName = api.GetNameFromTypeCode(typeCode);

      if (!shouldKeepIfcType(typeName)) {
        debugLog.push({
          expressID,
          typeName,
          reason: "Element type not in keep list",
        });
        continue;
      }

      const line = api.GetLine(modelID, expressID, true);
      const extracted = mergePlacedGeometry(api, modelID, flatMesh);

      if (extracted.geometry.positions.length === 0 || extracted.geometry.indices.length === 0) {
        debugLog.push({
          expressID,
          typeName,
          reason: "Empty geometry after merge",
        });
        continue;
      }

      const element: IfcElementRecord = {
        id:
          typeof line?.GlobalId === "string" && line.GlobalId.trim()
            ? line.GlobalId
            : `E${expressID}`,
        type: typeName,
        name:
          typeof line?.Name === "string" && line.Name.trim()
            ? line.Name
            : `${typeName}_${expressID}`,
        geometry: extracted.geometry,
        transform: extractTransformFromElement(api, modelID, line as Record<string, unknown>),
        properties: {
          Identity: {
            SourceFile: sourceFileName,
            ExpressId: expressID,
            GlobalId: line?.GlobalId || `E${expressID}`,
            Name: line?.Name || `${typeName}_${expressID}`,
          },
          Appearance: {
            Color: extracted.color || typeColor(typeName),
          },
          Classification: {
            IfcType: typeName,
          },
        },
      };

      updateDimensionsFromGeometry(element);
      elements.push(element);
    }

    if (elements.length === 0) {
      return createFallbackModel(sourceFileName);
    }

    return {
      project_id: `project_${nanoid(10)}`,
      created_at: new Date().toISOString(),
      elements,
      debugLog,
    };
  } finally {
    api.CloseModel(modelID);
  }
}

export function createMetadataFromModel(model: IfcModelRecord) {
  const metadata: Record<string, unknown> = {};
  for (const elem of model.elements) {
    metadata[elem.id] = {
      globalId: elem.id,
      type: elem.type,
      name: elem.name,
      description: "",
      objectType: elem.type,
      properties: elem.properties || {},
    };
  }
  return metadata;
}

function getElementColor(element: IfcElementRecord): Rgba {
  const val = element.properties?.Appearance?.Color;
  if (Array.isArray(val) && val.length === 4 && val.every((v) => typeof v === "number")) {
    return val as Rgba;
  }
  return typeColor(element.type);
}

export async function generateGlbFromModel(model: IfcModelRecord) {
  const doc = new Document();
  const scene = doc.createScene("IFC Scene");
  doc.getRoot().setDefaultScene(scene);
  const backingBuffer = doc.createBuffer("ifc-geometry");

  for (const element of model.elements) {
    const { positions, normals, indices } = element.geometry;
    if (positions.length === 0 || indices.length === 0) continue;

    const material = doc
      .createMaterial(`mat_${element.id}`)
      .setBaseColorFactor(getElementColor(element))
      .setMetallicFactor(0.05)
      .setRoughnessFactor(0.85);

    const primitive = doc
      .createPrimitive()
      .setAttribute(
        "POSITION",
        createAccessor(doc, backingBuffer, new Float32Array(positions), "VEC3")
      )
      .setAttribute(
        "NORMAL",
        createAccessor(doc, backingBuffer, new Float32Array(normals), "VEC3")
      )
      .setIndices(
        createAccessor(doc, backingBuffer, new Uint32Array(indices), "SCALAR")
      )
      .setMaterial(material);

    const mesh = doc.createMesh(element.id).addPrimitive(primitive);
    const node = doc.createNode(element.id).setMesh(mesh);
    scene.addChild(node);
  }

  const io = new NodeIO();
  const glb = await io.writeBinary(doc);
  return Buffer.from(glb);
}

const TARGET_TYPE_PATTERNS: Array<[RegExp, string]> = [
  [/\bwalls?\b/i, "IFCWALL"],
  [/\bslabs?\b/i, "IFCSLAB"],
  [/\bdoors?\b/i, "IFCDOOR"],
  [/\bwindows?\b/i, "IFCWINDOW"],
  [/\bcolumns?\b/i, "IFCCOLUMN"],
  [/\bbeams?\b/i, "IFCBEAM"],
  [/\broofs?\b/i, "IFCROOF"],
  [/\bstairs?\b/i, "IFCSTAIR"],
];

type TargetScope = "auto" | "all" | "selected";
type DimensionKey = "height" | "width" | "depth";
type RotationAxis = "x" | "y" | "z";

function findTargetTypeFromMessage(message: string) {
  for (const [pattern, targetType] of TARGET_TYPE_PATTERNS) {
    if (pattern.test(message)) return targetType;
  }
  return "";
}

function parseMeters(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function parseDimensionValue(message: string, dimension: DimensionKey) {
  const lower = message.toLowerCase();
  const unit = "(m|meter|meters|metre|metres|meteres|metere)";
  const patterns: Record<DimensionKey, RegExp[]> = {
    height: [
      new RegExp(`(?:height|tall|high)[^\\d]{0,20}(\\d+(?:\\.\\d+)?)\\s*${unit}?`, "i"),
      new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}\\s*(?:tall|high)`, "i"),
    ],
    width: [
      new RegExp(`(?:width|wide|wider)[^\\d]{0,20}(\\d+(?:\\.\\d+)?)\\s*${unit}?`, "i"),
      new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}\\s*(?:wide)`, "i"),
    ],
    depth: [
      new RegExp(
        `(?:depth|deep|thickness|thick|thicker)[^\\d]{0,20}(\\d+(?:\\.\\d+)?)\\s*${unit}?`,
        "i"
      ),
      new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}\\s*(?:thick|deep)`, "i"),
    ],
  };

  for (const pattern of patterns[dimension]) {
    const match = lower.match(pattern);
    if (!match) continue;
    const value = parseMeters(match[1]);
    if (value) return value;
  }

  const genericUnit = lower.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}`, "i"));
  if (genericUnit) {
    const hasDimensionHint =
      (dimension === "height" && /\b(height|tall|high|raise)\b/.test(lower)) ||
      (dimension === "width" && /\b(width|wide|wider)\b/.test(lower)) ||
      (dimension === "depth" && /\b(depth|deep|thick|thickness|thicker)\b/.test(lower));
    if (hasDimensionHint) {
      return parseMeters(genericUnit[1]);
    }
  }

  return null;
}

function parseRgbColor(message: string): Rgba | null {
  const named: Record<string, Rgba> = {
    "steel blue": [0.37, 0.55, 0.72, 1],
    charcoal: [0.22, 0.24, 0.28, 1],
    orange: [0.88, 0.5, 0.22, 1],
    purple: [0.55, 0.37, 0.76, 1],
    pink: [0.89, 0.47, 0.65, 1],
    brown: [0.52, 0.35, 0.23, 1],
    teal: [0.16, 0.57, 0.58, 1],
    cyan: [0.34, 0.78, 0.84, 1],
    navy: [0.19, 0.29, 0.56, 1],
    red: [0.85, 0.25, 0.25, 1],
    blue: [0.33, 0.57, 0.9, 1],
    green: [0.3, 0.66, 0.4, 1],
    yellow: [0.85, 0.74, 0.25, 1],
    gray: [0.6, 0.62, 0.65, 1],
    grey: [0.6, 0.62, 0.65, 1],
    white: [0.9, 0.9, 0.9, 1],
    black: [0.2, 0.2, 0.2, 1],
  };
  const lower = message.toLowerCase();
  const hexMatch = lower.match(/#([0-9a-f]{6})\b/i);
  if (hexMatch) {
    const value = hexMatch[1];
    const r = Number.parseInt(value.slice(0, 2), 16) / 255;
    const g = Number.parseInt(value.slice(2, 4), 16) / 255;
    const b = Number.parseInt(value.slice(4, 6), 16) / 255;
    return [r, g, b, 1];
  }

  const rgbMatch = lower.match(
    /rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})(?:\s*[,/]\s*(\d(?:\.\d+)?))?\s*\)/
  );
  if (rgbMatch) {
    const r = Math.min(255, Number(rgbMatch[1])) / 255;
    const g = Math.min(255, Number(rgbMatch[2])) / 255;
    const b = Math.min(255, Number(rgbMatch[3])) / 255;
    const a =
      rgbMatch[4] !== undefined ? Math.min(1, Math.max(0, Number(rgbMatch[4]))) : 1;
    return [r, g, b, a];
  }

  for (const [name, color] of Object.entries(named).sort(
    ([left], [right]) => right.length - left.length
  )) {
    if (lower.includes(name)) return color;
  }
  return null;
}

function isColorInstruction(message: string) {
  const lower = message.toLowerCase();
  return (
    /\b(color|colour|paint|recolor|re-colour|material|shade|tint)\b/.test(lower) ||
    parseRgbColor(lower) !== null
  );
}

function isRemoveInstruction(message: string) {
  return /\b(remove|delete|erase|demolish)\b/.test(message);
}

function isRenameInstruction(message: string) {
  return /\b(rename|call|label)\b/.test(message);
}

function parseRenameValue(message: string) {
  const match =
    message.match(/\b(?:rename|label)\b[\s\S]*?\b(?:to|as)\b\s+["']?(.+?)["']?$/i) ||
    message.match(/\bcall\b[\s\S]*?\b(?:it|them|this|that)?\s*["']?(.+?)["']?$/i);
  const value = match?.[1]?.trim();
  return value ? value.replace(/^["']|["']$/g, "").trim() : null;
}

function shouldRestoreDefaultColor(message: string) {
  return (
    /\b(default|original|initial|standard)\b/.test(message) &&
    /\b(color|colour|material|appearance)\b/.test(message)
  );
}

function getContextElementIds(selectedContexts: SelectedContext[]) {
  return selectedContexts
    .map((ctx) => ctx.element_id)
    .filter((id): id is string => Boolean(id));
}

function inferTargetTypeFromContext(selectedContexts: SelectedContext[]) {
  const first = selectedContexts.find((ctx) => typeof ctx.element_type === "string");
  const value = first?.element_type?.toUpperCase() || "";
  if (value.includes("WALL")) return "IFCWALL";
  if (value.includes("SLAB")) return "IFCSLAB";
  if (value.includes("DOOR")) return "IFCDOOR";
  if (value.includes("WINDOW")) return "IFCWINDOW";
  if (value.includes("COLUMN")) return "IFCCOLUMN";
  if (value.includes("BEAM")) return "IFCBEAM";
  if (value.includes("ROOF")) return "IFCROOF";
  if (value.includes("STAIR")) return "IFCSTAIR";
  return "";
}

function inferTargetScope(message: string, selectedContexts: SelectedContext[]): TargetScope {
  if (selectedContexts.length > 0) {
    if (/\b(selected|this|that|these|those|it|them|picked|chosen)\b/.test(message)) {
      return "selected";
    }
    if (!findTargetTypeFromMessage(message)) {
      return "selected";
    }
  }
  if (/\b(all|every|each|entire|whole)\b/.test(message)) {
    return "all";
  }
  return "auto";
}

function selectTargets(
  model: IfcModelRecord,
  targetType: string,
  selectedContexts: SelectedContext[],
  scope: TargetScope
) {
  const selectedIds = getContextElementIds(selectedContexts);
  const selectedSet = new Set(selectedIds);

  let candidates = model.elements;

  if (scope === "selected" && selectedSet.size > 0) {
    candidates = candidates.filter((element) => selectedSet.has(element.id));
  }

  if (targetType) {
    candidates = candidates.filter((element) =>
      element.type.toUpperCase().includes(targetType)
    );
  }

  if (scope !== "selected" && !targetType && selectedSet.size > 0) {
    return candidates.filter((e) => selectedSet.has(e.id));
  }

  if (scope === "selected" && selectedSet.size === 0) {
    return [];
  }

  if (!targetType) {
    if (scope === "all") {
      return candidates;
    }
    if (selectedSet.size > 0) {
      return candidates.filter((e) => selectedSet.has(e.id));
    }
    return [];
  }

  return candidates;
}

function scaleAxisToTarget(
  element: IfcElementRecord,
  axis: 0 | 1 | 2,
  targetDimension: number
) {
  const positions = element.geometry.positions;
  const { min, max } = getBBoxFromPositions(positions);
  const mins = [min.x, min.y, min.z];
  const maxs = [max.x, max.y, max.z];
  const currentDimension = maxs[axis] - mins[axis];
  if (!Number.isFinite(currentDimension) || currentDimension <= 0.0001) {
    return false;
  }

  const scale = targetDimension / currentDimension;
  for (let i = axis; i < positions.length; i += 3) {
    positions[i] = mins[axis] + (positions[i] - mins[axis]) * scale;
  }
  updateDimensionsFromGeometry(element);
  return true;
}

function parseRotationInstruction(message: string) {
  if (!/\b(?:rotate|turn|spin)\b/.test(message)) {
    return null;
  }

  const axisMatch =
    message.match(/\b(?:around|on|along)\s+([xyz])\s*axis\b/i) ||
    message.match(/\b([xyz])\s*axis\b/i);
  const axis = axisMatch?.[1]?.toLowerCase() as RotationAxis | undefined;
  if (!axis || !["x", "y", "z"].includes(axis)) {
    return null;
  }

  const degreesMatch = message.match(/(-?\d+(?:\.\d+)?)\s*(?:degree|degrees)/i);
  const degrees = degreesMatch ? Number(degreesMatch[1]) : 90;
  if (!Number.isFinite(degrees) || degrees === 0) {
    return null;
  }

  return {
    axis,
    degrees,
  };
}

function rotateWholeModel(model: IfcModelRecord, axis: RotationAxis, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  const rotationMatrix = new Matrix4();
  if (axis === "x") rotationMatrix.makeRotationX(radians);
  if (axis === "y") rotationMatrix.makeRotationY(radians);
  if (axis === "z") rotationMatrix.makeRotationZ(radians);
  const normalMatrix = new Matrix3().getNormalMatrix(rotationMatrix);
  const quaternion = new Quaternion().setFromEuler(
    new Euler(
      axis === "x" ? radians : 0,
      axis === "y" ? radians : 0,
      axis === "z" ? radians : 0
    )
  );

  for (const element of model.elements) {
    const positions = element.geometry.positions;
    const normals = element.geometry.normals;

    for (let i = 0; i < positions.length; i += 3) {
      const rotated = new Vector3(
        positions[i],
        positions[i + 1],
        positions[i + 2]
      ).applyMatrix4(rotationMatrix);
      positions[i] = Number(rotated.x.toFixed(6));
      positions[i + 1] = Number(rotated.y.toFixed(6));
      positions[i + 2] = Number(rotated.z.toFixed(6));
    }

    for (let i = 0; i < normals.length; i += 3) {
      const rotatedNormal = new Vector3(
        normals[i],
        normals[i + 1],
        normals[i + 2]
      )
        .applyMatrix3(normalMatrix)
        .normalize();
      normals[i] = Number(rotatedNormal.x.toFixed(6));
      normals[i + 1] = Number(rotatedNormal.y.toFixed(6));
      normals[i + 2] = Number(rotatedNormal.z.toFixed(6));
    }

    element.transform.rotation = [
      Number(quaternion.x.toFixed(6)),
      Number(quaternion.y.toFixed(6)),
      Number(quaternion.z.toFixed(6)),
      Number(quaternion.w.toFixed(6)),
    ];
    updateDimensionsFromGeometry(element);
  }
}

export function applyInstructionToModel(
  model: IfcModelRecord,
  message: string,
  selectedContexts: SelectedContext[] = []
) {
  const lower = message.trim().toLowerCase();
  if (!lower) {
    return {
      model,
      updated: false,
      assistant: {
        content: "Please enter a valid instruction.",
        explanation: "Instruction was empty.",
        plan: [],
        actions: [],
      },
    };
  }

  if (
    lower.startsWith("hi") ||
    lower.startsWith("hello") ||
    lower.startsWith("hey") ||
    lower.includes("help")
  ) {
    return {
      model,
      updated: false,
      assistant: {
        content:
          "I can edit the IFC model. Try prompts like 'make all walls 4 meters tall', 'paint the selected slab steel blue', 'rename this wall to West Wing', 'undo last change', or 'reset to the original upload'.",
        explanation: "Conversational prompt detected.",
        plan: [],
        actions: [],
      },
    };
  }

  const targetType =
    findTargetTypeFromMessage(lower) || inferTargetTypeFromContext(selectedContexts);
  const targetScope = inferTargetScope(lower, selectedContexts);
  const matching = selectTargets(model, targetType, selectedContexts, targetScope);
  const targetLabel = targetType
    ? targetType
    : targetScope === "all"
    ? "all elements"
    : targetScope === "selected"
    ? "selected"
    : "matching";
  const rotationInstruction = parseRotationInstruction(lower);

  if (rotationInstruction) {
    rotateWholeModel(model, rotationInstruction.axis, rotationInstruction.degrees);
    return {
      model,
      updated: true,
      assistant: {
        content: `Rotated the whole model ${rotationInstruction.degrees} degrees on the ${rotationInstruction.axis.toUpperCase()} axis.`,
        explanation: "Applied a whole-model geometry rotation to every IFC element.",
        plan: [
          "Interpret requested rotation axis",
          "Rotate all element geometry and normals",
          "Regenerate the 3D model",
        ],
        actions: [
          {
            type: "rotate_model",
            axis: rotationInstruction.axis,
            degrees: rotationInstruction.degrees,
          },
        ],
      },
    };
  }

  if (isRemoveInstruction(lower)) {
    if (matching.length === 0) {
      return {
        model,
        updated: false,
        assistant: {
          content: "No matching elements found to remove.",
          explanation: "No target elements matched the remove command.",
          plan: [],
          actions: [],
        },
      };
    }

    const ids = new Set(matching.map((m) => m.id));
    model.elements = model.elements.filter((element) => !ids.has(element.id));
    return {
      model,
      updated: true,
      assistant: {
        content: `Removed ${ids.size} elements.`,
        explanation: `Removed ${targetLabel} elements.`,
        plan: ["Resolve target elements", "Remove matching elements", "Regenerate model assets"],
        actions: [{ type: "remove", targetType: targetLabel, count: ids.size }],
      },
    };
  }

  if (isRenameInstruction(lower)) {
    const nextName = parseRenameValue(message);
    if (!nextName) {
      return {
        model,
        updated: false,
        assistant: {
          content: "I could not parse the new name. Example: 'rename this wall to Lobby Partition'.",
          explanation: "Rename command was detected without a usable target label.",
          plan: [],
          actions: [],
        },
      };
    }

    if (matching.length === 0) {
      return {
        model,
        updated: false,
        assistant: {
          content: "No matching elements found to rename.",
          explanation: "No target elements matched the rename command.",
          plan: [],
          actions: [],
        },
      };
    }

    for (const element of matching) {
      element.name = matching.length === 1 ? nextName : `${nextName} ${element.id.slice(-4)}`;
      if (!element.properties.Identity) {
        element.properties.Identity = {};
      }
      element.properties.Identity.Name = element.name;
    }

    return {
      model,
      updated: true,
      assistant: {
        content:
          matching.length === 1
            ? `Renamed the element to "${nextName}".`
            : `Renamed ${matching.length} elements using "${nextName}" as the base label.`,
        explanation: `Updated display names for ${targetLabel} elements.`,
        plan: ["Resolve target elements", "Update element identity fields", "Regenerate model metadata"],
        actions: [
          {
            type: "rename",
            targetType: targetLabel,
            name: nextName,
            count: matching.length,
          },
        ],
      },
    };
  }

  const height = parseDimensionValue(lower, "height");
  if (height !== null) {
    if (matching.length === 0) {
      return {
        model,
        updated: false,
        assistant: {
          content: "No matching elements found for height update.",
          explanation: "No target elements matched the height command.",
          plan: [],
          actions: [],
        },
      };
    }

    let updatedCount = 0;
    for (const element of matching) {
      if (scaleAxisToTarget(element, 2, height)) {
        updatedCount += 1;
      }
    }

    return {
      model,
      updated: updatedCount > 0,
      assistant: {
        content:
          updatedCount > 0
            ? `Updated height to ${height}m for ${updatedCount} elements.`
            : "No matching elements found for height update.",
        explanation: `Changed ${targetLabel} height to ${height}m.`,
        plan: [
          `Find ${targetLabel} elements`,
          "Scale geometry to the requested height",
          "Regenerate the 3D model",
        ],
        actions: [
          {
            type: "update_height",
            targetType: targetLabel,
            height,
            count: updatedCount,
          },
        ],
      },
    };
  }

  const width = parseDimensionValue(lower, "width");
  if (width !== null) {
    if (matching.length === 0) {
      return {
        model,
        updated: false,
        assistant: {
          content: "No matching elements found for width update.",
          explanation: "No target elements matched the width command.",
          plan: [],
          actions: [],
        },
      };
    }

    let updatedCount = 0;
    for (const element of matching) {
      if (scaleAxisToTarget(element, 0, width)) {
        updatedCount += 1;
      }
    }

    return {
      model,
      updated: updatedCount > 0,
      assistant: {
        content:
          updatedCount > 0
            ? `Updated width to ${width}m for ${updatedCount} elements.`
            : "No matching elements found for width update.",
        explanation: `Changed ${targetLabel} width to ${width}m.`,
        plan: [
          `Find ${targetLabel} elements`,
          "Scale geometry along the width axis",
          "Regenerate the 3D model",
        ],
        actions: [
          {
            type: "update_width",
            targetType: targetLabel,
            width,
            count: updatedCount,
          },
        ],
      },
    };
  }

  const depth = parseDimensionValue(lower, "depth");
  if (depth !== null) {
    if (matching.length === 0) {
      return {
        model,
        updated: false,
        assistant: {
          content:
            "No matching elements found for depth update.",
          explanation: "No target elements matched the depth command.",
          plan: [],
          actions: [],
        },
      };
    }

    let updatedCount = 0;
    for (const element of matching) {
      if (scaleAxisToTarget(element, 1, depth)) {
        updatedCount += 1;
      }
    }

    return {
      model,
      updated: updatedCount > 0,
      assistant: {
        content:
          updatedCount > 0
            ? `Updated depth to ${depth}m for ${updatedCount} elements.`
            : "No matching elements found for depth update.",
        explanation: `Changed ${targetLabel} depth to ${depth}m.`,
        plan: [
          `Find ${targetLabel} elements`,
          "Scale geometry along the depth axis",
          "Regenerate the 3D model",
        ],
        actions: [
          {
            type: "update_depth",
            targetType: targetLabel,
            depth,
            count: updatedCount,
          },
        ],
      },
    };
  }

  if (isColorInstruction(lower)) {
    const color = shouldRestoreDefaultColor(lower)
      ? null
      : parseRgbColor(lower) || typeColor(targetType || "selected");
    if (matching.length === 0) {
      return {
        model,
        updated: false,
        assistant: {
          content: "No matching elements found for color update.",
          explanation: "No target elements matched the color command.",
          plan: [],
          actions: [],
        },
      };
    }

    for (const element of matching) {
      if (!element.properties.Appearance) {
        element.properties.Appearance = {};
      }
      element.properties.Appearance.Color = color || typeColor(element.type);
    }

    return {
      model,
      updated: true,
      assistant: {
        content: shouldRestoreDefaultColor(lower)
          ? `Restored the default colour palette for ${matching.length} elements.`
          : `Updated colour for ${matching.length} elements.`,
        explanation: shouldRestoreDefaultColor(lower)
          ? `Reset ${targetLabel} appearance to the default IFC palette.`
          : `Changed ${targetLabel} color.`,
        plan: [
          `Find ${targetLabel} elements`,
          "Update appearance properties",
          "Regenerate 3D model",
        ],
        actions: [
          {
            type: "update_color",
            targetType: targetLabel,
            color: color || "default",
            count: matching.length,
          },
        ],
      },
    };
  }

  return {
    model,
    updated: false,
    assistant: {
      content:
        "Instruction did not match an editable command. Try 'paint the selected wall navy', 'make all beams 0.6 meters wide', 'rename this door to Service Entry', or 'remove the selected slab'.",
      explanation: "No matching transformation rule.",
      plan: [],
      actions: [],
    },
  };
}
