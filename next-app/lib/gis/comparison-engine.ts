export interface ComparisonWeights {
  fit: number;
  environment: number;
  infrastructure: number;
  utilization: number;
}

export interface ParcelAnalysisSnapshot {
  fit_status?: "valid" | "partial" | "invalid";
  fit_score?: number;
  utilization_ratio?: number;
  has_building_collision?: boolean;
  has_water_collision?: boolean;
  environmental_summary?: {
    suitability_score?: number;
    flood_risk_level?: string;
    sensitivity_level?: string;
  } | null;
  infrastructure_summary?: {
    readiness_score?: number;
    readiness_level?: string;
  } | null;
}

export interface ComparableParcel {
  id: string;
  name: string;
  area: number;
  centroid: [number, number];
  analysis?: ParcelAnalysisSnapshot | null;
}

export interface RankedParcelResult {
  id: string;
  name: string;
  centroid: [number, number];
  area: number;
  compositeScore: number;
  componentScores: {
    fit: number;
    environment: number;
    infrastructure: number;
    utilization: number;
  };
  reasons: string[];
}

export const DEFAULT_COMPARISON_WEIGHTS: ComparisonWeights = {
  fit: 40,
  environment: 20,
  infrastructure: 25,
  utilization: 15,
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function normalizeWeights(weights: ComparisonWeights): ComparisonWeights {
  const total = Math.max(1, weights.fit + weights.environment + weights.infrastructure + weights.utilization);
  return {
    fit: weights.fit / total,
    environment: weights.environment / total,
    infrastructure: weights.infrastructure / total,
    utilization: weights.utilization / total,
  };
}

function utilizationScore(utilizationRatio?: number) {
  if (typeof utilizationRatio !== "number") return 0;
  if (utilizationRatio < 20) return 35;
  if (utilizationRatio < 40) return 55;
  if (utilizationRatio <= 80) return 90;
  if (utilizationRatio <= 92) return 65;
  return 25;
}

function riskPenalty(analysis?: ParcelAnalysisSnapshot | null) {
  if (!analysis) return 35;
  let penalty = 0;
  if (analysis.fit_status === "partial") penalty += 15;
  if (analysis.fit_status === "invalid") penalty += 35;
  if (analysis.has_building_collision) penalty += 25;
  if (analysis.has_water_collision) penalty += 30;
  if (analysis.environmental_summary?.flood_risk_level === "critical") penalty += 20;
  if (analysis.environmental_summary?.flood_risk_level === "high") penalty += 10;
  if (analysis.infrastructure_summary?.readiness_level === "low") penalty += 10;
  return penalty;
}

export function rankParcels(parcels: ComparableParcel[], weights: ComparisonWeights): RankedParcelResult[] {
  const normalized = normalizeWeights(weights);

  return parcels
    .filter((parcel) => parcel.analysis)
    .map((parcel) => {
      const analysis = parcel.analysis!;
      const fit = clamp(analysis.fit_score ?? 0);
      const environment = clamp(analysis.environmental_summary?.suitability_score ?? 0);
      const infrastructure = clamp(analysis.infrastructure_summary?.readiness_score ?? 0);
      const utilization = clamp(utilizationScore(analysis.utilization_ratio));

      const rawScore =
        fit * normalized.fit +
        environment * normalized.environment +
        infrastructure * normalized.infrastructure +
        utilization * normalized.utilization;
      const compositeScore = clamp(rawScore - riskPenalty(analysis), 0, 100);

      const reasons: string[] = [];
      if (fit >= 85) reasons.push("Strong geometric fit");
      if (environment >= 70) reasons.push("Good environmental suitability");
      if (infrastructure >= 70) reasons.push("Solid infrastructure readiness");
      if (utilization >= 80) reasons.push("Efficient land use");
      if (analysis.environmental_summary?.flood_risk_level === "high" || analysis.environmental_summary?.flood_risk_level === "critical") {
        reasons.push("Flood risk needs attention");
      }
      if (analysis.infrastructure_summary?.readiness_level === "low") {
        reasons.push("Utility extension likely required");
      }
      if (analysis.fit_status === "invalid") {
        reasons.push("Current placement does not validate");
      }

      return {
        id: parcel.id,
        name: parcel.name,
        centroid: parcel.centroid,
        area: parcel.area,
        compositeScore: Number(compositeScore.toFixed(1)),
        componentScores: {
          fit: Number(fit.toFixed(1)),
          environment: Number(environment.toFixed(1)),
          infrastructure: Number(infrastructure.toFixed(1)),
          utilization: Number(utilization.toFixed(1)),
        },
        reasons,
      };
    })
    .sort((left, right) => right.compositeScore - left.compositeScore);
}
