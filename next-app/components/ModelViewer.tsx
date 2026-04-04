"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface ElementMetadata {
  globalId: string;
  type: string;
  name: string;
  description: string;
  objectType?: string;
  properties: Record<string, Record<string, unknown>>;
}

interface ModelViewerProps {
  modelUrl: string;
  metadataUrl?: string;
  onElementSelect?: (element: ElementMetadata | null) => void;
}

export default function ModelViewer({
  modelUrl,
  metadataUrl,
  onElementSelect,
}: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const metadataRef = useRef<Record<string, ElementMetadata>>({});
  const onElementSelectRef = useRef(onElementSelect);
  onElementSelectRef.current = onElementSelect;

  // Store scene objects to avoid reinitializing on model reload
  const sceneRef = useRef<{
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    controls?: OrbitControls;
    animFrameId?: number;
    modelRoot?: THREE.Object3D;
  }>({});

  // Fetch metadata when URL changes
  useEffect(() => {
    if (!metadataUrl) return;
    const metadataPath = metadataUrl.startsWith("http")
      ? metadataUrl
      : `http://localhost:8000${metadataUrl}`;
    fetch(metadataPath)
      .then((res) => res.json())
      .then((data) => {
        metadataRef.current = data;
      })
      .catch((err) => console.error("Failed to load metadata:", err));
  }, [metadataUrl]);

  // Initialize scene (only once)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || sceneRef.current.renderer) return; // Already initialized

    // --- Scene ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111113);

    // --- Camera ---
    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      100000
    );
    camera.position.set(30, 25, 30);

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const resizeRenderer = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;

      if (width === 0 || height === 0) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(40, 80, 40);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xc8d8e8, 0.4);
    fillLight.position.set(-30, 20, -20);
    scene.add(fillLight);

    const hemiLight = new THREE.HemisphereLight(0xb1c4de, 0x8a7560, 0.35);
    scene.add(hemiLight);

    // --- Ground plane ---
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x181820,
      roughness: 0.95,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    // --- Grid ---
    const grid = new THREE.GridHelper(200, 80, 0x2a2a35, 0x1d1d25);
    grid.position.y = 0;
    scene.add(grid);

    // --- Controls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 2;
    controls.maxDistance = 100000;
    controls.maxPolarAngle = Math.PI / 2 + 0.1;

    // --- Selection / Raycasting state ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const originalMaterials = new Map<
      THREE.Mesh,
      THREE.Material | THREE.Material[]
    >();

    const clearHighlight = () => {
      originalMaterials.forEach((mat, mesh) => {
        mesh.material = mat;
      });
      originalMaterials.clear();
    };

    const highlightNode = (node: THREE.Object3D) => {
      clearHighlight();
      node.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          originalMaterials.set(mesh, mesh.material);
          const cloned = (
            mesh.material as THREE.MeshStandardMaterial
          ).clone();
          cloned.emissive = new THREE.Color(0x2266cc);
          cloned.emissiveIntensity = 0.45;
          mesh.material = cloned;
        }
      });
    };

    // Distinguish click from orbit drag
    let mouseDownPos = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      mouseDownPos = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = (e: MouseEvent) => {
      const dx = Math.abs(e.clientX - mouseDownPos.x);
      const dy = Math.abs(e.clientY - mouseDownPos.y);
      if (dx > 5 || dy > 5) return; // was a drag

      if (!sceneRef.current.modelRoot) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects([sceneRef.current.modelRoot], true);

      if (intersects.length > 0) {
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && obj !== sceneRef.current.modelRoot) {
          if (obj.name && metadataRef.current[obj.name]) {
            break;
          }
          obj = obj.parent;
        }

        if (obj && obj.name && metadataRef.current[obj.name]) {
          highlightNode(obj);
          onElementSelectRef.current?.(metadataRef.current[obj.name]);
        } else {
          clearHighlight();
          onElementSelectRef.current?.(null);
        }
      } else {
        clearHighlight();
        onElementSelectRef.current?.(null);
      }
    };

    renderer.domElement.addEventListener("mousedown", onMouseDown);
    renderer.domElement.addEventListener("mouseup", onMouseUp);

    // --- Animation loop ---
    const animate = () => {
      sceneRef.current.animFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    resizeRenderer();

    // --- Resize handler ---
    const resizeObserver = new ResizeObserver(() => {
      resizeRenderer();
    });
    resizeObserver.observe(container);

    const handleWindowResize = () => {
      resizeRenderer();
    };
    window.addEventListener("resize", handleWindowResize);

    // Store references
    sceneRef.current = {
      renderer,
      scene,
      camera,
      controls,
      animFrameId: 0,
    };

    // --- Cleanup on unmount ---
    return () => {
      if (sceneRef.current.animFrameId) {
        cancelAnimationFrame(sceneRef.current.animFrameId);
      }
      window.removeEventListener("resize", handleWindowResize);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      renderer.domElement.removeEventListener("mouseup", onMouseUp);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []); // Empty dependency array - initialize only once

  // Load/reload model when URL changes
  useEffect(() => {
    const { scene, camera, controls } = sceneRef.current;
    if (!scene || !camera || !controls) return;

    // Remove old model if exists
    if (sceneRef.current.modelRoot) {
      scene.remove(sceneRef.current.modelRoot);
      sceneRef.current.modelRoot = undefined;
    }

    const loader = new GLTFLoader();
    const fullUrl = modelUrl.startsWith("http")
      ? modelUrl
      : `http://localhost:8000${modelUrl}`;

    loader.load(
      fullUrl,
      (gltf) => {
        const model = gltf.scene;
        sceneRef.current.modelRoot = model;

        // Normalize model to scene origin before and after the axis adjustment.
        // Some GLB exports shift their center when rotated, so we frame again after
        // converting from IFC's Z-up to Three.js Y-up.
        const bounds = new THREE.Box3().setFromObject(model);
        const center = bounds.getCenter(new THREE.Vector3());
        model.position.sub(center);

        // IFC files use Z-up; Three.js uses Y-up.
        // Apply the rotation after centering so it doesn't swing the model away from view.
        model.rotation.x = -Math.PI / 2;

        const framedBounds = new THREE.Box3().setFromObject(model);
        const framedCenter = framedBounds.getCenter(new THREE.Vector3());
        const framedSize = framedBounds.getSize(new THREE.Vector3());
        model.position.sub(framedCenter);

        // Preserve original IFC colors
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const mat = mesh.material as THREE.MeshStandardMaterial;
            mat.side = THREE.DoubleSide;

            // Enable vertex colors if available
            if (mesh.geometry.attributes.color) {
              mat.vertexColors = true;
              mat.needsUpdate = true;
            } else if (
              mat.color.r === 1 &&
              mat.color.g === 1 &&
              mat.color.b === 1 &&
              !mesh.geometry.attributes.color
            ) {
              // Apply neutral default
              mat.color = new THREE.Color(0xb0bcc8);
              mat.roughness = 0.55;
              mat.metalness = 0.15;
            }
          }
        });

        scene.add(model);

        // Fit camera to model bounds
        const maxDim = Math.max(framedSize.x, framedSize.y, framedSize.z);
        const safeMaxDim = Number.isFinite(maxDim) && maxDim > 0.01 ? maxDim : 10;
        const fov = camera.fov * (Math.PI / 180);
        const distance = Math.max(
          (safeMaxDim / (2 * Math.tan(fov / 2))) * 1.3,
          12
        );

        camera.position.set(
          distance * 0.7,
          distance * 0.5,
          distance * 0.7
        );
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);

        // Update ground plane
        const grid = scene.children.find(
          (c) => c instanceof THREE.GridHelper
        ) as THREE.GridHelper | undefined;
        if (grid) {
          grid.position.y = 0;
        }

        const ground = scene.children.find(
          (c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.PlaneGeometry
        ) as THREE.Mesh | undefined;
        if (ground) {
          ground.position.y = -0.01;
        }

        controls.update();
      },
      undefined,
      (error) => {
        console.error("Error loading GLB model:", error);
      }
    );
  }, [modelUrl]); // Reload only when modelUrl changes

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[500px] rounded-lg overflow-hidden"
    />
  );
}
