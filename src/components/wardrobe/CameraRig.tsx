import { useEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export type FocusRequest = {
  /** World-space point to centre the camera on. */
  point: [number, number, number];
  /** Optional orbit distance in metres. */
  distance?: number;
  /** Bump this to re-trigger the same focus point. */
  key: number;
} | null;

type Ctrl = {
  target: THREE.Vector3;
  update: () => void;
  mouseButtons: { LEFT: number; MIDDLE: number; RIGHT: number };
};

/**
 * Unity-style navigation:
 * - Left drag / right drag  → orbit
 * - Middle drag / Shift+Left → pan
 * - Wheel → smooth zoom toward the cursor
 * - One finger → orbit · two fingers → pinch zoom + pan
 * Focus requests animate both the camera and the orbit target.
 */
export default function CameraRig({
  target,
  focus,
  enabled = true,
  minDistance = 1.2,
  maxDistance = 26,
  touch = false,
  profile = "default",
}: {
  target: [number, number, number];
  focus?: FocusRequest;
  enabled?: boolean;
  minDistance?: number;
  maxDistance?: number;
  /** Slightly slower rotate/zoom speeds tuned for fingers. */
  touch?: boolean;
  /** Assembly profile uses a softer, wider-feeling navigation setup. */
  profile?: "default" | "assembly";
}) {
  const ref = useRef<Ctrl | null>(null);
  const camera = useThree((s) => s.camera);
  const anim = useRef<{ camTo: THREE.Vector3; tgtTo: THREE.Vector3; t: number } | null>(null);

  // Shift swaps the left mouse button from orbit to pan, Unity-style.
  useEffect(() => {
    const set = (pan: boolean) => {
      const c = ref.current;
      if (!c) return;
      c.mouseButtons = {
        LEFT: pan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.ROTATE,
      };
    };
    const down = (e: KeyboardEvent) => e.key === "Shift" && set(true);
    const up = (e: KeyboardEvent) => e.key === "Shift" && set(false);
    set(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Queue a smooth fly-to whenever a new focus request arrives.
  useEffect(() => {
    const c = ref.current;
    if (!focus || !c) return;
    const tgtTo = new THREE.Vector3(...focus.point);
    const dir = camera.position.clone().sub(c.target);
    const dist = Math.min(
      maxDistance,
      Math.max(minDistance, focus.distance ?? Math.max(1.8, dir.length() * 0.65)),
    );
    if (dir.lengthSq() < 1e-6) dir.set(1, 0.8, 1);
    anim.current = { camTo: tgtTo.clone().add(dir.normalize().multiplyScalar(dist)), tgtTo, t: 0 };
  }, [focus?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onPreset = (event: Event) => {
      const id = (event as CustomEvent<"perspective" | "front" | "side" | "top">).detail;
      const c = ref.current;
      if (!c) return;
      const centre = c.target.clone();
      const distance = THREE.MathUtils.clamp(
        camera.position.distanceTo(centre),
        minDistance,
        maxDistance,
      );
      const offsets = {
        perspective: new THREE.Vector3(distance * 0.72, distance * 0.48, distance),
        front: new THREE.Vector3(0, 0.08, distance),
        side: new THREE.Vector3(distance, 0.08, 0),
        top: new THREE.Vector3(0, distance, 0.01),
      };
      anim.current = { camTo: centre.clone().add(offsets[id]), tgtTo: centre, t: 0 };
    };
    window.addEventListener("wardrobe-camera-preset", onPreset);
    return () => window.removeEventListener("wardrobe-camera-preset", onPreset);
  }, [camera, maxDistance, minDistance]);

  // Visible +/- controls are useful on phones and trackpads where a wheel is
  // not always available. Animate the dolly so the camera never jumps.
  useEffect(() => {
    const onZoom = (event: Event) => {
      const c = ref.current;
      if (!c) return;
      const requested = (event as CustomEvent<number>).detail;
      const factor = Number.isFinite(requested) && requested > 0 ? requested : 1;
      const offset = camera.position.clone().sub(c.target);
      if (offset.lengthSq() < 1e-6) offset.set(1, 0.6, 1);
      const nextDistance = THREE.MathUtils.clamp(
        offset.length() * factor,
        minDistance,
        maxDistance,
      );
      anim.current = {
        camTo: c.target.clone().add(offset.normalize().multiplyScalar(nextDistance)),
        tgtTo: c.target.clone(),
        t: 0,
      };
    };
    window.addEventListener("wardrobe-camera-zoom", onZoom);
    return () => window.removeEventListener("wardrobe-camera-zoom", onZoom);
  }, [camera, maxDistance, minDistance]);

  // A visible reset action is easier to discover on touch devices than the
  // keyboard shortcut. Keep the current target and distance, but restore the
  // familiar three-quarter perspective.
  useEffect(() => {
    const onReset = () => {
      const c = ref.current;
      if (!c) return;
      const centre = c.target.clone();
      const distance = THREE.MathUtils.clamp(
        camera.position.distanceTo(centre),
        minDistance,
        maxDistance,
      );
      anim.current = {
        camTo: centre.clone().add(new THREE.Vector3(distance * 0.72, distance * 0.48, distance)),
        tgtTo: centre,
        t: 0,
      };
    };
    window.addEventListener("wardrobe-camera-reset", onReset);
    return () => window.removeEventListener("wardrobe-camera-reset", onReset);
  }, [camera, maxDistance, minDistance]);

  useFrame((_, dt) => {
    const c = ref.current;
    const a = anim.current;
    if (!a || !c) return;
    a.t = Math.min(1, a.t + dt * 2.6);
    const e = 1 - Math.pow(1 - a.t, 3); // ease-out cubic
    camera.position.lerp(a.camTo, e * 0.35);
    c.target.lerp(a.tgtTo, e * 0.35);
    c.update();
    if (a.t >= 1) anim.current = null;
  });

  return (
    <OrbitControls
      // @ts-expect-error drei forwards the three OrbitControls instance
      ref={ref}
      makeDefault
      enabled={enabled}
      enablePan
      enableDamping
      dampingFactor={profile === "assembly" ? 0.12 : 0.08}
      zoomToCursor
      zoomSpeed={touch ? 0.68 : profile === "assembly" ? 0.82 : 0.9}
      rotateSpeed={touch ? 0.52 : profile === "assembly" ? 0.72 : 0.85}
      panSpeed={touch ? 0.78 : profile === "assembly" ? 0.9 : 1}
      screenSpacePanning
      minPolarAngle={0.18}
      minDistance={minDistance}
      maxDistance={maxDistance}
      maxPolarAngle={Math.PI / 2.05}
      target={target}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
    />
  );
}
