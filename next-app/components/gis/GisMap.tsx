"use client";

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// @ts-expect-error missing types for maplibre-gl-draw
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
}

interface GisMapProps {
  onPolygonChange?: (feature: GeoJSON.Feature | null) => void;
  className?: string;
}

const GisMap = forwardRef<GisMapHandle, GisMapProps>(function GisMap(
  { onPolygonChange, className = "" },
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

  const [currentStyle, setCurrentStyle] = useState<MapStyleKey>("hybrid");
  const [polygonArea, setPolygonArea] = useState<number | null>(null);

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
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

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
    const features = candidates.map((c) => ({
      type: "Feature" as const,
      geometry: c.geometry,
      properties: {
        ...c,
        reasons: JSON.stringify(c.reasons),
        color: CONFIDENCE_COLORS[c.confidence_label] ?? "#6b7280",
      },
    }));
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

  const set3DModel = useCallback((glbUrl: string | null, center: [number, number], rotation: number, scale: number = 1) => {
    const map = mapRef.current;
    if (!map) return;

    // Remove existing layer if any
    if (map.getLayer("3d-model")) {
      map.removeLayer("3d-model");
      threeLayerRef.current = null;
    }

    if (!glbUrl) return;

    const modelOrigin = center;
    const modelAltitude = 0;
    const modelRotate = [Math.PI / 2, (rotation * Math.PI) / 180, 0];

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

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();

    // Lighting
    const directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(0, -70, 100).normalize();
    scene.add(directionalLight);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const loader = new GLTFLoader();
    loader.load(glbUrl, (gltf) => {
        scene.add(gltf.scene);
    });

    let renderer: THREE.WebGLRenderer;

    const customLayer: maplibregl.CustomLayerInterface = {
        id: '3d-model',
        type: 'custom',
        renderingMode: '3d',
        onAdd: function (map, gl) {
            renderer = new THREE.WebGLRenderer({
                canvas: map.getCanvas(),
                context: gl,
                antialias: true
            });
            renderer.autoClear = false;
        },
        render: function (gl, matrix) {
            const m = new THREE.Matrix4().fromArray(matrix);
            const l = new THREE.Matrix4()
                .makeTranslation(
                    modelTransform.translateX,
                    modelTransform.translateY,
                    modelTransform.translateZ
                )
                .scale(
                    new THREE.Vector3(
                        modelTransform.scale,
                        -modelTransform.scale,
                        modelTransform.scale
                    )
                )
                .multiply(new THREE.Matrix4().makeRotationX(modelTransform.rotateX))
                .multiply(new THREE.Matrix4().makeRotationY(modelTransform.rotateY))
                .multiply(new THREE.Matrix4().makeRotationZ(modelTransform.rotateZ));

            camera.projectionMatrix = m.multiply(l);
            renderer.resetState();
            renderer.render(scene, camera);
            map.triggerRepaint();
        }
    };

    map.addLayer(customLayer);
    threeLayerRef.current = customLayer;
  }, []);

  // ── Expose handle ────────────────────────────────────────────────────────
  useImperativeHandle(
    ref,
    () => ({
      getSelectedPolygon: () => selectedPolygonRef.current,
      clearSuggestions: () => setSuggestions([]),

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
            const geojson = (event.payload.geojson || event.payload.geometry || event.payload.feature) as GeoJSON.Feature;
            if (!geojson) break;

            if (drawRef.current) {
              const feature: GeoJSON.Feature = geojson.type === "Feature" 
                ? geojson 
                : { type: "Feature", properties: {}, geometry: geojson as any };
              
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
              const coords = (feature.geometry as { coordinates: [number, number][][] }).coordinates?.[0];
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
            const p = event.payload as { glbUrl: string; center: [number, number]; rotation: number; scale?: number };
            set3DModel(p.glbUrl, p.center, p.rotation, p.scale);
            break;
          }

          default:
            break;
        }
      },
    }),
    [setSelectedPolygon, setSuggestions, setFitValidation]
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
