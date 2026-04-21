// Shared TypeScript types for the GIS / Land Selection feature

// ── Spatial primitives ────────────────────────────────────────────────────

export interface BBox {
  min_lon: number;
  min_lat: number;
  max_lon: number;
  max_lat: number;
}

export interface LandPolygon {
  type: "Feature";
  geometry: GeoJSON.Geometry;
  properties: {
    areaSqm: number;
    centroid: [number, number]; // [lon, lat]
    bbox: BBox;
    source: "manual" | "agent" | "osm";
    confidence?: number;
  };
}

// ── Suggestion / scoring ──────────────────────────────────────────────────

export interface SuggestionTags {
  urbanity: string;
  roadDistance: number;
  landUseMix: string;
}

export interface SuggestionItem {
  id: string;
  geometry: GeoJSON.Geometry;
  score: number; // 0–1
  reasons: string[];
  tags: SuggestionTags;
  area_sqm: number;
  centroid: [number, number];
  bbox: BBox;
  confidence_label: "high" | "medium" | "low";
}

// ── Agent chat events ─────────────────────────────────────────────────────

export type ChatActionType =
  | "flyTo"
  | "drawPolygon"
  | "suggestAreas"
  | "filterAreas"
  | "showFitValidation"
  | "clearFitValidation"
  | "none";

export interface FlyToPayload {
  center: [number, number]; // [lon, lat]
  zoom: number;
}

export interface DrawPolygonPayload {
  geojson: GeoJSON.Feature;
}

export interface SuggestAreasPayload {
  candidates: SuggestionItem[];
  bbox: BBox;
}

export interface FilterAreasPayload {
  candidates: SuggestionItem[];
}

export interface ShowFitValidationPayload {
  insideGeometry?: GeoJSON.Geometry | null;
  overflowGeometry?: GeoJSON.Geometry | null;
  fitStatus: "valid" | "partial" | "invalid";
}

export interface ClearFitValidationPayload {
  clear: true;
}

export type ActionPayload =
  | FlyToPayload
  | DrawPolygonPayload
  | SuggestAreasPayload
  | FilterAreasPayload
  | ShowFitValidationPayload
  | ClearFitValidationPayload
  | Record<string, unknown>;

export interface ChatActionEvent {
  action_type: ChatActionType;
  payload: ActionPayload;
  explanation: string;
  follow_up?: string | null;
}

// ── Chat messages ─────────────────────────────────────────────────────────

export type MessageRole = "user" | "agent";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  actionEvent?: ChatActionEvent;
  timestamp: number;
}

// ── Map event bus ─────────────────────────────────────────────────────────

export type MapEventType = ChatActionType;

export interface MapEvent {
  type: MapEventType;
  payload: ActionPayload;
}

// ── GeoJSON globals (minimal if @types/geojson not installed) ─────────────
declare global {
  namespace GeoJSON {
    interface Geometry {
      type: string;
      coordinates: unknown;
    }
    interface Feature {
      type: "Feature";
      geometry: Geometry;
      properties: Record<string, unknown> | null;
    }
    interface FeatureCollection {
      type: "FeatureCollection";
      features: Feature[];
    }
  }
}
