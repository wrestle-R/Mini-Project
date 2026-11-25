type IfcElement = {
  id?: string;
  type?: string;
  name?: string;
  geometry?: Record<string, unknown>;
  properties?: Record<string, unknown>;
};

type IfcModel = {
  project_id?: string;
  elements?: IfcElement[];
};

type ReportSectionCount = {
  count: number;
  quantity: number;
  unit: string;
};

type DimensionSet = {
  width: number;
  depth: number;
  height: number;
};

type DimensionMetrics = {
  longest: number;
  middle: number;
  shortest: number;
  faceArea: number;
  footprintArea: number;
  volume: number;
  surfaceArea: number;
  perimeter: number;
};

type MaterialLineItem = {
  material: string;
  quantity: number;
  quantityRange: { min: number; max: number };
  unit: string;
  basis: string;
};

type ElementAssessment = {
  id: string;
  name: string;
  rawType: string;
  classification: string;
  dimensions: DimensionSet;
  metrics: DimensionMetrics;
  materialLines: MaterialLineItem[];
  laborDays: number;
};

const STRUCTURAL_TYPES = ["wall", "column", "slab", "beam", "roof", "stair", "member", "proxy", "unknown"];
const OPENING_TYPES = ["door", "window"];

function positiveNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function roundQuantity(value: number) {
  return Number(value.toFixed(2));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rangeFromQuantity(value: number, minFactor = 0.9, maxFactor = 1.15) {
  return {
    min: roundQuantity(value * minFactor),
    max: roundQuantity(value * maxFactor),
  };
}

function getBaseProperties(element: IfcElement) {
  const base = element.properties?.base;
  return base && typeof base === "object" ? (base as Record<string, unknown>) : {};
}

function getPropertyDimensions(element: IfcElement): DimensionSet | null {
  const dims = element.properties?.Dimensions;
  if (!dims || typeof dims !== "object") return null;
  const record = dims as Record<string, unknown>;
  const width = positiveNumber(record.Width ?? record.width, 0);
  const depth = positiveNumber(record.Depth ?? record.depth, 0);
  const height = positiveNumber(record.Height ?? record.height, 0);
  if (!width && !depth && !height) return null;
  return {
    width: width || 0.01,
    depth: depth || 0.01,
    height: height || 0.01,
  };
}

function getGeometryDimensions(element: IfcElement): DimensionSet | null {
  const positions = element.geometry?.positions;
  if (!Array.isArray(positions) || positions.length < 9) return null;

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let index = 0; index < positions.length; index += 3) {
    const x = Number(positions[index]);
    const y = Number(positions[index + 1]);
    const z = Number(positions[index + 2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(minZ)) return null;

  return {
    width: Math.max(0.01, roundQuantity(maxX - minX)),
    depth: Math.max(0.01, roundQuantity(maxY - minY)),
    height: Math.max(0.01, roundQuantity(maxZ - minZ)),
  };
}

function getConservativeDimensions(element: IfcElement): DimensionSet {
  const fromProperties = getPropertyDimensions(element);
  const fromGeometry = getGeometryDimensions(element);

  if (fromProperties && fromGeometry) {
    return {
      width: Math.max(fromProperties.width, fromGeometry.width, 0.01),
      depth: Math.max(fromProperties.depth, fromGeometry.depth, 0.01),
      height: Math.max(fromProperties.height, fromGeometry.height, 0.01),
    };
  }

  if (fromGeometry) return fromGeometry;
  if (fromProperties) return fromProperties;

  return { width: 1, depth: 1, height: 1 };
}

function getDimensionMetrics(dimensions: DimensionSet): DimensionMetrics {
  const sides = [dimensions.width, dimensions.depth, dimensions.height].sort((left, right) => right - left);
  const [longest, middle, shortest] = sides;
  const faceArea = roundQuantity(longest * middle);
  const footprintArea = roundQuantity(dimensions.width * dimensions.depth);
  const volume = roundQuantity(dimensions.width * dimensions.depth * dimensions.height);
  const surfaceArea = roundQuantity(2 * (dimensions.width * dimensions.depth + dimensions.width * dimensions.height + dimensions.depth * dimensions.height));
  const perimeter = roundQuantity(2 * (longest + middle));

  return {
    longest,
    middle,
    shortest,
    faceArea,
    footprintArea,
    volume,
    surfaceArea,
    perimeter,
  };
}

function getWallConcreteVolume(dimensions: DimensionSet) {
  const wallLength = Math.max(dimensions.width, dimensions.depth);
  const wallHeight = Math.max(0.01, dimensions.height);
  const observedThickness = Math.min(dimensions.width, dimensions.depth);
  const wallThickness = clamp(observedThickness || 0.2, 0.15, 0.23);
  return {
    wallLength,
    wallHeight,
    wallThickness,
    concreteVolume: roundQuantity(wallLength * wallHeight * wallThickness),
  };
}

function normalizeIfcKind(rawType?: string) {
  const upper = (rawType || "").toUpperCase();
  if (upper.includes("WALL")) return "wall";
  if (upper.includes("SLAB")) return "slab";
  if (upper.includes("PLATE")) return "slab";
  if (upper.includes("FOOTING")) return "column";
  if (upper.includes("DOOR")) return "door";
  if (upper.includes("WINDOW")) return "window";
  if (upper.includes("COLUMN")) return "column";
  if (upper.includes("BEAM")) return "beam";
  if (upper.includes("ROOF")) return "roof";
  if (upper.includes("STAIR")) return "stair";
  if (upper.includes("MEMBER")) return "member";
  if (upper.includes("SPACE")) return "space";
  if (upper.includes("PROXY")) return "proxy";
  return "unknown";
}

function inferKindFromDimensions(metrics: DimensionMetrics) {
  const flatness = metrics.shortest / Math.max(metrics.middle, 0.01);
  const elongation = metrics.longest / Math.max(metrics.middle, 0.01);
  const squatness = metrics.middle / Math.max(metrics.longest, 0.01);

  if (flatness <= 0.28 && elongation <= 1.9) return "slab";
  if (flatness <= 0.28 && elongation > 1.9) return metrics.middle <= 1.1 ? "beam" : "wall";
  if (flatness <= 0.45 && squatness <= 0.45) return "column";
  if (elongation >= 2.5 && metrics.middle >= 0.35 * metrics.longest) return "beam";
  return "unknown";
}

function kindStressScore(kind: string, metrics: DimensionMetrics) {
  switch (kind) {
    case "wall":
      return metrics.faceArea * 1.6 + metrics.volume * 8;
    case "slab":
      return metrics.footprintArea * 1.5 + metrics.volume * 7;
    case "column":
      return metrics.volume * 12;
    case "beam":
      return metrics.volume * 11;
    case "roof":
      return metrics.faceArea * 1.4 + metrics.volume * 8;
    case "stair":
      return metrics.volume * 13;
    case "door":
      return metrics.faceArea * 0.8 + metrics.perimeter;
    case "window":
      return metrics.faceArea * 0.7 + metrics.perimeter * 0.8;
    case "member":
      return metrics.volume * 15;
    case "proxy":
    case "unknown":
      return metrics.volume * 10 + metrics.surfaceArea * 0.5;
    default:
      return metrics.volume * 10;
  }
}

function chooseConservativeKind(rawKind: string, inferredKind: string, metrics: DimensionMetrics) {
  if (rawKind === "proxy" || rawKind === "unknown") {
    return inferredKind === "unknown" ? "proxy" : inferredKind;
  }

  if (rawKind === inferredKind) return rawKind;

  const rawScore = kindStressScore(rawKind, metrics);
  const inferredScore = kindStressScore(inferredKind, metrics);
  return inferredScore > rawScore ? inferredKind : rawKind;
}

function getMaterialPlan(kind: string, dimensions: DimensionSet, metrics: DimensionMetrics): MaterialLineItem[] {
  const basis = `bbox ${dimensions.width.toFixed(2)}m x ${dimensions.depth.toFixed(2)}m x ${dimensions.height.toFixed(2)}m`;
  const volume = metrics.volume;
  const faceArea = metrics.faceArea;
  const footprintArea = metrics.footprintArea;
  const surfaceArea = metrics.surfaceArea;
  const perimeter = metrics.perimeter;

  if (kind === "wall") {
    const wallBasis = getWallConcreteVolume(dimensions);
    const coreVolume = wallBasis.concreteVolume;
    const steelMid = roundQuantity(coreVolume * 100);
    return [
      { material: "reinforced concrete", quantity: coreVolume, unit: "cum", basis: `${basis}; wall volume = L x H x t (${wallBasis.wallLength.toFixed(2)} x ${wallBasis.wallHeight.toFixed(2)} x ${wallBasis.wallThickness.toFixed(2)})` },
      { material: "TMT rebar steel", quantity: steelMid, quantityRange: { min: roundQuantity(coreVolume * 80), max: roundQuantity(coreVolume * 120) }, unit: "kg", basis: `${basis}; steel thumb-rule 80-120 kg/cum` },
      { material: "formwork / shuttering", quantity: roundQuantity(faceArea * 2.1), unit: "sqm", basis: `${basis}; both wall faces` },
      { material: "cement plaster", quantity: roundQuantity(faceArea * 2.2), unit: "sqm", basis: `${basis}; both wall faces` },
    ].map((line) => ({ ...line, quantityRange: line.quantityRange || rangeFromQuantity(line.quantity) }));
  }

  if (kind === "slab" || kind === "roof") {
    const coreVolume = roundQuantity(volume * 1.18);
    const steelMid = roundQuantity(coreVolume * 100);
    return [
      { material: "reinforced concrete", quantity: coreVolume, unit: "cum", basis: `${basis}; flat structural core` },
      { material: "TMT rebar steel", quantity: steelMid, quantityRange: { min: roundQuantity(coreVolume * 80), max: roundQuantity(coreVolume * 120) }, unit: "kg", basis: `${basis}; steel thumb-rule 80-120 kg/cum` },
      { material: "formwork / shuttering", quantity: roundQuantity(faceArea * 1.08), unit: "sqm", basis: `${basis}; soffit formwork` },
      { material: kind === "roof" ? "waterproofing membrane" : "screed / finishing mortar", quantity: roundQuantity(footprintArea * 1.12), unit: "sqm", basis: `${basis}; top surface finish` },
    ].map((line) => ({ ...line, quantityRange: line.quantityRange || rangeFromQuantity(line.quantity) }));
  }

  if (kind === "column" || kind === "beam" || kind === "member") {
    if (kind === "member") {
      const steelKg = roundQuantity(volume * 7850 * 1.08);
      return [
        { material: "structural steel", quantity: steelKg, unit: "kg", basis: `${basis}; member volume to steel weight` },
        { material: "shop primer / coating", quantity: roundQuantity(surfaceArea * 1.08), unit: "sqm", basis: `${basis}; exposed steel surface` },
        { material: "high-strength bolts", quantity: 1, unit: "set", basis: `${basis}; connection allowance` },
      ].map((line) => ({ ...line, quantityRange: rangeFromQuantity(line.quantity) }));
    }

    const coreVolume = roundQuantity(volume * 1.18);
    const steelMid = roundQuantity(coreVolume * 100);
    return [
      { material: "reinforced concrete", quantity: coreVolume, unit: "cum", basis: `${basis}; vertical / horizontal structural core` },
      { material: "TMT rebar steel", quantity: steelMid, quantityRange: { min: roundQuantity(coreVolume * 80), max: roundQuantity(coreVolume * 120) }, unit: "kg", basis: `${basis}; steel thumb-rule 80-120 kg/cum` },
      { material: "formwork / shuttering", quantity: roundQuantity(surfaceArea * 0.95), unit: "sqm", basis: `${basis}; external faces` },
      { material: "patch repair mortar", quantity: roundQuantity(faceArea * 0.1), unit: "sqm", basis: `${basis}; edges and corrections` },
    ].map((line) => ({ ...line, quantityRange: line.quantityRange || rangeFromQuantity(line.quantity) }));
  }

  if (kind === "stair") {
    const coreVolume = roundQuantity(volume * 1.2);
    const steelMid = roundQuantity(coreVolume * 100);
    return [
      { material: "reinforced concrete", quantity: coreVolume, unit: "cum", basis: `${basis}; stair core volume` },
      { material: "TMT rebar steel", quantity: steelMid, quantityRange: { min: roundQuantity(coreVolume * 80), max: roundQuantity(coreVolume * 120) }, unit: "kg", basis: `${basis}; steel thumb-rule 80-120 kg/cum` },
      { material: "formwork / shuttering", quantity: roundQuantity(surfaceArea * 0.9), unit: "sqm", basis: `${basis}; stair soffit and risers` },
      { material: "finishing mortar / treads", quantity: roundQuantity(footprintArea * 1.15), unit: "sqm", basis: `${basis}; stair finish surface` },
    ].map((line) => ({ ...line, quantityRange: line.quantityRange || rangeFromQuantity(line.quantity) }));
  }

  if (kind === "door") {
    return [
      { material: "solid-core door leaf", quantity: 1, unit: "each", basis: `${basis}; one door assembly` },
      { material: "door frame", quantity: roundQuantity(perimeter * 1.05), unit: "lm", basis: `${basis}; perimeter frame` },
      { material: "hardware set", quantity: 1, unit: "set", basis: `${basis}; hinges, lock, handles` },
      { material: "sealant / filler", quantity: roundQuantity(perimeter * 0.5), unit: "lm", basis: `${basis}; perimeter sealing` },
    ].map((line) => ({ ...line, quantityRange: rangeFromQuantity(line.quantity) }));
  }

  if (kind === "window") {
    return [
      { material: "laminated glass", quantity: roundQuantity(faceArea * 1.1), unit: "sqm", basis: `${basis}; glazing area` },
      { material: "aluminum window frame", quantity: roundQuantity(perimeter * 1.08), unit: "lm", basis: `${basis}; perimeter frame` },
      { material: "sealant / gasket", quantity: roundQuantity(perimeter * 0.55), unit: "lm", basis: `${basis}; perimeter sealing` },
      { material: "fixing hardware", quantity: 1, unit: "set", basis: `${basis}; anchors and locks` },
    ].map((line) => ({ ...line, quantityRange: rangeFromQuantity(line.quantity) }));
  }

  const fallbackVolume = roundQuantity(volume * 1.2);
  const fallbackSteelMid = roundQuantity(fallbackVolume * 100);
  return [
    { material: "reinforced concrete", quantity: fallbackVolume, unit: "cum", basis: `${basis}; fallback structural allowance` },
    { material: "TMT rebar steel", quantity: fallbackSteelMid, quantityRange: { min: roundQuantity(fallbackVolume * 80), max: roundQuantity(fallbackVolume * 120) }, unit: "kg", basis: `${basis}; steel thumb-rule 80-120 kg/cum` },
    { material: "formwork / shuttering", quantity: roundQuantity(surfaceArea * 1.05), unit: "sqm", basis: `${basis}; fallback exposed surfaces` },
  ].map((line) => ({ ...line, quantityRange: line.quantityRange || rangeFromQuantity(line.quantity) }));
}

function detectBuildingType(projectId: string | undefined, fitResult: Record<string, unknown>, elementCounts: Record<string, number>) {
  const projectLabel = String(projectId || "").toLowerCase();
  if (projectLabel.includes("house") || projectLabel.includes("residential") || projectLabel.includes("villa")) {
    return "house" as const;
  }

  const landArea = Number(fitResult.land_area_sqm || 0);
  const footprint = Number(fitResult.model_footprint_area_sqm || 0);
  const floorsApprox = Math.max(1, Math.round((elementCounts.slab || 1) / 2));
  if ((landArea > 0 && landArea <= 1200 && footprint <= 450 && floorsApprox <= 3) || footprint <= 280) {
    return "house" as const;
  }

  return "generic" as const;
}

function applyBuildingCaps(
  buildingType: "house" | "generic",
  materialEstimate: Record<string, { elementCount: number; quantity: number; quantityRange: { min: number; max: number }; unit: string; basis: string }>,
  warnings: string[]
) {
  if (buildingType !== "house") return;

  const concreteKeys = Object.keys(materialEstimate).filter((key) => key.startsWith("reinforced concrete:") && key.endsWith(":cum"));
  const steelKeys = Object.keys(materialEstimate).filter((key) => key.startsWith("TMT rebar steel:") && key.endsWith(":kg"));

  const concreteTotal = concreteKeys.reduce((sum, key) => sum + materialEstimate[key].quantity, 0);
  const steelTotal = steelKeys.reduce((sum, key) => sum + materialEstimate[key].quantity, 0);

  if (concreteTotal > 200 && concreteTotal > 0) {
    const factor = 200 / concreteTotal;
    for (const key of concreteKeys) {
      materialEstimate[key].quantity = roundQuantity(materialEstimate[key].quantity * factor);
      materialEstimate[key].quantityRange.min = roundQuantity(materialEstimate[key].quantityRange.min * factor);
      materialEstimate[key].quantityRange.max = roundQuantity(materialEstimate[key].quantityRange.max * factor);
      materialEstimate[key].basis = `${materialEstimate[key].basis}; house cap applied`;
    }
    warnings.push("Concrete total capped for house profile to keep estimates within practical residential range.");
  }

  if (steelTotal > 15000 && steelTotal > 0) {
    const factor = 15000 / steelTotal;
    for (const key of steelKeys) {
      materialEstimate[key].quantity = roundQuantity(materialEstimate[key].quantity * factor);
      materialEstimate[key].quantityRange.min = roundQuantity(materialEstimate[key].quantityRange.min * factor);
      materialEstimate[key].quantityRange.max = roundQuantity(materialEstimate[key].quantityRange.max * factor);
      materialEstimate[key].basis = `${materialEstimate[key].basis}; house cap applied`;
    }
    warnings.push("Steel total capped for house profile to keep estimates within practical residential range.");
  }
}

function getLaborDays(kind: string, metrics: DimensionMetrics) {
  switch (kind) {
    case "wall":
      return roundQuantity(Math.max(metrics.faceArea / 18, metrics.volume * 1.35));
    case "slab":
      return roundQuantity(Math.max(metrics.footprintArea / 24, metrics.volume * 1.55));
    case "roof":
      return roundQuantity(Math.max(metrics.footprintArea / 22, metrics.volume * 1.65));
    case "column":
      return roundQuantity(Math.max(metrics.volume * 2.6, metrics.surfaceArea / 16));
    case "beam":
      return roundQuantity(Math.max(metrics.volume * 2.3, metrics.surfaceArea / 18));
    case "stair":
      return roundQuantity(Math.max(metrics.volume * 2.8, metrics.surfaceArea / 14));
    case "door":
      return roundQuantity(Math.max(0.35, metrics.faceArea / 8));
    case "window":
      return roundQuantity(Math.max(0.4, metrics.faceArea / 7));
    case "member":
      return roundQuantity(Math.max(metrics.volume * 2.9, metrics.surfaceArea / 13));
    case "proxy":
    case "unknown":
      return roundQuantity(Math.max(metrics.volume * 1.7, metrics.surfaceArea / 20));
    case "space":
      return roundQuantity(Math.max(0.5, metrics.volume * 0.1));
    default:
      return roundQuantity(Math.max(metrics.volume * 1.8, metrics.surfaceArea / 20));
  }
}

function mergeMaterialLines(target: Record<string, { elementCount: number; quantity: number; quantityRange: { min: number; max: number }; unit: string; basis: string }>, elementKind: string, materialLines: MaterialLineItem[]) {
  for (const line of materialLines) {
    const key = `${line.material}:${elementKind}:${line.unit}`;
    const existing = target[key] || {
      elementCount: 0,
      quantity: 0,
      quantityRange: { min: 0, max: 0 },
      unit: line.unit,
      basis: line.basis,
    };
    existing.elementCount += 1;
    existing.quantity = roundQuantity(existing.quantity + line.quantity);
    existing.quantityRange.min = roundQuantity(existing.quantityRange.min + line.quantityRange.min);
    existing.quantityRange.max = roundQuantity(existing.quantityRange.max + line.quantityRange.max);
    existing.unit = line.unit;
    existing.basis = line.basis;
    target[key] = existing;
  }
}

function addCount(target: Record<string, ReportSectionCount>, kind: string, quantity: number, unit: string) {
  const existing = target[kind] || { count: 0, quantity: 0, unit };
  existing.count += 1;
  existing.quantity = roundQuantity(existing.quantity + quantity);
  existing.unit = unit;
  target[kind] = existing;
}

function buildElementAssessment(element: IfcElement): ElementAssessment {
  const baseProps = getBaseProperties(element);
  const classifierInput = [
    element.type,
    element.name,
    baseProps.ObjectType,
    baseProps.PredefinedType,
    baseProps.Name,
  ]
    .filter(Boolean)
    .join(" ");
  const rawType = normalizeIfcKind(classifierInput);
  const dimensions = getConservativeDimensions(element);
  const metrics = getDimensionMetrics(dimensions);
  const inferredKind = inferKindFromDimensions(metrics);
  const classification = chooseConservativeKind(rawType, inferredKind, metrics);
  const materialLines = getMaterialPlan(classification, dimensions, metrics);
  const laborDays = getLaborDays(classification, metrics);

  return {
    id: element.id || element.name || classification,
    name: element.name || classification,
    rawType,
    classification,
    dimensions,
    metrics,
    materialLines,
    laborDays,
  };
}

export function buildWorkflowReport(params: {
  model: IfcModel;
  validationSnapshotId: string;
  ifcSessionId: string;
  ifcVersionNumber: number;
  fitResult: Record<string, unknown>;
}) {
  const elements = Array.isArray(params.model.elements) ? params.model.elements : [];
  const assessments = elements.map((element) => buildElementAssessment(element));
  const elementCounts: Record<string, number> = {};
  const typeQuantities: Record<string, ReportSectionCount> = {};
  const materialEstimate: Record<string, { elementCount: number; quantity: number; quantityRange: { min: number; max: number }; unit: string; basis: string }> = {};
  const warnings: string[] = [];

  let totalLaborDays = 0;
  let totalVolume = 0;
  let totalFootprintArea = 0;
  let totalSurfaceArea = 0;

  for (const assessment of assessments) {
    elementCounts[assessment.classification] = (elementCounts[assessment.classification] || 0) + 1;
    const takeoffQuantity =
      assessment.classification === "door" || assessment.classification === "window"
        ? assessment.metrics.faceArea
        : assessment.metrics.volume;
    addCount(
      typeQuantities,
      assessment.classification,
      takeoffQuantity,
      assessment.classification === "door" || assessment.classification === "window" ? "sqm" : "cum"
    );

    mergeMaterialLines(materialEstimate, assessment.classification, assessment.materialLines);

    totalLaborDays = roundQuantity(totalLaborDays + assessment.laborDays);
    totalVolume = roundQuantity(totalVolume + assessment.metrics.volume);
    totalFootprintArea = roundQuantity(totalFootprintArea + assessment.metrics.footprintArea);
    totalSurfaceArea = roundQuantity(totalSurfaceArea + assessment.metrics.surfaceArea);

  }

  const reportTypeGroups = {
    structural: STRUCTURAL_TYPES.filter((type) => type !== "proxy" && type !== "unknown").map((type) => ({ type, ...(typeQuantities[type] || { count: 0, quantity: 0, unit: "cum" }) })),
    openings: OPENING_TYPES.map((type) => ({ type, ...(typeQuantities[type] || { count: 0, quantity: 0, unit: "sqm" }) })),
    others: Object.entries(typeQuantities)
      .filter(([type]) => !STRUCTURAL_TYPES.includes(type) && !OPENING_TYPES.includes(type))
      .map(([type, data]) => ({ type, ...data })),
  };

  if (!elements.length) {
    warnings.push("No IFC elements were found in the uploaded model, so the report falls back to minimal allowances.");
  }

  if (!elementCounts.wall) {
    warnings.push("No wall-like elements were detected in the model geometry.");
  }

  if (!elementCounts.slab) {
    warnings.push("No slab-like elements were detected in the model geometry.");
  }

  const buildingType = detectBuildingType(params.model.project_id, params.fitResult, elementCounts);
  applyBuildingCaps(buildingType, materialEstimate, warnings);

  const materialTotals = Object.values(materialEstimate).reduce(
    (acc, item) => {
      acc.totalElements += item.elementCount;
      acc.totalQuantity = roundQuantity(acc.totalQuantity + item.quantity);
      acc.totalQuantityRange.min = roundQuantity(acc.totalQuantityRange.min + item.quantityRange.min);
      acc.totalQuantityRange.max = roundQuantity(acc.totalQuantityRange.max + item.quantityRange.max);
      return acc;
    },
    {
      totalElements: 0,
      totalQuantity: 0,
      totalQuantityRange: { min: 0, max: 0 },
    }
  );

  const durationMid = Math.max(1, Math.ceil(totalLaborDays));
  const durationRangeDays = {
    min: Math.max(1, Math.ceil(durationMid * 0.8)),
    max: Math.max(1, Math.ceil(durationMid * 1.3)),
  };

  const workerMid = Math.max(
    3,
    Math.ceil(
      Math.sqrt(Math.max(totalFootprintArea, 1)) / 2 +
        Math.cbrt(Math.max(totalVolume, 1)) * 0.9 +
        elements.length / 18
    )
  );
  const totalWorkerRange = {
    min: Math.max(2, Math.ceil(workerMid * 0.8)),
    max: Math.max(3, Math.ceil(workerMid * 1.25)),
  };

  const mixBlueprint: Array<{ role: string; share: number; enabled: boolean }> = [
    { role: "supervisor", share: 0.1, enabled: true },
    { role: "mason", share: 0.2, enabled: Boolean(elementCounts.wall || elementCounts.column || elementCounts.beam || elementCounts.slab || elementCounts.stair) },
    { role: "steel_fixer", share: 0.14, enabled: Boolean(elementCounts.column || elementCounts.beam || elementCounts.slab || elementCounts.stair || elementCounts.member) },
    { role: "carpenter", share: 0.16, enabled: Boolean(elementCounts.wall || elementCounts.slab || elementCounts.door || elementCounts.window || elementCounts.stair) },
    { role: "helper", share: 0.28, enabled: true },
    { role: "glazier", share: 0.06, enabled: Boolean(elementCounts.window) },
    { role: "fabricator", share: 0.06, enabled: Boolean(elementCounts.member) },
  ];

  const recommendedWorkerMix = mixBlueprint
    .filter((entry) => entry.enabled)
    .map((entry) => ({ role: entry.role, count: Math.max(entry.role === "supervisor" ? 1 : 0, Math.round(workerMid * entry.share)) }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => left.role.localeCompare(right.role));

  const peakCrewSize = recommendedWorkerMix.reduce((sum, item) => sum + item.count, 0);
  const phaseDays = {
    structural: Math.max(1, Math.ceil(durationMid * 0.5)),
    envelope: Math.max(1, Math.ceil(durationMid * 0.2)),
    finishes: Math.max(1, Math.ceil(durationMid * 0.2)),
    services: Math.max(1, Math.ceil(durationMid * 0.1)),
  };

  const estimatedDurationDays = Math.max(1, phaseDays.structural + phaseDays.envelope + phaseDays.finishes + phaseDays.services);

  const MATERIAL_RATES: Record<string, number> = {
    "reinforced concrete": 5000, // per cum
    "TMT rebar steel": 65, // per kg
    "formwork / shuttering": 350, // per sqm
    "cement plaster": 250, // per sqm
    "screed / finishing mortar": 200, // per sqm
    "waterproofing membrane": 450, // per sqm
    "structural steel": 85, // per kg
    "shop primer / coating": 150, // per sqm
    "high-strength bolts": 4000, // per set
    "patch repair mortar": 200, // per sqm
    "finishing mortar / treads": 300, // per sqm
    "solid-core door leaf": 6000, // per each
    "door frame": 400, // per lm
    "hardware set": 1200, // per set
    "sealant / filler": 80, // per lm
    "laminated glass": 1800, // per sqm
    "aluminum window frame": 500, // per lm
    "sealant / gasket": 80, // per lm
    "fixing hardware": 600, // per set
  };

  const LABOR_RATES: Record<string, number> = {
    supervisor: 1500, // per day
    mason: 900, // per day
    steel_fixer: 900, // per day
    carpenter: 900, // per day
    helper: 600, // per day
    glazier: 1000, // per day
    fabricator: 1000, // per day
  };

  let totalMaterialCost = 0;
  const materialCosts: Record<string, number> = {};
  for (const [key, item] of Object.entries(materialEstimate)) {
    const [material] = key.split(":");
    const rate = MATERIAL_RATES[material] || 0;
    const cost = rate * item.quantity;
    materialCosts[key] = cost;
    totalMaterialCost += cost;
  }

  let totalLaborCostPerDay = 0;
  for (const worker of recommendedWorkerMix) {
    const rate = LABOR_RATES[worker.role] || 600;
    totalLaborCostPerDay += rate * worker.count;
  }
  const totalLaborCost = totalLaborCostPerDay * estimatedDurationDays;
  const subtotalCost = totalMaterialCost + totalLaborCost;
  const contingencyCost = subtotalCost * 0.1; // 10% contingency
  const totalBudget = subtotalCost + contingencyCost;

  const costEstimate = {
    totalMaterialCost: Math.round(totalMaterialCost),
    totalLaborCost: Math.round(totalLaborCost),
    subtotalCost: Math.round(subtotalCost),
    contingencyCost: Math.round(contingencyCost),
    totalBudget: Math.round(totalBudget),
    materialCosts,
  };

  const elementAssessments = assessments.map((assessment) => ({
    id: assessment.id,
    name: assessment.name,
    classification: assessment.classification,
    rawType: assessment.rawType,
    dimensions: assessment.dimensions,
    metrics: assessment.metrics,
    laborDays: assessment.laborDays,
    materialLines: assessment.materialLines,
  }));

  return {
    schemaVersion: 2,
    generatedFrom: {
      ifcSessionId: params.ifcSessionId,
      ifcProjectId: params.model.project_id || null,
      ifcVersionNumber: params.ifcVersionNumber,
      validationSnapshotId: params.validationSnapshotId,
    },
    fitSummary: {
      fitStatus: params.fitResult.fit_status || null,
      fitScore: params.fitResult.fit_score || null,
      landAreaSqm: params.fitResult.land_area_sqm || null,
      footprintAreaSqm: params.fitResult.model_footprint_area_sqm || null,
      utilizationRatio: params.fitResult.utilization_ratio || null,
      roadAccess: params.fitResult.road_access || null,
    },
    dimensionSummary: {
      totalElements: elements.length,
      totalVolume: roundQuantity(totalVolume),
      totalFootprintArea: roundQuantity(totalFootprintArea),
      totalSurfaceArea: roundQuantity(totalSurfaceArea),
    },
    elementCounts,
    elementAssessments,
    detailedTakeoff: {
      structural: reportTypeGroups.structural,
      openings: reportTypeGroups.openings,
      others: reportTypeGroups.others,
      totalElements: elements.length,
      totalMaterialLines: Object.keys(materialEstimate).length,
    },
    materialEstimate: Object.entries(materialEstimate).map(([key, value]) => {
      const [material, elementType] = key.split(":");
      return { material, elementType, ...value };
    }),
    materialTotals,
    timeEstimate: {
      estimatedDurationDays,
      durationRangeDays,
      phaseDays,
      basis: "Dimension-led takeoff derived from element bounding boxes with calibrated productivity and geometry-based range factors.",
    },
    recommendedWorkerMix,
    workforceEstimate: {
      totalRecommendedWorkers: peakCrewSize,
      peakCrewSize,
      totalWorkerRange,
      recommendedWorkerMix,
    },
    costEstimate,
    projectHandoff: {
      warnings,
      assumptions: [
        "The report uses element bounding dimensions, not just IFC type labels.",
        "Missing or ambiguous geometry is classified using the safer material and labor profile.",
        "Material allowances include additional waste, shuttering, reinforcement, and finishing overhead.",
      ],
      nextStep: "Create or approve the project using this report as the handoff artifact.",
    },
  };
}
