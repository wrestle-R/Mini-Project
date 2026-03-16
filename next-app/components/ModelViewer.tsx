"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FiSun, FiMoon, FiInfo, FiX, FiChevronDown, FiChevronRight, FiCopy, FiCheck } from "react-icons/fi";

interface ModelViewerProps {
  modelUrl: string;
}

/* ─────────────────────────────────────────────
   Recursive Metadata Renderer
   ───────────────────────────────────────────── */

function MetadataValue({ value }: { value: any }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground italic">—</span>;
  if (typeof value === "boolean") return <span className="text-foreground font-medium">{value ? "Yes" : "No"}</span>;
  if (typeof value === "number") return <span className="text-foreground font-mono">{value}</span>;
  if (typeof value === "string") return <span className="text-foreground break-words">{value || "—"}</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground italic">—</span>;
    // Array of primitives → comma separated
    if (value.every((v) => typeof v === "string" || typeof v === "number"))
      return <span className="text-foreground break-words">{value.join(", ")}</span>;
    // Array of objects → rendered as sub-sections
    return (
      <div className="col-span-2 ml-2 space-y-1 mt-1">
        {value.map((item, idx) => (
          <div key={idx} className="rounded bg-muted/30 p-1.5">
            {typeof item === "object" && item !== null ? (
              <MetadataObject data={item} />
            ) : (
              <span className="text-foreground text-xs">{String(item)}</span>
            )}
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") return <MetadataObject data={value} />;
  return <span className="text-foreground">{String(value)}</span>;
}

function MetadataObject({ data }: { data: Record<string, any> }) {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-2 gap-y-0.5 text-xs">
      {Object.entries(data).map(([k, v]) => {
        // Nested objects/arrays get their own collapsible section
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
          return (
            <div key={k} className="col-span-2 mt-1">
              <CollapsibleSection title={k} defaultOpen={false}>
                <MetadataObject data={v} />
              </CollapsibleSection>
            </div>
          );
        }
        return (
          <React.Fragment key={k}>
            <span className="text-muted-foreground truncate" title={k}>{k}</span>
            <MetadataValue value={v} />
          </React.Fragment>
        );
      })}
    </div>
  );
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  accent = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accent?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-md border border-border/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-xs font-semibold tracking-wide uppercase transition-colors cursor-pointer ${
          accent
            ? "bg-primary/10 text-primary hover:bg-primary/15"
            : "bg-muted/40 text-foreground hover:bg-muted/60"
        }`}
      >
        {open ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="px-2 py-1.5">{children}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   GUID / clipboard copy button
   ───────────────────────────────────────────── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
      title="Copy to clipboard"
    >
      {copied ? <FiCheck size={11} /> : <FiCopy size={11} />}
    </button>
  );
}

/* ─────────────────────────────────────────────
   Main ModelViewer Component
   ───────────────────────────────────────────── */
export default function ModelViewer({ modelUrl }: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [selectedElement, setSelectedElement] = useState<Record<string, any> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Scene references for theme switching
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);

  // Update theme colors when toggled
  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current) return;

    const bgColor = isDarkMode ? 0x111113 : 0xf4f4f7;
    sceneRef.current.background = new THREE.Color(bgColor);
    if (sceneRef.current.fog) {
      (sceneRef.current.fog as THREE.FogExp2).color.set(bgColor);
    }

    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = isDarkMode ? 0.6 : 1.0;
    }

    // Update grid colors for the current theme
    if (gridRef.current) {
      sceneRef.current.remove(gridRef.current);
      const newGrid = new THREE.GridHelper(
        200,
        50,
        isDarkMode ? 0x444455 : 0xccccdd,
        isDarkMode ? 0x222233 : 0xddddee
      );
      gridRef.current = newGrid;
      sceneRef.current.add(newGrid);
    }
  }, [isDarkMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Scene ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const initialBg = isDarkMode ? 0x111113 : 0xf4f4f7;
    scene.background = new THREE.Color(initialBg);
    scene.fog = new THREE.FogExp2(initialBg, 0.003);

    // --- Camera ---
    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      10000
    );
    camera.position.set(40, 30, 40);

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rendererRef.current = renderer;
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // --- Lights ---
    const ambientLight = new THREE.AmbientLight(0xffffff, isDarkMode ? 0.6 : 1.0);
    ambientLightRef.current = ambientLight;
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(50, 100, 50);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xddeeff, 0.4);
    fillLight.position.set(-50, 20, -20);
    scene.add(fillLight);

    const backLight = new THREE.DirectionalLight(0xfff5ee, 0.3);
    backLight.position.set(0, -30, -50);
    scene.add(backLight);

    // --- Grid ---
    const grid = new THREE.GridHelper(
      200,
      50,
      isDarkMode ? 0x444455 : 0xccccdd,
      isDarkMode ? 0x222233 : 0xddddee
    );
    gridRef.current = grid;
    scene.add(grid);

    // --- Controls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // --- Raycasting for Inspection ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let highlightedMesh: THREE.Mesh | null = null;
    let originalEmissive: THREE.Color | null = null;

    const onPointerDown = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      // Reset previous highlight
      if (highlightedMesh && originalEmissive) {
        const prevMat = highlightedMesh.material as THREE.MeshStandardMaterial;
        if (prevMat && prevMat.emissive) {
          prevMat.emissive.copy(originalEmissive);
        }
      }

      if (intersects.length > 0) {
        const object = intersects[0].object as THREE.Mesh;

        // Resolve metadata: check _ifc_metadata JSON string first
        let meta = object.userData;
        if (meta && meta._ifc_metadata) {
          try {
            meta = JSON.parse(meta._ifc_metadata);
          } catch {
            // keep original userData
          }
        }

        if (meta && meta.GlobalId) {
          highlightedMesh = object;
          const mat = object.material as THREE.MeshStandardMaterial;
          if (mat && mat.emissive) {
            originalEmissive = mat.emissive.clone();
            mat.emissive.setHex(0x334466);
          }
          setSelectedElement(meta);
        } else {
          setSelectedElement(null);
        }
      } else {
        setSelectedElement(null);
      }
    };
    container.addEventListener("pointerdown", onPointerDown);

    // --- Load Model ---
    const loader = new GLTFLoader();
    const fullUrl = `http://localhost:8000${modelUrl}`;

    loader.load(
      fullUrl,
      (gltf) => {
        const model = gltf.scene;
        model.rotation.x = -Math.PI / 2; // IFC rotation fix

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            // IFC geometry often has inward-facing normals — render both sides
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((mat) => {
              const m = mat as THREE.MeshStandardMaterial;
              m.side = THREE.DoubleSide;
              // GLB default material has metalness=1 which looks black without envmap
              m.metalness = 0;
              m.roughness = 0.7;
              m.needsUpdate = true;
            });

            // Parse _ifc_metadata from extras into userData for quick raycaster lookup
            if (mesh.userData && mesh.userData._ifc_metadata) {
              try {
                const parsed = JSON.parse(mesh.userData._ifc_metadata);
                // Keep the parsed version alongside the raw string
                mesh.userData = { ...mesh.userData, ...parsed };
              } catch {
                // keep original
              }
            }
          }
        });

        scene.add(model);

        // Auto-fit camera
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let distance = maxDim / (2 * Math.tan(fov / 2));
        distance *= 1.25;

        camera.position.set(
          center.x + distance,
          center.y + distance * 0.5,
          center.z + distance
        );
        camera.lookAt(center);
        controls.target.copy(center);
        controls.update();

        setIsLoading(false);
      },
      undefined,
      (error) => {
        console.error("Error loading IFC-GLB:", error);
        setIsLoading(false);
      }
    );

    // --- Animation Loop ---
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // --- Resize Handler ---
    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("pointerdown", onPointerDown);
      renderer.dispose();
      controls.dispose();
    };
  }, [modelUrl]);

  /* ─── Keys to skip/display separately ─── */
  const CORE_KEYS = new Set(["GlobalId", "Name", "Type", "_ifc_metadata"]);

  const metaSections = selectedElement
    ? Object.entries(selectedElement).filter(([k]) => !CORE_KEYS.has(k))
    : [];

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[500px] overflow-hidden rounded-xl border bg-black/5"
    >
      {/* Theme Toggle Button */}
      <button
        onClick={() => setIsDarkMode(!isDarkMode)}
        className="absolute bottom-4 left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border bg-background/80 text-foreground shadow-md backdrop-blur-md transition-all hover:bg-background cursor-pointer"
        title="Toggle Viewer Theme"
      >
        {isDarkMode ? <FiSun size={18} /> : <FiMoon size={18} />}
      </button>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/40 backdrop-blur-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm font-medium text-foreground">
            Processing 3D Geometry...
          </p>
        </div>
      )}

      {/* ─── Inspection Sidebar ─── */}
      {selectedElement && (
        <div className="absolute right-4 top-4 z-10 w-80 max-h-[90%] overflow-y-auto rounded-xl border bg-background/90 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-right-4 duration-300">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between border-b pb-2">
            <h3 className="flex items-center gap-2 font-bold text-foreground">
              <FiInfo className="text-primary" />
              Element Inspector
            </h3>
            <button
              onClick={() => setSelectedElement(null)}
              className="rounded-md p-1 hover:bg-muted cursor-pointer"
            >
              <FiX />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            {/* Core Identity */}
            <section className="rounded-lg bg-primary/5 p-2.5">
              <p className="font-semibold text-primary uppercase tracking-wider mb-1.5 text-[10px]">
                Core Identity
              </p>
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-2 gap-y-1">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium text-foreground">
                  {selectedElement.Type}
                </span>
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium text-foreground break-words">
                  {selectedElement.Name || "—"}
                </span>
                <span className="text-muted-foreground">GUID</span>
                <span className="flex items-center gap-1">
                  <span
                    className="font-mono text-foreground opacity-70 truncate"
                    title={selectedElement.GlobalId}
                  >
                    {selectedElement.GlobalId}
                  </span>
                  <CopyButton text={selectedElement.GlobalId} />
                </span>
              </div>
            </section>

            {/* ─── Dynamic Metadata Sections ─── */}
            {metaSections.map(([key, value]) => {
              // Simple primitives
              if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
                return (
                  <section key={key} className="rounded-md bg-muted/30 p-2">
                    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-2 gap-y-0.5">
                      <span className="text-muted-foreground font-semibold">{key}</span>
                      <MetadataValue value={value} />
                    </div>
                  </section>
                );
              }

              // Arrays (Materials, Classifications, etc.)
              if (Array.isArray(value)) {
                return (
                  <CollapsibleSection key={key} title={key} accent>
                    {value.every((v: any) => typeof v === "string" || typeof v === "number") ? (
                      <p className="text-xs text-foreground">{value.join(", ")}</p>
                    ) : (
                      <div className="space-y-1">
                        {value.map((item: any, idx: number) => (
                          <div key={idx} className="rounded bg-muted/30 p-1.5 text-xs">
                            {typeof item === "object" && item !== null ? (
                              <MetadataObject data={item} />
                            ) : (
                              <span className="text-foreground">{String(item)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CollapsibleSection>
                );
              }

              // Nested objects (Properties, Quantities, SpatialContainment, etc.)
              if (typeof value === "object" && value !== null) {
                return (
                  <CollapsibleSection key={key} title={key} accent>
                    {/* Property Sets / Quantity Sets have a second nesting level */}
                    {Object.entries(value as Record<string, any>).map(
                      ([subKey, subVal]) => {
                        if (typeof subVal === "object" && subVal !== null && !Array.isArray(subVal)) {
                          return (
                            <div key={subKey} className="mb-2">
                              <CollapsibleSection title={subKey} defaultOpen={false}>
                                <MetadataObject data={subVal as Record<string, any>} />
                              </CollapsibleSection>
                            </div>
                          );
                        }
                        return (
                          <div
                            key={subKey}
                            className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-2 gap-y-0.5 text-xs px-1"
                          >
                            <span className="text-muted-foreground truncate" title={subKey}>{subKey}</span>
                            <MetadataValue value={subVal} />
                          </div>
                        );
                      }
                    )}
                  </CollapsibleSection>
                );
              }

              return null;
            })}

            {metaSections.length === 0 && (
              <p className="text-center text-muted-foreground italic py-2">
                No additional metadata available for this element.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Interaction Hint Overlay */}
      {!selectedElement && !isLoading && (
        <div className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest bg-background/50 px-3 py-1.5 rounded-full border backdrop-blur-sm">
          <FiInfo size={12} className="text-primary" />
          Click element to inspect properties
        </div>
      )}
    </div>
  );
}
