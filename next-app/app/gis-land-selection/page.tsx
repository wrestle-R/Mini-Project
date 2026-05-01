"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useRef, useState, useCallback, useEffect } from "react";
import {
  Map,
  Sparkles,
  Lock,
  Trash2,
  Download,
  ChevronRight,
  Globe2,
  Layers2,
  CheckCircle2,
  AlertTriangle,
  MapPin,
} from "lucide-react";
import type { Object3D } from "three";
import type { GisMapHandle } from "@/components/gis/GisMap";
import type { MapEvent, SuggestionItem } from "@/components/gis/types";
import ParcelCard from "@/components/gis/ParcelCard";

// Dynamic imports — no SSR for maplibre-gl (requires browser DOM)
const GisMap = dynamic(() => import("@/components/gis/GisMap"), { ssr: false });
const GisChat = dynamic(() => import("@/components/gis/GisChat"), { ssr: false });

import { useContractor } from "@/contexts/ContractorContext";

interface SessionSummary {
  id: string;
  title: string;
  currentGlbUrl: string;
  currentVersionNumber: number;
  workflowState?: string;
  currentValidationSnapshotId?: string | null;
  currentReportId?: string | null;
}

interface SelectedParcelInfo {
  areaSqm: number;
  centroid: [number, number];
  geojson: GeoJSON.Feature & { geometry: GeoJSON.Polygon };
}

interface SavedParcel {
  id: string;
  name: string;
  coordinates: [number, number][];
  centroid: [number, number];
  area: number;
  geojson: GeoJSON.Feature & { geometry: GeoJSON.Polygon };
}

interface ModelDimensions {
  width_m: number;
  depth_m: number;
  height_m: number;
  up_axis: "y" | "z";
}

interface FitValidationResult {
  fit_status: "valid" | "partial" | "invalid";
  fit_score: number;
  inside_area_sqm: number;
  overflow_area_sqm: number;
  model_footprint_area_sqm: number;
  land_area_sqm: number;
  utilization_ratio: number;
  utilization_class: "underutilized" | "moderate" | "optimal";
  overflow_direction?: string | null;
  overflow_distance_m?: number | null;
  suggested_rotation_deg: number;
  road_access: {
    nearest_road_distance_m: number | null;
    has_road_access: boolean;
    warning?: string | null;
  };
  nearby_building_access: {
    nearest_road_distance_m: number | null;
    has_road_access: boolean;
    warning?: string | null;
  };
  inside_geometry?: GeoJSON.Geometry | null;
  overflow_geometry?: GeoJSON.Geometry | null;
  has_building_collision?: boolean;
  messages: string[];
}

const GIS_BACKEND = "http://localhost:8000";
const BACKEND_TEST_MODEL_URL = `${GIS_BACKEND}/data/glb/diagnostic_backend_model.glb`;
const BACKEND_TEST_MODEL_DIMS: ModelDimensions = {
  width_m: 18,
  depth_m: 8,
  height_m: 8,
  up_axis: "y",
};
const EARTH_RADIUS_M = 6_371_000;

function offsetLonLat(center: [number, number], offsetXM: number, offsetYM: number): [number, number] {
  const latRad = (center[1] * Math.PI) / 180;
  const nextLon = center[0] + (offsetXM / (EARTH_RADIUS_M * Math.cos(latRad))) * (180 / Math.PI);
  const nextLat = center[1] + (offsetYM / EARTH_RADIUS_M) * (180 / Math.PI);
  return [nextLon, nextLat];
}

export default function GisLandSelectionPage() {
  const { token } = useContractor();
  const router = useRouter();
  const mapRef = useRef<GisMapHandle>(null);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [parcels, setParcels] = useState<SavedParcel[]>([]);
  const [lockedParcel, setLockedParcel] = useState<SuggestionItem | null>(null);
  const [selectedPolygon, setSelectedPolygon] = useState<SelectedParcelInfo | null>(null);
  const [rightPanel, setRightPanel] = useState<"chat" | "parcels">("chat");
  const [showSuggestionsPanel, setShowSuggestionsPanel] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [fetchingSessions, setFetchingSessions] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [modelFileName, setModelFileName] = useState<string | null>(null);
  const [modelDimensions, setModelDimensions] = useState<ModelDimensions | null>(null);
  const [rotationXDeg, setRotationXDeg] = useState(0);
  const [rotationYDeg, setRotationYDeg] = useState(0);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [modelOffsetXM, setModelOffsetXM] = useState(0);
  const [modelOffsetYM, setModelOffsetYM] = useState(0);
  const [modelScale, setModelScale] = useState(1);
  const roadWarningDistanceM = 50;
  const nearbyBuildingDistanceM = 50;
  const [validatingFit, setValidatingFit] = useState(false);
  const [fitResult, setFitResult] = useState<FitValidationResult | null>(null);
  const [currentGlbUrl, setCurrentGlbUrl] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionSummary | null>(null);
  const [validationSnapshotId, setValidationSnapshotId] = useState<string | null>(null);
  const [reportSummary, setReportSummary] = useState<{
    id: string;
    versionNumber: number;
    elementCounts: Record<string, number>;
    estimatedDurationDays: number;
    workerMix: { role: string; count: number }[];
  } | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Load parcels from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("gis_saved_parcels");
      if (saved) {
        try { setParcels(JSON.parse(saved)); } catch (e) { console.error(e); }
      }
    }
  }, []);

  // Fetch saved sessions
  useEffect(() => {
    async function fetchSessions() {
      if (!token) return;
      setFetchingSessions(true);
      try {
        const res = await fetch("/api/contractor/ifc/sessions", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSessions(data.sessions || []);
        }
      } catch (err) {
        console.error("Failed to fetch sessions", err);
      } finally {
        setFetchingSessions(false);
      }
    }
    fetchSessions();
  }, [token]);

  // Save parcels to localStorage
  const saveParcels = useCallback((newParcels: SavedParcel[]) => {
    setParcels(newParcels);
    localStorage.setItem("gis_saved_parcels", JSON.stringify(newParcels));
  }, []);

  const handleSaveSelection = useCallback(() => {
    if (!selectedPolygon) return;
    const newParcel = {
      id: crypto.randomUUID(),
      name: `Parcel ${parcels.length + 1}`,
      coordinates: selectedPolygon.geojson.geometry.coordinates[0].map(
        (point) => [point[0], point[1]] as [number, number]
      ),
      centroid: selectedPolygon.centroid,
      area: selectedPolygon.areaSqm,
      geojson: selectedPolygon.geojson,
    };
    saveParcels([...parcels, newParcel]);
  }, [selectedPolygon, parcels, saveParcels]);

  const handleDeleteParcel = useCallback((id: string) => {
    saveParcels(parcels.filter(p => p.id !== id));
  }, [parcels, saveParcels]);

  // ── Map event dispatcher (chat → map) ────────────────────────────────
  const handleMapEvent = useCallback((event: MapEvent) => {
    mapRef.current?.dispatchMapEvent(event);

    // If agent returned suggestions, cache them for the parcels panel
    if (event.type === "suggestAreas" || event.type === "filterAreas") {
      const payload = event.payload as { candidates?: SuggestionItem[] };
      if (payload.candidates?.length) {
        setSuggestions(payload.candidates);
        setShowSuggestionsPanel(true);
        setRightPanel("parcels");
      }
    }
  }, []);

  // ── Polygon change (map → UI) ────────────────────────────────────────
  const handlePolygonChange = useCallback((feature: GeoJSON.Feature | null) => {
    if (!feature) {
      setSelectedPolygon(null);
      setFitResult(null);
      setValidationSnapshotId(null);
      setReportSummary(null);
      mapRef.current?.dispatchMapEvent({ type: "clearFitValidation", payload: {} });
      return;
    }
    if (feature.geometry.type !== "Polygon") return;
    const coords = feature.geometry.coordinates?.[0];
    if (!coords?.length) return;

    // Rough area (Shoelace in degrees → m²)
    let areaVal = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      areaVal += coords[i][0] * coords[i + 1][1] - coords[i + 1][0] * coords[i][1];
    }
    const areaM2 = Math.abs(areaVal / 2) * 111_000 * 111_000;

    const centroid: [number, number] = [
      coords.reduce((s, c) => s + c[0], 0) / coords.length,
      coords.reduce((s, c) => s + c[1], 0) / coords.length,
    ];

    setSelectedPolygon({ areaSqm: areaM2, centroid, geojson: feature as GeoJSON.Feature & { geometry: GeoJSON.Polygon } });
    setFitResult(null);
    setValidationSnapshotId(null);
    setReportSummary(null);
    mapRef.current?.dispatchMapEvent({ type: "clearFitValidation", payload: {} });

    if (currentGlbUrl) {
      mapRef.current?.dispatchMapEvent({
        type: "loadModel",
        payload: {
          glbUrl: currentGlbUrl,
          center: offsetLonLat(centroid, modelOffsetXM, modelOffsetYM),
          rotation: rotationDeg,
          scale: modelScale,
          token: token,
          modelWidthM: modelDimensions ? modelDimensions.width_m * modelScale : undefined,
          modelDepthM: modelDimensions ? modelDimensions.depth_m * modelScale : undefined,
        }
      });
    }
  }, [currentGlbUrl, rotationDeg, token, modelDimensions, modelOffsetXM, modelOffsetYM, modelScale]);


  // ── Lock a parcel ────────────────────────────────────────────────────
  const handleLockParcel = useCallback(
    (item: SuggestionItem) => {
      if (lockedParcel?.id === item.id) {
        setLockedParcel(null);
        return;
      }
      setLockedParcel(item);
      // Draw on map
      mapRef.current?.dispatchMapEvent({
        type: "drawPolygon",
        payload: {
          geojson: {
            type: "Feature",
            geometry: item.geometry,
            properties: { score: item.score, confidence: item.confidence_label },
          },
        },
      });
    },
    [lockedParcel]
  );

  const handleFlyTo = useCallback((item: SuggestionItem) => {
    if (!item.centroid) return;
    mapRef.current?.dispatchMapEvent({
      type: "flyTo",
      payload: { center: item.centroid, zoom: 16 }
    });
  }, []);

  // ── Export selected polygon as GeoJSON ───────────────────────────────
  const handleExport = useCallback(() => {
    const feature = lockedParcel
      ? {
          type: "Feature",
          geometry: lockedParcel.geometry,
          properties: {
            score: lockedParcel.score,
            area_sqm: lockedParcel.area_sqm,
            reasons: lockedParcel.reasons,
            confidence: lockedParcel.confidence_label,
          },
        }
      : mapRef.current?.getSelectedPolygon();
    if (!feature) return;
    const blob = new Blob([JSON.stringify(feature, null, 2)], {
      type: "application/geo+json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "selected-parcel.geojson";
    a.click();
    URL.revokeObjectURL(url);
  }, [lockedParcel]);

  const handleClear = useCallback(() => {
    mapRef.current?.clearSuggestions();
    mapRef.current?.dispatchMapEvent({ type: "clearFitValidation", payload: { clear: true } });
    setSuggestions([]);
    setLockedParcel(null);
    setSelectedPolygon(null);
    setShowSuggestionsPanel(false);
    setFitResult(null);
    setSelectedSession(null);
    setValidationSnapshotId(null);
    setReportSummary(null);
    setCurrentGlbUrl(null);
    setModelFileName(null);
    setModelDimensions(null);
    setRotationXDeg(0);
    setRotationYDeg(0);
    setRotationDeg(0);
    setModelOffsetXM(0);
    setModelOffsetYM(0);
    setModelScale(1);
  }, []);


  const detectModelDimensions = useCallback(async (buffer: ArrayBuffer): Promise<ModelDimensions> => {
    const [{ GLTFLoader }, THREE] = await Promise.all([
      import("three/examples/jsm/loaders/GLTFLoader.js"),
      import("three"),
    ]);

    const loader = new GLTFLoader();
    const gltf = await new Promise<{ scene: Object3D }>((resolve, reject) => {
      loader.parse(buffer, "", resolve, reject);
    });

    const bounds = new THREE.Box3().setFromObject(gltf.scene);
    const size = bounds.getSize(new THREE.Vector3());

    const upAxis: "y" | "z" = size.z > size.y * 1.25 ? "z" : "y";
    const width_m = Math.max(0.01, size.x);
    const depth_m = Math.max(0.01, upAxis === "y" ? size.z : size.y);
    const height_m = Math.max(0.01, upAxis === "y" ? size.y : size.z);

    setModelScale(1);
    return {
      width_m: Number(width_m.toFixed(3)),
      depth_m: Number(depth_m.toFixed(3)),
      height_m: Number(height_m.toFixed(3)),
      up_axis: upAxis,
    };
  }, []);

  const handleModelSelect = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sessionId = e.target.value;
    if (!sessionId) {
      setSelectedSession(null);
      setModelFileName(null);
      setModelDimensions(null);
      setCurrentGlbUrl(null);
      setRotationDeg(0);
      setModelOffsetXM(0);
      setModelOffsetYM(0);
      setModelScale(1);
      setFitResult(null);
      setValidationSnapshotId(null);
      setReportSummary(null);
      mapRef.current?.dispatchMapEvent({ type: "clearFitValidation", payload: { clear: true } });
      return;
    }
    
    const session = sessions.find(s => s.id === sessionId);
    if (!session || !session.currentGlbUrl || !token) return;

    setLoadingModel(true);
    try {
      const res = await fetch(session.currentGlbUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to download model");
      
      const buffer = await res.arrayBuffer();
      const dims = await detectModelDimensions(buffer);
      const loadRotation = 0;
      
      setModelFileName(session.title);
      setModelDimensions(dims);
      setCurrentGlbUrl(session.currentGlbUrl);
      setSelectedSession(session);
      setRotationXDeg(0);
      setRotationYDeg(0);
      setRotationDeg(loadRotation);
      setModelOffsetXM(0);
      setModelOffsetYM(0);
      setModelScale(1);
      setFitResult(null);
      setValidationSnapshotId(session.currentValidationSnapshotId ?? null);
      setReportSummary(null);
      mapRef.current?.dispatchMapEvent({ type: "clearFitValidation", payload: { clear: true } });
      
      if (selectedPolygon) {
        mapRef.current?.dispatchMapEvent({
          type: "loadModel",
          payload: {
            glbUrl: session.currentGlbUrl,
            center: selectedPolygon.centroid,
            rotation: loadRotation,
            scale: 1,
            token: token,
            modelWidthM: dims.width_m,
            modelDepthM: dims.depth_m,
            upAxis: dims.up_axis,
          }
        });
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load model from saved history.");
    } finally {
      setLoadingModel(false);
    }
  }, [sessions, detectModelDimensions, token, selectedPolygon]);

  const applyModelPlacement = useCallback((next: {
    offsetX?: number;
    offsetY?: number;
    scale?: number;
    rotation?: number;
    rotationX?: number;
    rotationY?: number;
    rotationZ?: number;
    widthM?: number;
    depthM?: number;
  }) => {
    if (!selectedPolygon || !modelDimensions) return;

    const offsetX = next.offsetX ?? modelOffsetXM;
    const offsetY = next.offsetY ?? modelOffsetYM;
    const scale = next.scale ?? modelScale;
    const rotation = next.rotationZ ?? next.rotation ?? rotationDeg;
    const rotationX = next.rotationX ?? rotationXDeg;
    const rotationY = next.rotationY ?? rotationYDeg;
    const center = offsetLonLat(selectedPolygon.centroid, offsetX, offsetY);

    mapRef.current?.updateModelTransform({
      center,
      rotationX,
      rotationY,
      rotationZ: rotation,
      scale,
      widthM: modelDimensions.width_m * scale,
      depthM: modelDimensions.depth_m * scale,
    });
  }, [modelDimensions, modelOffsetXM, modelOffsetYM, modelScale, rotationDeg, rotationXDeg, rotationYDeg, selectedPolygon]);

  const handleLoadBackendTestModel = useCallback(() => {
    if (!selectedPolygon) return;

    setModelFileName("Backend diagnostic GLB");
    setModelDimensions(BACKEND_TEST_MODEL_DIMS);
    setCurrentGlbUrl(BACKEND_TEST_MODEL_URL);
    setSelectedSession(null);
    setRotationXDeg(0);
    setRotationYDeg(0);
    setRotationDeg(0);
    setModelOffsetXM(0);
    setModelOffsetYM(0);
    setModelScale(1);
    setFitResult(null);
    setValidationSnapshotId(null);
    setReportSummary(null);

    mapRef.current?.dispatchMapEvent({
      type: "loadModel",
      payload: {
        glbUrl: BACKEND_TEST_MODEL_URL,
        center: selectedPolygon.centroid,
        rotation: 0,
        scale: 1,
        modelWidthM: BACKEND_TEST_MODEL_DIMS.width_m,
        modelDepthM: BACKEND_TEST_MODEL_DIMS.depth_m,
        upAxis: BACKEND_TEST_MODEL_DIMS.up_axis,
      },
    });
  }, [selectedPolygon]);

  const handleValidateFit = useCallback(async () => {
    const landFeature = selectedPolygon?.geojson ?? null;
    if (!landFeature || !modelDimensions || validatingFit) return;
    const effectiveDimensions = {
      width_m: modelDimensions.width_m * modelScale,
      depth_m: modelDimensions.depth_m * modelScale,
      height_m: modelDimensions.height_m * modelScale,
    };

    setValidatingFit(true);
    try {
      const res = await fetch(`${GIS_BACKEND}/api/gis/validate-fit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          land_geojson: landFeature,
          model_dimensions: effectiveDimensions,
          rotation_deg: rotationDeg,
          optimize_rotation: true,
          road_warning_distance_m: roadWarningDistanceM,
          nearby_building_distance_m: nearbyBuildingDistanceM,
          area_unit: "sqm",
          placement_offset_x_m: modelOffsetXM,
          placement_offset_y_m: modelOffsetYM,
        }),
      });
      if (!res.ok) {
        throw new Error(`Fit validation failed (${res.status})`);
      }

      const data = (await res.json()) as FitValidationResult;
      setFitResult(data);
      setValidationSnapshotId(null);
      setReportSummary(null);
      mapRef.current?.dispatchMapEvent({
        type: "showFitValidation",
        payload: {
          insideGeometry: data.inside_geometry ?? null,
          overflowGeometry: data.overflow_geometry ?? null,
          fitStatus: data.fit_status,
        },
      });
    } catch {
      setFitResult(null);
      mapRef.current?.dispatchMapEvent({ type: "clearFitValidation", payload: { clear: true } });
    } finally {
      setValidatingFit(false);
    }
  }, [selectedPolygon, modelDimensions, modelScale, rotationDeg, roadWarningDistanceM, nearbyBuildingDistanceM, modelOffsetXM, modelOffsetYM, validatingFit]);



  const handleGenerateReport = useCallback(async () => {
    let workflowState = selectedSession?.workflowState || "draft";
    let effectiveSnapshotId = validationSnapshotId || selectedSession?.currentValidationSnapshotId || null;
    
    if (!token || !selectedSession || generatingReport) return;

    setGeneratingReport(true);
    try {
      if (workflowState !== "land_validated" && workflowState !== "report_generated") {
        if (!selectedPolygon || !modelDimensions || !fitResult) {
            alert("Please validate the land placement first.");
            setGeneratingReport(false);
            return;
        }

        const compRes = await fetch("/api/contractor/workflow/gis-completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              sessionId: selectedSession.id,
              ifcVersionNumber: selectedSession.currentVersionNumber,
              parcelGeojson: selectedPolygon.geojson,
              parcelSummary: {
                areaSqm: selectedPolygon.areaSqm,
                centroid: selectedPolygon.centroid,
              },
              modelDimensions,
              rotationDeg,
              roadWarningDistanceM,
              fitResult,
            }),
          });
          const compData = await compRes.json();
          if (!compRes.ok) throw new Error(compData?.error || "Could not save validation state");
          
          effectiveSnapshotId = compData.validationSnapshot.id;
          setValidationSnapshotId(effectiveSnapshotId);
          workflowState = compData.workflow.state;
      }

      const res = await fetch("/api/contractor/workflow/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: selectedSession.id,
          validationSnapshotId: effectiveSnapshotId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not generate report");

      const payload = data.report.payload;
      setReportSummary({
        id: data.report.id,
        versionNumber: data.report.versionNumber,
        elementCounts: payload.elementCounts || {},
        estimatedDurationDays: payload.timeEstimate?.estimatedDurationDays || 0,
        workerMix: payload.recommendedWorkerMix || [],
      });
      setSelectedSession((prev) =>
        prev
          ? {
              ...prev,
              workflowState: data.workflow.state,
              currentReportId: data.report.id,
              currentValidationSnapshotId: effectiveSnapshotId,
            }
          : prev
      );
      router.push(`/gis-land-selection/report/${selectedSession.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not generate report");
    } finally {
      setGeneratingReport(false);
    }
  }, [token, selectedSession, validationSnapshotId, generatingReport, router, selectedPolygon, modelDimensions, fitResult, rotationDeg, roadWarningDistanceM]);

  return (
    <div className="flex flex-col h-screen bg-[#080b12] overflow-hidden">
      {/* ── Top Nav ──────────────────────────────────────────────────── */}
      <header className="flex-none h-12 flex items-center justify-between px-4 border-b border-white/8 bg-[#0a0d14]/95 backdrop-blur-md z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <Globe2 className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-white">GIS Land Selection</span>
          <ChevronRight className="w-3.5 h-3.5 text-white/20" />
          <span className="text-xs text-white/40">Spatial Intelligence Agent · India</span>
        </div>

          {selectedPolygon && (
            <button
              onClick={handleSaveSelection}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                         bg-indigo-500/15 border border-indigo-500/30 text-indigo-400
                         hover:bg-indigo-500/25 transition-all duration-150"
            >
              <Lock className="w-3.5 h-3.5" />
              Save Selection
            </button>
          )}
          {(lockedParcel || selectedPolygon) && (
            <button
              id="gis-export-btn"
              onClick={handleExport}
              title="Export as GeoJSON"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                         bg-emerald-500/15 border border-emerald-500/30 text-emerald-400
                         hover:bg-emerald-500/25 transition-all duration-150"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          )}
          {(suggestions.length > 0 || parcels.length > 0) && (
            <button
              id="gis-clear-btn"
              onClick={handleClear}
              title="Clear all overlays"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                         bg-white/5 border border-white/10 text-white/50
                         hover:bg-white/10 hover:text-white/80 transition-all duration-150"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
      </header>

      {/* ── Main area ────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Map (fills remaining space) ─────────────────────────── */}
        <div className="relative flex-1 min-w-0">
          <GisMap
            ref={mapRef}
            onPolygonChange={handlePolygonChange}
            onModelRotationChange={(nextRotation) => {
              setRotationDeg(nextRotation);
              setFitResult(null);
              setValidationSnapshotId(null);
              setReportSummary(null);
            }}
            className="absolute inset-0 rounded-none"
          />

          {/* Map overlay: legend */}
          <div className="absolute bottom-10 left-4 z-10 bg-[#0a0d14]/85 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2.5 text-[11px] text-white/50 space-y-1.5 pointer-events-none">
            <p className="font-semibold text-white/70 mb-1">Confidence</p>
            {[
              { label: "High (≥ 65%)", color: "bg-emerald-500" },
              { label: "Medium (40–65%)", color: "bg-amber-500" },
              { label: "Low (< 40%)", color: "bg-red-500" },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-sm ${color} opacity-70`} />
                {label}
              </div>
            ))}
            {lockedParcel && (
              <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                <span className="w-3 h-3 rounded-sm bg-indigo-500 opacity-80" />
                Selected parcel
              </div>
            )}
          </div>

          {/* Floating suggestion count badge */}
          {suggestions.length > 0 && !showSuggestionsPanel && (
            <button
              onClick={() => { setShowSuggestionsPanel(true); setRightPanel("parcels"); }}
              className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-[#0a0d14]/90 border border-indigo-500/30
                         rounded-xl px-3 py-2 text-sm text-indigo-300 hover:bg-indigo-500/10 transition-all"
            >
              <Layers2 className="w-4 h-4" />
              {suggestions.length} suggestions found
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* ── Right sidebar ────────────────────────────────────────── */}
        <aside className="flex-none w-80 flex flex-col border-l border-white/8 bg-[#0a0d14] min-h-0 overflow-hidden">
          <div className="flex-none border-b border-white/8 p-3 space-y-2.5 max-h-[36dvh] overflow-y-auto">
            <p className="text-[11px] uppercase tracking-wide text-white/35 font-semibold">Model Fit Validation</p>
            <div className="flex items-center gap-2">
              <select
                suppressHydrationWarning
                style={{ colorScheme: "dark" }}
                className="flex-1 text-[11px] px-2 py-2 rounded-lg border border-white/12 bg-[#0a0d14] text-white/70 hover:bg-white/5 transition-colors disabled:opacity-40"
                onChange={handleModelSelect}
                disabled={!selectedPolygon || fetchingSessions || loadingModel}
                value={selectedSession?.id || ""}
              >
                <option value="" className="bg-[#0a0d14] text-white">Select saved 3D model...</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id} className="bg-[#0a0d14] text-white">{s.title}</option>
                ))}
              </select>
              <button
                onClick={handleValidateFit}
                disabled={!selectedPolygon || !modelDimensions || validatingFit}
                className="text-xs px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/35 text-emerald-300 disabled:opacity-40"
              >
                {validatingFit ? "Validating..." : "Validate"}
              </button>
            </div>
            {!selectedPolygon && (
              <p className="text-[10px] text-amber-400/80 mt-1">
                Please select or draw a land parcel first to load a model.
              </p>
            )}

            {modelFileName && modelDimensions && (
              <button
                onClick={() => {
                  if (selectedPolygon) {
                    mapRef.current?.dispatchMapEvent({
                      type: "flyTo",
                      payload: { center: selectedPolygon.centroid, zoom: 16 }
                    });
                  }
                }}
                title="Click to view model location on map"
                className="w-full text-left text-[11px] text-white/55 bg-white/5 border border-white/10 rounded-lg p-2.5 space-y-1 hover:bg-white/10 hover:border-indigo-500/30 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <p className="text-white/75 truncate font-medium group-hover:text-indigo-400 transition-colors">
                    {modelFileName}
                  </p>
                  <MapPin className="w-3 h-3 text-white/30 group-hover:text-indigo-400 transition-colors" />
                </div>
                <p>
                  {modelDimensions.width_m.toFixed(1)}m x {modelDimensions.depth_m.toFixed(1)}m x {modelDimensions.height_m.toFixed(1)}m
                  <span className="text-white/35"> ({modelDimensions.up_axis.toUpperCase()}-up detected)</span>
                </p>
                <p className="text-[9px] text-indigo-400/60 font-semibold uppercase tracking-wider mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   Click to focus on map
                </p>
              </button>
            )}

            <div className="bg-white/5 border border-white/10 rounded-lg p-2">
              <p className="text-[10px] uppercase tracking-wide text-white/35 mb-2">Rotation X / Y / Z</p>
              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1">
                  <span className="text-[10px] text-white/35">X°</span>
                  <input
                    type="number"
                    value={rotationXDeg}
                    onChange={(e) => {
                      const val = Number(e.target.value || 0);
                      setRotationXDeg(val);
                      setFitResult(null);
                      setValidationSnapshotId(null);
                      setReportSummary(null);
                      applyModelPlacement({ rotationX: val });
                    }}
                    className="w-full bg-[#111827] border border-white/10 rounded px-2 py-1 text-[11px] text-white/75"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] text-white/35">Y°</span>
                  <input
                    type="number"
                    value={rotationYDeg}
                    onChange={(e) => {
                      const val = Number(e.target.value || 0);
                      setRotationYDeg(val);
                      setFitResult(null);
                      setValidationSnapshotId(null);
                      setReportSummary(null);
                      applyModelPlacement({ rotationY: val });
                    }}
                    className="w-full bg-[#111827] border border-white/10 rounded px-2 py-1 text-[11px] text-white/75"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] text-white/35">Z°</span>
                  <input
                    type="number"
                    min={0}
                    max={360}
                    value={rotationDeg}
                    onChange={(e) => {
                      const val = Number(e.target.value || 0);
                      setRotationDeg(val);
                      setFitResult(null);
                      setValidationSnapshotId(null);
                      setReportSummary(null);
                      applyModelPlacement({ rotationZ: val });
                    }}
                    className="w-full bg-[#111827] border border-white/10 rounded px-2 py-1 text-[11px] text-white/75"
                  />
                </label>
              </div>
            </div>

            {modelFileName && modelDimensions && selectedPolygon && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-2 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-wide text-white/35 font-semibold">Model Placement</p>
                  <button
                    onClick={() => {
                      setModelOffsetXM(0);
                      setModelOffsetYM(0);
                      setModelScale(1);
                      setRotationXDeg(0);
                      setRotationYDeg(0);
                      setRotationDeg(0);
                      setFitResult(null);
                      setValidationSnapshotId(null);
                      setReportSummary(null);
                      applyModelPlacement({
                        offsetX: 0,
                        offsetY: 0,
                        scale: 1,
                        rotationX: 0,
                        rotationY: 0,
                        rotationZ: 0,
                      });
                    }}
                    className="text-[10px] text-white/45 hover:text-white/80"
                  >
                    Reset
                  </button>
                </div>
                <p className="text-[10px] text-white/45">Drag model to rotate. Hold Shift and drag to move.</p>
                <div className="grid grid-cols-3 gap-2">
                  <label className="space-y-1">
                    <span className="text-[10px] text-white/35">X m</span>
                    <input
                      type="number"
                      value={modelOffsetXM}
                      onChange={(e) => {
                        const val = Number(e.target.value || 0);
                        setModelOffsetXM(val);
                        setFitResult(null);
                        setValidationSnapshotId(null);
                        setReportSummary(null);
                        applyModelPlacement({ offsetX: val });
                      }}
                      className="w-full bg-[#111827] border border-white/10 rounded px-2 py-1 text-[11px] text-white/75"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-white/35">Y m</span>
                    <input
                      type="number"
                      value={modelOffsetYM}
                      onChange={(e) => {
                        const val = Number(e.target.value || 0);
                        setModelOffsetYM(val);
                        setFitResult(null);
                        setValidationSnapshotId(null);
                        setReportSummary(null);
                        applyModelPlacement({ offsetY: val });
                      }}
                      className="w-full bg-[#111827] border border-white/10 rounded px-2 py-1 text-[11px] text-white/75"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-white/35">Scale</span>
                    <input
                      type="number"
                      min={0.05}
                      step={0.05}
                      value={modelScale}
                      onChange={(e) => {
                        const val = Math.max(0.05, Number(e.target.value || 1));
                        setModelScale(val);
                        setFitResult(null);
                        setValidationSnapshotId(null);
                        setReportSummary(null);
                        applyModelPlacement({
                          scale: val,
                          widthM: modelDimensions.width_m * val,
                          depthM: modelDimensions.depth_m * val,
                        });
                      }}
                      className="w-full bg-[#111827] border border-white/10 rounded px-2 py-1 text-[11px] text-white/75"
                    />
                  </label>
                </div>
              </div>
            )}

            {fitResult && (
              <div className={`rounded-lg p-2.5 border ${
                fitResult.has_building_collision || fitResult.has_water_collision ? "bg-red-500/10 border-red-500/30" :
                fitResult.fit_status === "valid"
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : fitResult.fit_status === "partial"
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-red-500/10 border-red-500/30"
              }`}>
                <div className="flex items-center gap-2 text-xs mb-1.5">
                  {fitResult.has_building_collision || fitResult.has_water_collision ? (
                     <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  ) : fitResult.fit_status === "valid" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                  )}
                  <span className="text-white/85 font-semibold uppercase">
                    {fitResult.has_building_collision || fitResult.has_water_collision ? "Collision Detected" : fitResult.fit_status}
                  </span>
                  <span className="ml-auto text-white/70">Fit: {fitResult.fit_score.toFixed(1)}%</span>
                </div>
                <div className="text-[11px] text-white/70 grid grid-cols-2 gap-x-3 gap-y-1">
                  <span>Land: {fitResult.land_area_sqm.toLocaleString()} sqm</span>
                  <span className={fitResult.has_building_collision || fitResult.has_water_collision ? "text-red-400 font-bold" : ""}>
                    Footprint: {fitResult.model_footprint_area_sqm.toLocaleString()} sqm
                  </span>
                  <span>Utilization: {fitResult.utilization_ratio.toFixed(1)}%</span>
                  <span>Suggested rot: {fitResult.suggested_rotation_deg.toFixed(1)}°</span>
                  <span>Overflow: {fitResult.overflow_area_sqm.toFixed(1)} sqm</span>
                  <span className={fitResult.has_building_collision ? "text-red-400 col-span-2 mt-1 font-medium bg-red-500/10 p-1 rounded" : "hidden"}>
                    ⛔ Overlaps with existing building
                  </span>
                  <span className={fitResult.has_water_collision ? "text-red-400 col-span-2 mt-1 font-medium bg-red-500/10 p-1 rounded" : "hidden"}>
                    ⛔ Overlaps with water body
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
                   {fitResult.messages.map((m, i) => (
                     <p key={i} className={`text-[10px] leading-snug ${m.includes('⛔') || m.includes('CRITICAL') ? 'text-red-400' : 'text-white/50'}`}>
                       {m}
                     </p>
                   ))}
                </div>
              </div>
            )}

            {fitResult?.fit_status === "valid" && (
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={handleGenerateReport}
                    disabled={generatingReport || !selectedSession}
                  className="text-xs px-3 py-2.5 rounded-lg bg-cyan-500/20 border border-cyan-500/35 text-cyan-200 disabled:opacity-40 hover:bg-cyan-500/30 transition-all font-medium uppercase tracking-wide"
                >
                  {generatingReport ? "Generating..." : "Generate Report"}
                </button>
              </div>
            )}

            {reportSummary && (
              <div className="rounded-lg p-2.5 border border-cyan-500/25 bg-cyan-500/10 text-[11px] text-white/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-cyan-200 font-semibold">Report v{reportSummary.versionNumber}</span>
                  <span>{reportSummary.estimatedDurationDays} days</span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(reportSummary.elementCounts).slice(0, 6).map(([type, count]) => (
                    <span key={type}>{type}: {count}</span>
                  ))}
                </div>
                <p className="text-white/50">
                  Workers: {reportSummary.workerMix.map((w) => `${w.role} ${w.count}`).join(", ") || "TBD"}
                </p>
              </div>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex-none flex border-b border-white/8">
            <button
              suppressHydrationWarning
              id="gis-tab-chat"
              onClick={() => setRightPanel("chat")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all duration-150 border-b-2 ${
                rightPanel === "chat"
                  ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                  : "border-transparent text-white/30 hover:text-white/60"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Agent Chat
            </button>
            <button
              suppressHydrationWarning
              id="gis-tab-parcels"
              onClick={() => setRightPanel("parcels")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all duration-150 border-b-2 relative ${
                rightPanel === "parcels"
                  ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                  : "border-transparent text-white/30 hover:text-white/60"
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              Parcels
              {suggestions.length + parcels.length > 0 && (
                <span className="absolute top-1.5 right-3 w-4 h-4 rounded-full bg-indigo-600 text-[9px] text-white font-bold flex items-center justify-center">
                  {suggestions.length + parcels.length}
                </span>
              )}
            </button>
          </div>

          {/* Panel body */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {rightPanel === "chat" ? (
              <GisChat
                onMapEvent={handleMapEvent}
                selectedPolygonInfo={
                  selectedPolygon
                    ? { areaSqm: selectedPolygon.areaSqm, centroid: selectedPolygon.centroid }
                    : null
                }
              />
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto">
                {suggestions.length === 0 && parcels.length === 0 ? (
                  <div className="p-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                      <Map className="w-6 h-6 text-white/20" />
                    </div>
                    <p className="text-sm text-white/30">No suggestions or parcels yet.</p>
                    <p className="text-xs text-white/20">
                      Ask the agent or draw a polygon on the map to save it.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 space-y-4">
                    {/* Saved Parcels Section */}
                    {parcels.length > 0 && (
                      <div className="space-y-2">
                        <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-indigo-400/70">Saved Parcels</p>
                        {parcels.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => mapRef.current?.dispatchMapEvent({ type: "flyTo", payload: { center: p.centroid, zoom: 16 } })}
                            className="group relative p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/8 transition-all cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs font-semibold text-white/90">{p.name}</p>
                                <p className="text-[10px] text-white/40 mt-0.5">{(p.area / 10000).toFixed(2)} ha · Saved</p>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteParcel(p.id); }}
                                className="opacity-0 group-hover:opacity-100 p-1.5 text-white/30 hover:text-red-400 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Agent Suggestions Section */}
                    {suggestions.length > 0 && (
                      <div className="space-y-2">
                        <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400/70 pt-2">Agent Suggestions</p>
                        {/* Locked parcel banner */}
                        {lockedParcel && (
                          <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2 text-xs text-indigo-300 mb-1">
                            <Lock className="w-3.5 h-3.5" />
                            Parcel #{suggestions.findIndex((s) => s.id === lockedParcel.id) + 1} selected
                            <button
                              onClick={() => setLockedParcel(null)}
                              className="ml-auto text-indigo-400/60 hover:text-indigo-300 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        )}

                        {suggestions.map((item, idx) => (
                          <ParcelCard
                            key={`${item.id || item.centroid?.join(",") || "parcel"}-${idx}`}
                            item={item}
                            rank={idx + 1}
                            isLocked={lockedParcel?.id === item.id}
                            onLock={handleLockParcel}
                            onFlyTo={handleFlyTo}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
