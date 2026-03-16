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

  // Fetch metadata when URL changes
  useEffect(() => {
    if (!metadataUrl) return;
    fetch(`http://localhost:8000${metadataUrl}`)
      .then((res) => res.json())
      .then((data) => {
        metadataRef.current = data;
      })
      .catch((err) => console.error("Failed to load metadata:", err));
  }, [metadataUrl]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Scene ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111113);
    scene.fog = new THREE.FogExp2(0x111113, 0.003);

    // --- Camera ---
    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      5000
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
    controls.maxDistance = 400;
    controls.maxPolarAngle = Math.PI / 2 + 0.1;

    // --- Selection / Raycasting state ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let modelRoot: THREE.Object3D | null = null;
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

      if (!modelRoot) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects([modelRoot], true);

      if (intersects.length > 0) {
        // Walk up from hit mesh to find named IFC element node
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && obj !== modelRoot) {
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

    // --- Load Model ---
    const loader = new GLTFLoader();
    const fullUrl = `http://localhost:8000${modelUrl}`;

    loader.load(
      fullUrl,
      (gltf) => {
        const model = gltf.scene;
        modelRoot = model;

        // IFC files use Z-up; Three.js uses Y-up
        model.rotation.x = -Math.PI / 2;

        // Preserve original IFC colors — only adjust rendering properties
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const mat = mesh.material as THREE.MeshStandardMaterial;
            mat.side = THREE.DoubleSide;

            // Enable vertex colors if the GLB contains them (from IFC materials)
            if (mesh.geometry.attributes.color) {
              mat.vertexColors = true;
              mat.needsUpdate = true;
            } else if (
              mat.color.r === 1 &&
              mat.color.g === 1 &&
              mat.color.b === 1 &&
              !mesh.geometry.attributes.color
            ) {
              // No color data at all — apply a neutral default
              mat.color = new THREE.Color(0xb0bcc8);
              mat.roughness = 0.55;
              mat.metalness = 0.15;
            }
          }
        });

        scene.add(model);

        // Fit camera to model bounds
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        const distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.3;

        camera.position.set(
          center.x + distance * 0.7,
          center.y + distance * 0.5,
          center.z + distance * 0.7
        );
        camera.lookAt(center);
        controls.target.copy(center);

        ground.position.y = box.min.y - 0.01;
        grid.position.y = box.min.y;

        controls.update();
      },
      undefined,
      (error) => {
        console.error("Error loading GLB model:", error);
      }
    );

    // --- Animation loop ---
    let animFrameId: number;
    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // --- Resize handler ---
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    // --- Cleanup ---
    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      renderer.domElement.removeEventListener("mouseup", onMouseUp);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [modelUrl]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[500px] rounded-lg overflow-hidden"
    />
  );
}
