"use client";

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import MapboxDraw from "maplibre-gl-draw";
import "maplibre-gl-draw/dist/mapbox-gl-draw.css";
import area from "@turf/area";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { MapEvent, SuggestionItem, BBox } from "./types";

// ── Confidence colours ────────────────────────────────────────────────────
const CONFIDENCE_COLORS: Record<string, string> = {
  high: "#22c55e",
  medium: "#f59e0b",
  low: "#ef4444",
};

const INDIA_CENTER: [number, number] = [78.9629, 20.5937];
const INDIA_BOUNDS: maplibregl.LngLatBoundsLike = [68.0, 6.0, 97.5, 37.5];
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";

const MAP_STYLES = {
  hybrid: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`,
  streets: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
  satellite: `https://api.maptiler.com/maps/satellite/style.json?key=${MAPTILER_KEY}`,
};
type MapStyleKey = keyof typeof MAP_STYLES;

function toPolygonFeature(input: GeoJSON.Feature | GeoJSON.Geometry | GeoJSON.FeatureCollection | null | undefined): GeoJSON.Feature | null {
  if (!input) return null;

  if (input.type === "FeatureCollection") {
    const polygonFeature = input.features.find((feature) =>
      feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon"
    );
    return polygonFeature ?? null;
  }

  if (input.type === "Feature") {
    if (input.geometry?.type === "Polygon" || input.geometry?.type === "MultiPolygon") {
      return input;
    }
    return null;
  }

  if (input.type === "Polygon" || input.type === "MultiPolygon") {
    return { type: "Feature", properties: {}, geometry: input };
  }

  return null;
}

const DRAW_STYLES = [
  {
    id: "gl-draw-polygon-fill-inactive",
    type: "fill",
    filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
    paint: {
      "fill-color": "#3b82f6",
      "fill-opacity": 0.15,
    },
  },
  {
    id: "gl-draw-polygon-fill-active",
    type: "fill",
    filter: ["all", ["==", "$type", "Polygon"], ["==", "active", "true"]],
    paint: {
      "fill-color": "#6366f1",
      "fill-opacity": 0.2,
    },
  },
  {
    id: "gl-draw-polygon-stroke-inactive",
    type: "line",
    filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
    paint: {
      "line-color": "#60a5fa",
      "line-width": 2,
    },
  },
  {
    id: "gl-draw-polygon-stroke-active",
    type: "line",
    filter: ["all", ["==", "$type", "Polygon"], ["==", "active", "true"]],
    paint: {
      "line-color": "#818cf8",
      "line-width": 2.5,
    },
  },
  {
    id: "gl-draw-line-inactive",
    type: "line",
    filter: ["all", ["==", "$type", "LineString"], ["!=", "mode", "static"]],
    paint: {
      "line-color": "#60a5fa",
      "line-width": 2,
    },
  },
  {
    id: "gl-draw-line-active",
    type: "line",
    filter: ["all", ["==", "$type", "LineString"], ["==", "active", "true"]],
    paint: {
      "line-color": "#818cf8",
      "line-width": 2.5,
    },
  },
  {
    id: "gl-draw-point-inactive",
    type: "circle",
    filter: ["all", ["==", "$type", "Point"], ["==", "meta", "feature"], ["!=", "mode", "static"]],
    paint: {
      "circle-radius": 4,
      "circle-color": "#93c5fd",
    },
  },
  {
    id: "gl-draw-point-active",
    type: "circle",
    filter: ["all", ["==", "$type", "Point"], ["==", "meta", "feature"], ["==", "active", "true"]],
    paint: {
      "circle-radius": 5,
      "circle-color": "#c4b5fd",
    },
  },
  {
    id: "gl-draw-vertex-halo-active",
    type: "circle",
    filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["!=", "mode", "static"]],
    paint: {
      "circle-radius": 8,
      "circle-color": "#ffffff",
    },
  },
  {
    id: "gl-draw-vertex-active",
    type: "circle",
    filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["!=", "mode", "static"]],
    paint: {
      "circle-radius": 4,
      "circle-color": "#4f46e5",
    },
  },
] as const;

export interface GisMapHandle {
  dispatchMapEvent: (event: MapEvent) => void;
  getSelectedPolygon: () => GeoJSON.Feature | null;
  clearSuggestions: () => void;
  updateModelTransform: (transform: {
    center?: [number, number];
    rotation?: number;
    rotationX?: number;
    rotationY?: number;
    rotationZ?: number;
    scale?: number;
    widthM?: number;
    depthM?: number;
  }) => void;
}

interface GisMapProps {
  onPolygonChange?: (feature: GeoJSON.Feature | null) => void;
  onModelRotationChange?: (rotationDeg: number) => void;
  className?: string;
}

const GisMap = forwardRef<GisMapHandle, GisMapProps>(function GisMap(
  { onPolygonChange, onModelRotationChange, className = "" },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const selectedPolygonRef = useRef<GeoJSON.Feature | null>(null);
  const suggestionsRef = useRef<SuggestionItem[]>([]);
  const drawingRef = useRef<boolean>(false);
  const drawPointsRef = useRef<[number, number][]>([]);
  const popupsRef = useRef<maplibregl.Popup[]>([]);
  const drawRef = useRef<MapboxDraw | null>(null);
  const fitInsideRef = useRef<GeoJSON.Geometry | null>(null);
  const fitOverflowRef = useRef<GeoJSON.Geometry | null>(null);
  const threeLayerRef = useRef<any>(null);
  const modelTransformRef = useRef<{
    translateX: number;
    translateY: number;
    translateZ: number;
    rotateX: number;
    rotateY: number;
    rotateZ: number;
    scale: number;
  } | null>(null);
  const modelSceneRef = useRef<THREE.Scene | null>(null);
  const modelCameraRef = useRef<THREE.Camera | null>(null);
  const modelRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelUrlRef = useRef<string | null>(null);
  const modelPlacementRef = useRef<{
    center: [number, number];
    rotationDeg: number;
    widthM: number;
    depthM: number;
    scale: number;
  } | null>(null);
  const modelInteractionRef = useRef({
    selected: false,
    dragging: false,
    lastX: 0,
    lastY: 0,
  });
  const renderFrameCountRef = useRef(0);
  const modelLoadCompleteRef = useRef(false);

  const [currentStyle, setCurrentStyle] = useState<MapStyleKey>("hybrid");
  const [polygonArea, setPolygonArea] = useState<number | null>(null);
  const [modelSelected, setModelSelected] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [modelDebug, setModelDebug] = useState<{
    visible: boolean;
    url: string;
    stage: string;
    error?: string;
    fetchedBytes?: number;
    meshCount?: number;
    childCount?: number;
    bounds?: string;
    matrixSource?: string;
    renderFrames: number;
    contextLost: boolean;
    layerPresent: boolean;
  }>({
    visible: false,
    url: "",
    stage: "idle",
    renderFrames: 0,
    contextLost: false,
    layerPresent: false,
  });

  const updateModelDebug = useCallback((patch: Partial<typeof modelDebug>) => {
    setModelDebug((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleStyleChange = useCallback((newStyle: MapStyleKey) => {
    setCurrentStyle(newStyle);
    if (mapRef.current) {
      mapRef.current.setStyle(MAP_STYLES[newStyle]);
    }
  }, []);

  // ── Init map ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`,
      center: INDIA_CENTER,
      zoom: 5,
      pitch: 30,
      bearing: 0,
      maxBounds: INDIA_BOUNDS,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right"
    );

    const canvas = map.getCanvas();
    const onContextLost = (event: Event) => {
      event.preventDefault();
      updateModelDebug({
        visible: true,
        stage: "webgl-context-lost",
        contextLost: true,
        error: "Map canvas WebGL context was lost.",
      });
    };
    const onContextRestored = () => {
      updateModelDebug({
        stage: "webgl-context-restored",
        contextLost: false,
        error: undefined,
      });
      map.triggerRepaint();
    };
    canvas.addEventListener("webglcontextlost", onContextLost, false);
    canvas.addEventListener("webglcontextrestored", onContextRestored, false);

    // mapbox-gl-draw
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
      styles: DRAW_STYLES as unknown as object[],
    });
    map.addControl(draw as any, "top-left");
    drawRef.current = draw;

    const updateArea = () => {
      const data = draw.getAll();
      if (data.features.length > 0) {
        // We only care about the latest drawn polygon
        const feature = data.features[0];
        const sqMeters = area(feature);
        setPolygonArea(sqMeters);
        setSelectedPolygon(feature as GeoJSON.Feature);
      } else {
        setPolygonArea(null);
        setSelectedPolygon(null);
      }
    };

    map.on("draw.create", updateArea);
    map.on("draw.update", updateArea);
    map.on("draw.delete", updateArea);

    const setupLayers = () => {
      // ── Sources ──
      if (!map.getSource("selected-polygon")) {
        map.addSource("selected-polygon", {
          type: "geojson",
          data: { type: "FeatureCollection", features: selectedPolygonRef.current ? [selectedPolygonRef.current] : [] },
        });
      }
      if (!map.getSource("suggestions")) {
        const features = suggestionsRef.current.map((c) => ({
          type: "Feature" as const,
          geometry: c.geometry,
          properties: {
            ...c,
            reasons: JSON.stringify(c.reasons),
            color: CONFIDENCE_COLORS[c.confidence_label] ?? "#6b7280",
          },
        }));
        map.addSource("suggestions", {
          type: "geojson",
          data: { type: "FeatureCollection", features },
        });
      }
      if (!map.getSource("fit-inside")) {
        map.addSource("fit-inside", {
          type: "geojson",
          data: fitInsideRef.current
            ? { type: "FeatureCollection", features: [{ type: "Feature", geometry: fitInsideRef.current, properties: {} }] }
            : { type: "FeatureCollection", features: [] },
        });
      }
      if (!map.getSource("fit-overflow")) {
        map.addSource("fit-overflow", {
          type: "geojson",
          data: fitOverflowRef.current
            ? { type: "FeatureCollection", features: [{ type: "Feature", geometry: fitOverflowRef.current, properties: {} }] }
            : { type: "FeatureCollection", features: [] },
        });
      }

      // ── Suggestion fills ──
      if (!map.getLayer("suggestions-fill")) {
        map.addLayer({
          id: "suggestions-fill",
          type: "fill",
          source: "suggestions",
          filter: ["==", "is_marker", false],
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0.28,
          },
        });
      }
      if (!map.getLayer("suggestions-outline")) {
        map.addLayer({
          id: "suggestions-outline",
          type: "line",
          source: "suggestions",
          filter: ["==", "is_marker", false],
          paint: {
            "line-color": ["get", "color"],
            "line-width": 2,
            "line-dasharray": [2, 1],
          },
        });
      }

      // ── Selected polygon ──
      if (!map.getLayer("selected-fill")) {
        map.addLayer({
          id: "selected-fill",
          type: "fill",
          source: "selected-polygon",
          paint: {
            "fill-color": "#6366f1",
            "fill-opacity": 0.25,
          },
        });
      }
      if (!map.getLayer("selected-outline")) {
        map.addLayer({
          id: "selected-outline",
          type: "line",
          source: "selected-polygon",
          paint: {
            "line-color": "#818cf8",
            "line-width": 2.5,
          },
        });
      }
      if (!map.getLayer("fit-inside-fill")) {
        map.addLayer({
          id: "fit-inside-fill",
          type: "fill",
          source: "fit-inside",
          paint: {
            "fill-color": "#22c55e",
            "fill-opacity": 0.3,
          },
        });
      }
      if (!map.getLayer("fit-inside-outline")) {
        map.addLayer({
          id: "fit-inside-outline",
          type: "line",
          source: "fit-inside",
          paint: {
            "line-color": "#16a34a",
            "line-width": 2,
          },
        });
      }
      if (!map.getLayer("fit-overflow-fill")) {
        map.addLayer({
          id: "fit-overflow-fill",
          type: "fill",
          source: "fit-overflow",
          paint: {
            "fill-color": "#ef4444",
            "fill-opacity": 0.4,
          },
        });
      }
      if (!map.getLayer("fit-overflow-outline")) {
        map.addLayer({
          id: "fit-overflow-outline",
          type: "line",
          source: "fit-overflow",
          paint: {
            "line-color": "#dc2626",
            "line-width": 2,
            "line-dasharray": [1.5, 1],
          },
        });
      }

      if (!map.getLayer("suggestions-marker-bg")) {
        map.addLayer({
          id: "suggestions-marker-bg",
          type: "circle",
          source: "suggestions",
          filter: ["==", "is_marker", true],
          paint: {
            "circle-radius": 10,
            "circle-color": ["get", "color"],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
      }

      if (!map.getLayer("suggestions-marker-text")) {
        map.addLayer({
          id: "suggestions-marker-text",
          type: "symbol",
          source: "suggestions",
          filter: ["==", "is_marker", true],
          layout: {
            "text-field": ["get", "rank"],
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-size": 10,
            "text-allow-overlap": true,
          },
          paint: {
            "text-color": "#ffffff",
          },
        });
      }
    };

    map.on("load", setupLayers);
    map.on("style.load", setupLayers);

    // Click suggestions to show popup
    map.on("click", "suggestions-fill", (e) => {
      const feat = e.features?.[0];
      if (!feat) return;
      const props = feat.properties as Record<string, unknown>;
      const score = Number(props.score ?? 0);
      const reasons = JSON.parse((props.reasons as string) ?? "[]") as string[];
      const areaSqm = Number(props.area_sqm ?? 0);
      const label = props.confidence_label as string;

      const popup = new maplibregl.Popup({ maxWidth: "260px", closeButton: true })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="font-family:Inter,sans-serif;padding:4px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span style="background:${CONFIDENCE_COLORS[label] ?? "#6b7280"};color:#fff;
                border-radius:9999px;padding:2px 10px;font-size:12px;font-weight:600">
                ${label.toUpperCase()} · ${(score * 100).toFixed(0)}%
              </span>
              <span style="color:#9ca3af;font-size:12px">${(areaSqm / 10000).toFixed(2)} ha</span>
            </div>
            <ul style="margin:0;padding-left:16px;color:#e2e8f0;font-size:12px">
              ${reasons.map((r: string) => `<li>${r}</li>`).join("")}
            </ul>
          </div>
        `)
        .addTo(map);
      popupsRef.current.push(popup);
    });
    map.on("mouseenter", "suggestions-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "suggestions-fill", () => {
      map.getCanvas().style.cursor = "";
    });

    mapRef.current = map;
    setMapReady(true);
    return () => {
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [updateModelDebug]);

  // ── Internal helpers ────────────────────────────────────────────────────

  const clearAllPopups = useCallback(() => {
    popupsRef.current.forEach((p) => p.remove());
    popupsRef.current = [];
  }, []);

  const setSelectedPolygon = useCallback(
    (feature: GeoJSON.Feature | null) => {
      selectedPolygonRef.current = feature;
      const map = mapRef.current;
      if (!map) return;
      const src = map.getSource("selected-polygon") as maplibregl.GeoJSONSource | undefined;
      src?.setData(
        feature
          ? { type: "FeatureCollection", features: [feature] }
          : { type: "FeatureCollection", features: [] }
      );
      onPolygonChange?.(feature);
    },
    [onPolygonChange]
  );

  const setSuggestions = useCallback((candidates: SuggestionItem[]) => {
    suggestionsRef.current = candidates;
    const map = mapRef.current;
    if (!map) return;
    clearAllPopups();
    const features: any[] = [];
    candidates.forEach((c, idx) => {
      const color = CONFIDENCE_COLORS[c.confidence_label || "low"] ?? "#ef4444";
      const commonProps = {
        ...c,
        rank: idx + 1,
        reasons: JSON.stringify(c.reasons),
        color,
      };

      // Polygon feature
      features.push({
        type: "Feature",
        geometry: c.geometry,
        properties: { ...commonProps, is_marker: false },
      });

      // Marker feature
      if (c.centroid) {
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: c.centroid },
          properties: { ...commonProps, is_marker: true },
        });
      }
    });

    const src = map.getSource("suggestions") as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: "FeatureCollection", features });
  }, [clearAllPopups]);

  const setFitValidation = useCallback((insideGeometry: GeoJSON.Geometry | null, overflowGeometry: GeoJSON.Geometry | null) => {
    fitInsideRef.current = insideGeometry;
    fitOverflowRef.current = overflowGeometry;

    const map = mapRef.current;
    if (!map) return;

    const insideSource = map.getSource("fit-inside") as maplibregl.GeoJSONSource | undefined;
    insideSource?.setData(
      insideGeometry
        ? { type: "FeatureCollection", features: [{ type: "Feature", geometry: insideGeometry, properties: {} }] }
        : { type: "FeatureCollection", features: [] }
    );

    const overflowSource = map.getSource("fit-overflow") as maplibregl.GeoJSONSource | undefined;
    overflowSource?.setData(
      overflowGeometry
        ? { type: "FeatureCollection", features: [{ type: "Feature", geometry: overflowGeometry, properties: {} }] }
        : { type: "FeatureCollection", features: [] }
    );
  }, []);

  const isInsideModelFootprint = useCallback((lngLat: maplibregl.LngLatLike) => {
    const placement = modelPlacementRef.current;
    if (!placement) return false;

    const point = maplibregl.LngLat.convert(lngLat);
    const centerMercator = maplibregl.MercatorCoordinate.fromLngLat(placement.center, 0);
    const pointMercator = maplibregl.MercatorCoordinate.fromLngLat([point.lng, point.lat], 0);
    const meterUnit = centerMercator.meterInMercatorCoordinateUnits();
    if (!meterUnit || !Number.isFinite(meterUnit)) return false;

    const dxMeters = (pointMercator.x - centerMercator.x) / meterUnit;
    const dyMeters = (pointMercator.y - centerMercator.y) / meterUnit;
    const radians = (placement.rotationDeg * Math.PI) / 180;

    const localX = dxMeters * Math.cos(radians) + dyMeters * Math.sin(radians);
    const localY = -dxMeters * Math.sin(radians) + dyMeters * Math.cos(radians);

    return Math.abs(localX) <= placement.widthM / 2 && Math.abs(localY) <= placement.depthM / 2;
  }, []);

  const setModelSelectionState = useCallback((selected: boolean) => {
    modelInteractionRef.current.selected = selected;
    setModelSelected(selected);
    const map = mapRef.current;
    if (map) {
      map.getCanvas().style.cursor = selected ? "grab" : "";
    }
  }, []);

  const updateModelFootprint = useCallback(() => {
    const map = mapRef.current;
    const placement = modelPlacementRef.current;
    if (!map || !placement || !map.getSource("model-footprint")) return;

    const outlineCoords: [number, number][] = [
      [-placement.widthM / 2, -placement.depthM / 2],
      [placement.widthM / 2, -placement.depthM / 2],
      [placement.widthM / 2, placement.depthM / 2],
      [-placement.widthM / 2, placement.depthM / 2],
      [-placement.widthM / 2, -placement.depthM / 2],
    ].map(([x, y]) => {
      const radians = (placement.rotationDeg * Math.PI) / 180;
      const rotX = x * Math.cos(radians) - y * Math.sin(radians);
      const rotY = x * Math.sin(radians) + y * Math.cos(radians);
      const centerMercator = maplibregl.MercatorCoordinate.fromLngLat(placement.center, 0);
      const meterUnit = centerMercator.meterInMercatorCoordinateUnits();
      const pointMercator = new maplibregl.MercatorCoordinate(
        centerMercator.x + rotX * meterUnit,
        centerMercator.y + rotY * meterUnit,
        0
      );
      const lngLat = pointMercator.toLngLat();
      return [lngLat.lng, lngLat.lat] as [number, number];
    });

    const source = map.getSource("model-footprint") as maplibregl.GeoJSONSource | undefined;
    source?.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [outlineCoords],
          },
        },
      ],
    });
  }, []);

  const applyModelTransform = useCallback((next: {
    center?: [number, number];
    rotation?: number;
    rotationX?: number;
    rotationY?: number;
    rotationZ?: number;
    scale?: number;
    widthM?: number;
    depthM?: number;
  }) => {
    const map = mapRef.current;
    const transform = modelTransformRef.current;
    const placement = modelPlacementRef.current;
    if (!map || !transform || !placement) return;

    if (next.center) {
      placement.center = next.center;
      const mercator = maplibregl.MercatorCoordinate.fromLngLat(next.center, 0);
      transform.translateX = mercator.x;
      transform.translateY = mercator.y;
      transform.translateZ = mercator.z;
      const currentScaleFactor = placement.scale;
      transform.scale = mercator.meterInMercatorCoordinateUnits() * currentScaleFactor;
    }

    if (typeof next.rotationX === "number") {
      transform.rotateX = (Math.PI / 2) + (next.rotationX * Math.PI) / 180;
    }
    if (typeof next.rotationY === "number") {
      transform.rotateY = (next.rotationY * Math.PI) / 180;
    }
    if (typeof next.rotation === "number") {
      placement.rotationDeg = ((next.rotation % 360) + 360) % 360;
      transform.rotateZ = (placement.rotationDeg * Math.PI) / 180;
    }
    if (typeof next.rotationZ === "number") {
      placement.rotationDeg = ((next.rotationZ % 360) + 360) % 360;
      transform.rotateZ = (placement.rotationDeg * Math.PI) / 180;
    }

    if (typeof next.scale === "number") {
      placement.scale = Math.max(0.05, next.scale);
      const mercator = maplibregl.MercatorCoordinate.fromLngLat(placement.center, 0);
      transform.scale = mercator.meterInMercatorCoordinateUnits() * placement.scale;
    }

    if (typeof next.widthM === "number") {
      placement.widthM = Math.max(0.1, next.widthM);
    }
    if (typeof next.depthM === "number") {
      placement.depthM = Math.max(0.1, next.depthM);
    }

    updateModelFootprint();
    map.triggerRepaint();
  }, [updateModelFootprint]);

  const set3DModel = useCallback((glbUrl: string | null, center: [number, number], rotation: number, scale: number = 1, token?: string, modelWidthM?: number, modelDepthM?: number) => {
    const map = mapRef.current;
    if (!map) return;

    if (!glbUrl) {
      if (map.getLayer("3d-model")) {
        map.removeLayer("3d-model");
      }
      if (map.getLayer("model-footprint-fill")) {
        map.removeLayer("model-footprint-fill");
      }
      if (map.getLayer("model-footprint-outline")) {
        map.removeLayer("model-footprint-outline");
      }
      if (map.getSource("model-footprint")) {
        map.removeSource("model-footprint");
      }
      threeLayerRef.current = null;
      modelTransformRef.current = null;
      modelSceneRef.current = null;
      modelCameraRef.current = null;
      modelRendererRef.current = null;
      modelUrlRef.current = null;
      modelPlacementRef.current = null;
      renderFrameCountRef.current = 0;
      modelLoadCompleteRef.current = false;
      updateModelDebug({
        visible: false,
        url: "",
        stage: "cleared",
        error: undefined,
        fetchedBytes: undefined,
        meshCount: undefined,
        childCount: undefined,
        bounds: undefined,
        matrixSource: undefined,
        renderFrames: 0,
        contextLost: false,
        layerPresent: false,
      });
      setModelSelectionState(false);
      return;
    }

    const modelOrigin = center;
    const modelAltitude = 0;
    const modelRotate = [Math.PI / 2, 0, (rotation * Math.PI) / 180];

    const modelAsMercator = maplibregl.MercatorCoordinate.fromLngLat(
        modelOrigin,
        modelAltitude
    );

    const modelTransform = {
        translateX: modelAsMercator.x,
        translateY: modelAsMercator.y,
        translateZ: modelAsMercator.z,
        rotateX: modelRotate[0],
        rotateY: modelRotate[1],
        rotateZ: modelRotate[2],
        scale: modelAsMercator.meterInMercatorCoordinateUnits() * scale
    };

    const effectiveWidth = Math.max(2, (modelWidthM ?? 12) * scale);
    const effectiveDepth = Math.max(2, (modelDepthM ?? 8) * scale);
    modelPlacementRef.current = {
      center,
      rotationDeg: rotation,
      widthM: effectiveWidth,
      depthM: effectiveDepth,
      scale,
    };

    // Update transform-only rotation without reloading the GLB.
    if (modelUrlRef.current === glbUrl && modelTransformRef.current && threeLayerRef.current) {
      modelTransformRef.current.translateX = modelTransform.translateX;
      modelTransformRef.current.translateY = modelTransform.translateY;
      modelTransformRef.current.translateZ = modelTransform.translateZ;
      modelTransformRef.current.rotateX = modelTransform.rotateX;
      modelTransformRef.current.rotateY = modelTransform.rotateY;
      modelTransformRef.current.rotateZ = modelTransform.rotateZ;
      modelTransformRef.current.scale = modelTransform.scale;
      updateModelFootprint();
      map.triggerRepaint();
      return;
    }

    if (map.getLayer("3d-model")) {
      map.removeLayer("3d-model");
    }

    if (map.getLayer("model-footprint-fill")) {
      map.removeLayer("model-footprint-fill");
    }
    if (map.getLayer("model-footprint-outline")) {
      map.removeLayer("model-footprint-outline");
    }
    if (map.getSource("model-footprint")) {
      map.removeSource("model-footprint");
    }

    const outlineCoords: [number, number][] = [
      [-effectiveWidth / 2, -effectiveDepth / 2],
      [effectiveWidth / 2, -effectiveDepth / 2],
      [effectiveWidth / 2, effectiveDepth / 2],
      [-effectiveWidth / 2, effectiveDepth / 2],
      [-effectiveWidth / 2, -effectiveDepth / 2],
    ].map(([x, y]) => {
      const radians = (rotation * Math.PI) / 180;
      const rotX = x * Math.cos(radians) - y * Math.sin(radians);
      const rotY = x * Math.sin(radians) + y * Math.cos(radians);
      const centerMercator = maplibregl.MercatorCoordinate.fromLngLat(center, 0);
      const meterUnit = centerMercator.meterInMercatorCoordinateUnits();
      const pointMercator = new maplibregl.MercatorCoordinate(centerMercator.x + rotX * meterUnit, centerMercator.y + rotY * meterUnit, 0);
      const lngLat = pointMercator.toLngLat();
      return [lngLat.lng, lngLat.lat] as [number, number];
    });

    map.addSource("model-footprint", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [outlineCoords],
            },
          },
        ],
      },
    });
    map.addLayer({
      id: "model-footprint-fill",
      type: "fill",
      source: "model-footprint",
      paint: {
        "fill-color": modelSelected ? "#22d3ee" : "#60a5fa",
        "fill-opacity": 0.06,
      },
    });
    map.addLayer({
      id: "model-footprint-outline",
      type: "line",
      source: "model-footprint",
      paint: {
        "line-color": modelSelected ? "#22d3ee" : "#60a5fa",
        "line-width": modelSelected ? 2.3 : 1.4,
      },
    });

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    modelSceneRef.current = scene;
    modelCameraRef.current = camera;
    modelTransformRef.current = modelTransform;
    modelUrlRef.current = glbUrl;
    renderFrameCountRef.current = 0;
    modelLoadCompleteRef.current = false;
    updateModelDebug({
      visible: true,
      url: glbUrl,
      stage: "requested",
      error: undefined,
      fetchedBytes: undefined,
      meshCount: undefined,
      childCount: undefined,
      bounds: undefined,
      matrixSource: undefined,
      renderFrames: 0,
      contextLost: false,
      layerPresent: false,
    });

    // Lighting
    const directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(0, -70, 100).normalize();
    scene.add(directionalLight);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const loader = new GLTFLoader();
    if (token) {
        loader.setRequestHeader({ Authorization: `Bearer ${token}` });
    }
    loader.manager.onStart = (url) => {
      updateModelDebug({ stage: "fetching", url });
    };
    loader.manager.onProgress = (url, loaded, total) => {
      if (modelLoadCompleteRef.current) return;
      updateModelDebug({
        stage: "fetching",
        url,
        fetchedBytes: total > 0 ? total : loaded,
      });
    };
    loader.load(
        glbUrl,
        (gltf) => {
            modelLoadCompleteRef.current = true;
            const modelRoot = gltf.scene;
            let meshCount = 0;
            modelRoot.traverse((node) => {
              if ((node as THREE.Mesh).isMesh) meshCount += 1;
            });

            // MapLibre's model transform already rotates from model space into map
            // space. Normalize every GLB to the Y-up convention expected by that
            // transform. IFC-derived assets often arrive Z-up, while the backend
            // diagnostic model is already Y-up.
            const initialBox = new THREE.Box3().setFromObject(modelRoot);
            const initialSize = initialBox.getSize(new THREE.Vector3());
            if (initialSize.z > initialSize.y * 1.25) {
              modelRoot.rotation.x = Math.PI / 2;
              modelRoot.updateMatrixWorld(true);
            }

            // Normalize model pivot to center and sit on the ground plane.
            const normalizedBox = new THREE.Box3().setFromObject(modelRoot);
            const centerVec = normalizedBox.getCenter(new THREE.Vector3());
            modelRoot.position.x -= centerVec.x;
            modelRoot.position.z -= centerVec.z;
            modelRoot.position.y -= normalizedBox.min.y;

            // Match surrounding map style for a coherent city-mass look.
            modelRoot.traverse((node) => {
              if ((node as THREE.Mesh).isMesh) {
                const mesh = node as THREE.Mesh;
                mesh.castShadow = false;
                mesh.receiveShadow = false;
                mesh.frustumCulled = true;
                const materials = Array.isArray(mesh.material)
                  ? mesh.material
                  : [mesh.material];
                materials.forEach((material) => {
                  material.side = THREE.DoubleSide;
                  material.depthTest = false;
                  material.depthWrite = false;
                  material.needsUpdate = true;
                });
              }
            });

            scene.add(modelRoot);
            const finalBox = new THREE.Box3().setFromObject(modelRoot);
            const finalSize = finalBox.getSize(new THREE.Vector3());
            updateModelDebug({
              stage: "loaded-into-scene",
              error: undefined,
              meshCount,
              childCount: modelRoot.children.length,
              bounds: `${finalSize.x.toFixed(2)} x ${finalSize.y.toFixed(2)} x ${finalSize.z.toFixed(2)}`,
            });
            
            // Trigger repaint immediately so it appears without user interaction
            if (mapRef.current) {
                mapRef.current.triggerRepaint();
            }
        },
        undefined,
        (error) => {
            console.error("❌ Failed to load GLTF model:", error);
            updateModelDebug({
              stage: "load-error",
              error: error instanceof Error ? error.message : String(error),
            });
        }
    );

    let renderer: THREE.WebGLRenderer;

    const customLayer: maplibregl.CustomLayerInterface = {
        id: '3d-model',
        type: 'custom',
        renderingMode: '2d',
        onAdd: function (map, gl) {
            renderer = new THREE.WebGLRenderer({
                canvas: map.getCanvas(),
                context: gl,
                antialias: true,
                alpha: true,
            });
            renderer.autoClear = false;
            renderer.debug.checkShaderErrors = true;
          modelRendererRef.current = renderer;
          updateModelDebug({
            stage: "custom-layer-added",
            layerPresent: true,
          });
        },
        render: function (_gl, options) {
          const currentTransform = modelTransformRef.current;
          if (!currentTransform) return;
          if (!renderer) {
            updateModelDebug({
              stage: "render-without-renderer",
              error: "Custom layer render fired before Three renderer was ready.",
            });
            return;
          }
          const matrix =
            Array.isArray(options) || ArrayBuffer.isView(options)
              ? options
              : options.defaultProjectionData?.mainMatrix;
          const matrixSource =
            Array.isArray(options) || ArrayBuffer.isView(options)
              ? "legacy-array"
              : options.defaultProjectionData?.mainMatrix
                ? "defaultProjectionData.mainMatrix"
                : "missing";
          if (!matrix) {
            updateModelDebug({
              stage: "render-missing-matrix",
              matrixSource,
              error: "MapLibre did not provide a render matrix.",
            });
            return;
          }
          const m = new THREE.Matrix4().fromArray(matrix as ArrayLike<number>);
            const l = new THREE.Matrix4()
              .makeTranslation(
              currentTransform.translateX,
              currentTransform.translateY,
              currentTransform.translateZ
              )
              .scale(
                new THREE.Vector3(
                  currentTransform.scale,
                  -currentTransform.scale,
                  currentTransform.scale
                )
              )
              .multiply(new THREE.Matrix4().makeRotationX(currentTransform.rotateX))
              .multiply(new THREE.Matrix4().makeRotationY(currentTransform.rotateY))
              .multiply(new THREE.Matrix4().makeRotationZ(currentTransform.rotateZ));

            camera.projectionMatrix = m.multiply(l);
            renderer.clearDepth();
            renderer.resetState();
            renderer.state.buffers.depth.setTest(false);
            renderer.state.buffers.depth.setMask(false);
            renderer.render(scene, camera);
            renderFrameCountRef.current += 1;
            if (renderFrameCountRef.current <= 3 || renderFrameCountRef.current % 60 === 0) {
              updateModelDebug({
                stage: "rendering",
                matrixSource,
                renderFrames: renderFrameCountRef.current,
                layerPresent: Boolean(map.getLayer("3d-model")),
                contextLost: renderer.getContext().isContextLost(),
              });
            }
        }
    };

    map.addLayer(customLayer);
    threeLayerRef.current = customLayer;
    updateModelDebug({
      stage: "layer-registered",
      layerPresent: true,
    });
  }, [modelSelected, setModelSelectionState, updateModelDebug, updateModelFootprint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      if (!modelPlacementRef.current) return;
      if (!isInsideModelFootprint(e.lngLat)) {
        if (modelInteractionRef.current.selected) {
          setModelSelectionState(false);
        }
        return;
      }

      modelInteractionRef.current.selected = true;
      modelInteractionRef.current.dragging = true;
      modelInteractionRef.current.lastX = e.point.x;
      modelInteractionRef.current.lastY = e.point.y;
      setModelSelectionState(true);
      map.dragPan.disable();
      map.getCanvas().style.cursor = "grabbing";
      e.preventDefault();
    };

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      const interaction = modelInteractionRef.current;
      if (!interaction.dragging || !modelTransformRef.current || !modelPlacementRef.current) return;

      const deltaX = e.point.x - interaction.lastX;
      const deltaY = e.point.y - interaction.lastY;
      interaction.lastX = e.point.x;
      interaction.lastY = e.point.y;

      if (e.originalEvent.shiftKey) {
        const center = map.project(modelPlacementRef.current.center);
        const nextPoint = {
          x: center.x + deltaX,
          y: center.y + deltaY,
        };
        const nextCenter = map.unproject([nextPoint.x, nextPoint.y]).toArray() as [number, number];
        applyModelTransform({ center: nextCenter });
        return;
      }

      const nextRotation = ((modelPlacementRef.current.rotationDeg + deltaX * 0.45) % 360 + 360) % 360;
      applyModelTransform({ rotation: nextRotation });
      onModelRotationChange?.(Math.round(nextRotation));
    };

    const onMouseUp = () => {
      const interaction = modelInteractionRef.current;
      if (!interaction.dragging) return;
      interaction.dragging = false;
      map.dragPan.enable();
      map.getCanvas().style.cursor = interaction.selected ? "grab" : "";
    };

    map.on("mousedown", onMouseDown);
    map.on("mousemove", onMouseMove);
    map.on("mouseup", onMouseUp);
    map.on("mouseleave", onMouseUp);

    return () => {
      map.off("mousedown", onMouseDown);
      map.off("mousemove", onMouseMove);
      map.off("mouseup", onMouseUp);
      map.off("mouseleave", onMouseUp);
    };
  }, [applyModelTransform, isInsideModelFootprint, mapReady, onModelRotationChange, setModelSelectionState]);

  // ── Expose handle ────────────────────────────────────────────────────────
  useImperativeHandle(
    ref,
    () => ({
      getSelectedPolygon: () => selectedPolygonRef.current,
      clearSuggestions: () => setSuggestions([]),
      updateModelTransform: applyModelTransform,

      dispatchMapEvent: (event: MapEvent) => {
        const map = mapRef.current;
        if (!map) return;

        switch (event.type) {
          case "flyTo": {
            const p = event.payload as { center: [number, number]; zoom: number };
            map.flyTo({ center: p.center, zoom: p.zoom ?? 12, pitch: 45, duration: 2000 });
            break;
          }

          case "drawPolygon": {
            const payload = event.payload as {
              geojson?: GeoJSON.Feature | GeoJSON.Geometry;
              geometry?: GeoJSON.Feature | GeoJSON.Geometry;
              feature?: GeoJSON.Feature | GeoJSON.Geometry;
            };
            const feature = toPolygonFeature(
              (payload.geojson || payload.geometry || payload.feature) as
                | GeoJSON.Feature
                | GeoJSON.Geometry
                | GeoJSON.FeatureCollection
                | undefined
            );
            if (!feature) break;

            if (drawRef.current) {
              drawRef.current.deleteAll();
              const ids = drawRef.current.add(feature);
              if (ids.length > 0) {
                drawRef.current.changeMode("simple_select", { featureIds: ids });
              }
              
              // Update state
              const sqMeters = area(feature);
              setPolygonArea(sqMeters);
              setSelectedPolygon(feature);

              // Fit bounds
              const coords = (feature.geometry as unknown as { coordinates?: [number, number][][] }).coordinates?.[0];
              if (coords?.length) {
                const bounds = coords.reduce(
                  (b, c) => b.extend(c as maplibregl.LngLatLike),
                  new maplibregl.LngLatBounds(coords[0] as maplibregl.LngLatLike, coords[0] as maplibregl.LngLatLike)
                );
                map.fitBounds(bounds, { padding: 60, pitch: 40, maxZoom: 14, duration: 1800 });
              }
            }
            break;
          }

          case "suggestAreas": {
            const p = event.payload as { candidates: SuggestionItem[]; bbox: BBox };
            setSuggestions(p.candidates ?? []);
            if (p.bbox) {
              map.fitBounds(
                [
                  [p.bbox.min_lon, p.bbox.min_lat],
                  [p.bbox.max_lon, p.bbox.max_lat],
                ],
                { padding: 50, maxZoom: 13, duration: 1500 }
              );
            }
            break;
          }

          case "filterAreas": {
            const p = event.payload as { candidates: SuggestionItem[] };
            setSuggestions(p.candidates ?? []);
            break;
          }

          case "showFitValidation": {
            const p = event.payload as {
              insideGeometry?: GeoJSON.Geometry | null;
              overflowGeometry?: GeoJSON.Geometry | null;
            };
            setFitValidation(p.insideGeometry ?? null, p.overflowGeometry ?? null);
            break;
          }

          case "clearFitValidation": {
            setFitValidation(null, null);
            set3DModel(null, [0, 0], 0);
            break;
          }

          case "loadModel": {
            const p = event.payload as {
              glbUrl: string;
              center: [number, number];
              rotation: number;
              scale?: number;
              token?: string;
              modelWidthM?: number;
              modelDepthM?: number;
            };
            set3DModel(p.glbUrl, p.center, p.rotation, p.scale, p.token, p.modelWidthM, p.modelDepthM);
            break;
          }

          default:
            break;
        }
      },
    }),
    [setSelectedPolygon, setSuggestions, setFitValidation, set3DModel, applyModelTransform]
  );

  return (
    <div className={`relative w-full h-full rounded-xl overflow-hidden ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Map UI Overlay */}
      <div className="absolute top-4 left-14 z-10 flex flex-col gap-2">
        <div className="bg-background/90 backdrop-blur border border-border shadow-md rounded-md p-1.5 flex gap-1">
          {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((styleId) => (
            <button
              key={styleId}
              onClick={() => handleStyleChange(styleId)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors capitalize ${
                currentStyle === styleId 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {styleId}
            </button>
          ))}
        </div>
        
        {polygonArea !== null && (
          <div className="bg-background/90 backdrop-blur border border-border shadow-md rounded-md p-3 max-w-[200px]">
            <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-1">
              Selected Land Area
            </p>
            <div className="flex items-end gap-1.5">
              <span className="text-xl font-bold font-mono">
                {polygonArea.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-sm font-medium text-muted-foreground pb-0.5">sqm</span>
            </div>
            {polygonArea > 0 && (
              <p className="text-xs font-medium text-muted-foreground mt-1">
                {(polygonArea * 0.000247105).toLocaleString(undefined, { maximumFractionDigits: 2 })} acres
              </p>
            )}
          </div>
        )}
      </div>

    </div>
  );
});

export default GisMap;
