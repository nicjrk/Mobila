import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Grid, Html, Line, TransformControls } from "@react-three/drei";
import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { FocusRequest } from "./CameraRig";

const CameraRig = lazy(() => import("./CameraRig"));
import {
  FINISHES,
  sectionSpec,
  ITEM_META,
  type DoorMaterial,
  type DoorStyle,
  type Fitting,
  type HandlePos,
  type HandleStyle,
  type ModularRoom,
  type Unit,
} from "@/lib/wardrobe";
import { snapElevation, snapUnitToRoom } from "@/lib/units";
import {
  drawerStackHeight,
  FITTING_META,
  fittingsOf,
  innerBase,
  innerHeight,
} from "@/lib/fittings";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Copy,
  DoorOpen,
  DoorClosed,
  Lock,
  Magnet,
  MoveVertical,
  RotateCw,
  Trash2,
  AlignVerticalJustifyStart,
  Archive,
} from "lucide-react";

const P = 0.018; // panel thickness in metres

const FALLBACK = { hex: "#e8e3da", roughness: 0.6 };
const finishOf = (id: Unit["finish"]) => {
  const f = FINISHES.find((x) => x.id === id);
  return { hex: f?.hex ?? FALLBACK.hex, roughness: f?.roughness ?? FALLBACK.roughness };
};

/** Thin architectural dimension line with a hairline label placed OUTSIDE the cabinet. */
function DimLine({
  from,
  to,
  label,
  labelOffset = [0, 0, 0],
}: {
  from: [number, number, number];
  to: [number, number, number];
  label: string;
  labelOffset?: [number, number, number];
}) {
  const mid: [number, number, number] = [
    (from[0] + to[0]) / 2 + labelOffset[0],
    (from[1] + to[1]) / 2 + labelOffset[1],
    (from[2] + to[2]) / 2 + labelOffset[2],
  ];
  return (
    <group>
      <Line points={[from, to]} color="#8d9a94" lineWidth={0.8} />
      <Html center position={mid} distanceFactor={6}>
        <span className="whitespace-nowrap rounded-full border border-border/70 bg-[#fffdfa]/95 px-2 py-0.5 text-[10px] font-semibold tracking-tight text-foreground shadow-sm backdrop-blur-sm">
          {label}
        </span>
      </Html>
    </group>
  );
}

const Panel = memo(function Panel({
  size,
  position,
  color,
  roughness,
  transparent = false,
  opacity = 1,
  depthWrite = true,
}: {
  size: [number, number, number];
  position: [number, number, number];
  color: string;
  roughness: number;
  transparent?: boolean;
  opacity?: number;
  depthWrite?: boolean;
}) {
  const material = useMemo(
    () => ({ color, roughness, metalness: 0.04, transparent, opacity, depthWrite }),
    [color, roughness, transparent, opacity, depthWrite],
  );
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial {...material} />
    </mesh>
  );
});

function RoomShell({ room, showDimensions }: { room: ModularRoom; showDimensions: boolean }) {
  const W = room.width / 100;
  const D = room.depth / 100;
  const H = room.height / 100;
  const T = room.wallThickness / 100;
  const entry = room.entryWidth / 100;
  const side = Math.max(0, (W - entry) / 2);
  const wallMaterial = {
    color: "#eeeae3",
    roughness: 0.95,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  };
  return (
    <group>
      <Panel size={[W, 0.07, D]} position={[0, -0.035, D / 2]} color="#d8c5a8" roughness={0.85} />
      <Panel size={[W + T * 2, H, T]} position={[0, H / 2, -T / 2]} {...wallMaterial} />
      <Panel size={[T, H, D]} position={[-W / 2 - T / 2, H / 2, D / 2]} {...wallMaterial} />
      <Panel size={[T, H, D]} position={[W / 2 + T / 2, H / 2, D / 2]} {...wallMaterial} />
      <Panel
        size={[side, H, T]}
        position={[-(W / 2 - side / 2), H / 2, D + T / 2]}
        {...wallMaterial}
      />
      {showDimensions && (
        <group>
          <DimLine
            from={[-W / 2, 0.02, D + 0.18]}
            to={[W / 2, 0.02, D + 0.18]}
            label={`Room width · ${room.width} cm`}
          />
          <DimLine
            from={[W / 2 + 0.18, 0.02, 0]}
            to={[W / 2 + 0.18, 0.02, D]}
            label={`Room depth · ${room.depth} cm`}
            labelOffset={[0.2, 0, 0]}
          />
          <DimLine
            from={[-W / 2 - 0.18, 0, 0]}
            to={[-W / 2 - 0.18, H, 0]}
            label={`Ceiling · ${room.height} cm`}
            labelOffset={[-0.3, 0, 0]}
          />
        </group>
      )}
      <Panel
        size={[side, H, T]}
        position={[W / 2 - side / 2, H / 2, D + T / 2]}
        {...wallMaterial}
      />
    </group>
  );
}

type Actions = {
  onRotate: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onAlignWall: (id: string) => void;
  onToggleSnap: (id: string) => void;
  onElevate: (id: string, delta: number) => void;
  onToggleOpen: (id: string) => void;
  onToggleDrawers: (id: string) => void;
};

/** Handle mesh — always rendered as a CHILD of the door leaf it belongs to. */
const Handle = memo(function Handle({
  style,
  leafWidth,
  leafHeight,
  position,
  labelDir,
  onPointerDown,
}: {
  style: HandleStyle;
  leafWidth: number;
  leafHeight?: number;
  position: [number, number, number];
  /** +1/-1 — which side the height badge floats to, so it clears the door face. */
  labelDir: number;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
}) {
  if (style === "push") return null;
  return (
    <group position={position} onPointerDown={onPointerDown}>
      {/* Oversized transparent hitbox so fingers can grab the handle on mobile. */}
      <mesh>
        <boxGeometry
          args={[0.09, Math.max(0.16, style === "profile" ? (leafHeight ?? 1) - 0.08 : 0.2), 0.09]}
        />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {style === "profile" ? (
        <mesh castShadow>
          <boxGeometry args={[0.022, Math.max(0.2, (leafHeight ?? 1) - 0.08), 0.016]} />
          <meshStandardMaterial color="#9aa2a6" metalness={0.9} roughness={0.25} />
        </mesh>
      ) : style === "knob" ? (
        <mesh castShadow>
          <sphereGeometry args={[0.016, 20, 20]} />
          <meshStandardMaterial color="#9aa2a6" metalness={0.9} roughness={0.28} />
        </mesh>
      ) : style === "edge" ? (
        <mesh castShadow>
          <boxGeometry args={[Math.max(0.08, leafWidth - 0.05), 0.02, 0.014]} />
          <meshStandardMaterial color="#9aa2a6" metalness={0.85} roughness={0.3} />
        </mesh>
      ) : (
        <mesh castShadow>
          <cylinderGeometry args={[0.008, 0.008, 0.16, 14]} />
          <meshStandardMaterial color="#9aa2a6" metalness={0.9} roughness={0.25} />
        </mesh>
      )}
    </group>
  );
});

/** Door leaf surface — full Straight Wall material + style parity. */
const DoorSurface = memo(function DoorSurface({
  w,
  h,
  material,
  style,
  color,
  roughness,
}: {
  w: number;
  h: number;
  material: DoorMaterial;
  style: DoorStyle;
  color: string;
  roughness: number;
}) {
  const frame = (thickness = 0.055) => (
    <group>
      <Panel
        size={[w, thickness, 0.02]}
        position={[0, h / 2 - thickness / 2, 0]}
        color={color}
        roughness={roughness}
      />
      <Panel
        size={[w, thickness, 0.02]}
        position={[0, -h / 2 + thickness / 2, 0]}
        color={color}
        roughness={roughness}
      />
      <Panel
        size={[thickness, h, 0.02]}
        position={[-w / 2 + thickness / 2, 0, 0]}
        color={color}
        roughness={roughness}
      />
      <Panel
        size={[thickness, h, 0.02]}
        position={[w / 2 - thickness / 2, 0, 0]}
        color={color}
        roughness={roughness}
      />
    </group>
  );

  if (material === "solid") {
    if (style === "framed")
      return (
        <group>
          {frame(0.07)}
          <Panel
            size={[w - 0.13, h - 0.13, 0.012]}
            position={[0, 0, -0.004]}
            color={color}
            roughness={Math.min(1, roughness + 0.15)}
          />
        </group>
      );
    if (style === "glass")
      return (
        <group>
          {frame()}
          <mesh position={[0, 0, -0.002]}>
            <boxGeometry args={[w - 0.11, h - 0.11, 0.01]} />
            <meshPhysicalMaterial color="#e6efee" transparent opacity={0.42} roughness={0.45} />
          </mesh>
        </group>
      );
    return <Panel size={[w, h, 0.018]} position={[0, 0, 0]} color={color} roughness={roughness} />;
  }

  if (material === "mirror")
    return (
      <mesh castShadow>
        <boxGeometry args={[w, h, 0.014]} />
        <meshStandardMaterial color="#cdd6dc" metalness={1} roughness={0.06} />
      </mesh>
    );

  const glass = {
    clear: { color: "#dceaf0", opacity: 0.3, roughness: 0.06 },
    smoked: { color: "#5f666b", opacity: 0.55, roughness: 0.12 },
    fluted: { color: "#c6d8d6", opacity: 0.45, roughness: 0.38 },
    alu: { color: "#dbe8ea", opacity: 0.3, roughness: 0.08 },
  }[material as "clear" | "smoked" | "fluted" | "alu"];

  return (
    <group>
      {material === "alu" && (
        <group>
          <Panel
            size={[w, 0.03, 0.022]}
            position={[0, h / 2 - 0.015, 0]}
            color="#9fa6ac"
            roughness={0.3}
          />
          <Panel
            size={[w, 0.03, 0.022]}
            position={[0, -h / 2 + 0.015, 0]}
            color="#9fa6ac"
            roughness={0.3}
          />
          <Panel
            size={[0.03, h, 0.022]}
            position={[-w / 2 + 0.015, 0, 0]}
            color="#9fa6ac"
            roughness={0.3}
          />
          <Panel
            size={[0.03, h, 0.022]}
            position={[w / 2 - 0.015, 0, 0]}
            color="#9fa6ac"
            roughness={0.3}
          />
        </group>
      )}
      <mesh castShadow>
        <boxGeometry
          args={[material === "alu" ? w - 0.05 : w, material === "alu" ? h - 0.05 : h, 0.012]}
        />
        <meshPhysicalMaterial
          color={glass.color}
          transparent
          opacity={glass.opacity}
          roughness={glass.roughness}
          metalness={0.12}
        />
      </mesh>
      {material === "fluted" && <Flutes w={w} h={h} />}
    </group>
  );
});

/** Vertical reeds of a fluted-glass leaf. */
function Flutes({ w, h }: { w: number; h: number }) {
  const n = Math.max(3, Math.round(w / 0.05));
  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position={[-w / 2 + ((i + 0.5) * w) / n, 0, 0.008]}>
          <boxGeometry args={[0.006, h - 0.02, 0.004]} />
          <meshPhysicalMaterial color="#eaf2f1" transparent opacity={0.5} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A hinged door leaf that swings open around its hinge edge.
 * The handle is a CHILD of the leaf group, so it can never drift off the door.
 */
const DoorLeaf = memo(function DoorLeaf({
  width,
  height,
  x,
  y,
  z,
  hinge,
  open,
  color,
  roughness,
  material,
  style,
  handle,
  mode = "hinged",
}: {
  width: number;
  height: number;
  x: number;
  y: number;
  z: number;
  hinge: "left" | "right";
  open: boolean;
  color: string;
  roughness: number;
  material: DoorMaterial;
  style: DoorStyle;
  /** Hinged leaf swings; pull-out front slides forward. */
  mode?: "hinged" | "pullout";
  handle?: {
    style: HandleStyle;
    pos: HandlePos;
    /** Handle centre height in metres, measured in the same frame as `y`. */
    worldY: number;
    onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  };
}) {
  const pivot = useRef<THREE.Group>(null);
  const dir = hinge === "left" ? 1 : -1;
  const target = mode === "pullout" ? 0 : open ? (-dir * Math.PI) / 2.3 : 0;
  const slide = mode === "pullout" && open ? Math.min(0.55, 0.45) : 0;
  useFrame((_, dt) => {
    const g = pivot.current;
    if (!g) return;
    g.rotation.y += (target - g.rotation.y) * Math.min(1, dt * 7);
    g.position.z += (z + slide - g.position.z) * Math.min(1, dt * 7);
  });
  const hingeX = hinge === "left" ? x - width / 2 : x + width / 2;
  const leafCx = (dir * width) / 2;
  const inset = Math.min(0.06, width / 2 - 0.02);
  const hx =
    handle?.pos === "center"
      ? leafCx
      : handle?.pos === "left"
        ? leafCx - width / 2 + inset
        : leafCx + width / 2 - inset;
  return (
    <group ref={pivot} position={[hingeX, y, z]}>
      <group position={[leafCx, 0, 0]}>
        <DoorSurface
          w={width}
          h={height}
          material={material}
          style={style}
          color={color}
          roughness={roughness}
        />
      </group>
      {handle && (
        <Handle
          style={handle.style}
          leafWidth={width}
          leafHeight={height}
          position={[hx, handle.worldY - y, 0.026]}
          labelDir={-dir}
          onPointerDown={handle.onPointerDown}
        />
      )}
    </group>
  );
});

type Interior = {
  /** Frame locked — only interior fittings and hardware can be edited. */
  editInterior: boolean;
  onToggleEditInterior: () => void;
  selectedFitting: string | null;
  onSelectFitting: (id: string | null) => void;
  onMoveFitting: (unitId: string, fittingId: string, y: number, targetUnitId?: string) => void;
  onSelectDoor: (unitId: string | null) => void;
  onMoveHandle: (unitId: string, y: number) => void;
};

/** Floating quick-action toolbar above the selected cabinet. */
function UnitToolbar({
  unit,
  actions,
  interior,
}: {
  unit: Unit;
  actions: Actions;
  interior: Interior;
}) {
  const btn =
    "flex size-7 items-center justify-center rounded-lg border border-border/70 bg-card/90 text-muted-foreground shadow-sm transition-colors hover:bg-secondary hover:text-foreground";
  return (
    <Html center position={[0, (unit.y + unit.h) / 100 + 0.22, 0]} distanceFactor={5}>
      <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-card/85 p-1 shadow-md backdrop-blur-md">
        <button
          className={`${btn} ${interior.editInterior ? "border-primary text-primary" : ""}`}
          title={
            interior.editInterior
              ? "Edit Interior Only is ON — frame locked"
              : "Edit Interior Only (lock cabinet frame)"
          }
          onClick={interior.onToggleEditInterior}
        >
          <Lock className="size-3.5" />
        </button>
        <button className={btn} title="Rotate 90°" onClick={() => actions.onRotate(unit.id)}>
          <RotateCw className="size-3.5" />
        </button>
        <button
          className={`${btn} ${unit.open ? "border-primary text-primary" : ""}`}
          title={unit.open ? "Close doors" : "Open doors"}
          onClick={() => actions.onToggleOpen(unit.id)}
        >
          {unit.open ? <DoorOpen className="size-3.5" /> : <DoorClosed className="size-3.5" />}
        </button>
        {unit.drawers > 0 && (
          <button
            className={`${btn} ${unit.drawersOpen ? "border-primary text-primary" : ""}`}
            title={unit.drawersOpen ? "Close drawers" : "Open drawers"}
            onClick={() => actions.onToggleDrawers(unit.id)}
          >
            <Archive className="size-3.5" />
          </button>
        )}
        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
        <button
          className={btn}
          title="Elevation +10 cm"
          onClick={() => actions.onElevate(unit.id, 10)}
        >
          <MoveVertical className="size-3.5" />
        </button>
        <button
          className={btn}
          title="Align to nearest wall"
          onClick={() => actions.onAlignWall(unit.id)}
        >
          <AlignVerticalJustifyStart className="size-3.5" />
        </button>
        <button
          className={`${btn} ${unit.snap ? "text-primary" : ""}`}
          title={unit.snap ? "Snapping on — click to free-place" : "Free placement — click to snap"}
          onClick={() => actions.onToggleSnap(unit.id)}
        >
          <Magnet className="size-3.5" />
        </button>
        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
        <button className={btn} title="Duplicate unit" onClick={() => actions.onDuplicate(unit.id)}>
          <Copy className="size-3.5" />
        </button>
        <button
          className={`${btn} hover:text-destructive`}
          title="Delete unit"
          onClick={() => actions.onDelete(unit.id)}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </Html>
  );
}

const UnitMesh = memo(function UnitMesh({
  unit,
  selected,
  dragging,
  groupRef,
  onSelect,
  onDragStart,
  actions,
  interior,
  onFittingDown,
  onHandleDown,
  interactingRef,
  outLeft,
  outRight,
  showDimensions,
  drawersOpen = false,
  invalid,
  movable,
}: {
  unit: Unit;
  selected: boolean;
  dragging: boolean;
  groupRef: (g: THREE.Group | null) => void;
  onSelect: (additive?: boolean) => void;
  onDragStart: (e: ThreeEvent<PointerEvent>) => void;
  actions: Actions;
  interior: Interior;
  onFittingDown: (unit: Unit, f: Fitting, e: ThreeEvent<PointerEvent>) => void;
  onHandleDown: (unit: Unit, e: ThreeEvent<PointerEvent>) => void;
  /** Set while an interior fitting / handle is being dragged — blocks frame drags. */
  interactingRef: React.MutableRefObject<boolean>;
  /** Metres from this unit's left/right face to the outer edge of the whole assembly. */
  outLeft: number;
  outRight: number;
  showDimensions: boolean;
  drawersOpen?: boolean;
  invalid: boolean;
  movable: boolean;
}) {
  const f = finishOf(unit.finish);
  const W = unit.w / 100;
  const H = unit.h / 100;
  const D = unit.d / 100;
  const inner = W - 2 * P;
  const floating = (unit.y ?? 0) > 0;
  const plinth = floating ? 0 : 0.06;
  const lowHeight = unit.underStairs
    ? Math.max(0.4, Math.min(H - 0.1, (unit.slopeMinHeight ?? Math.round(unit.h * 0.5)) / 100))
    : H;
  const lowOnLeft = (unit.slopeSide ?? "right") === "left";
  const leftTop = lowOnLeft ? lowHeight : H;
  const rightTop = lowOnLeft ? H : lowHeight;
  const leftBody = Math.max(P * 2, leftTop - plinth);
  const rightBody = Math.max(P * 2, rightTop - plinth);
  const body = Math.min(leftBody, rightBody);
  const topLength = Math.hypot(W, rightTop - leftTop);
  const topAngle = Math.atan2(rightTop - leftTop, W);
  const backShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-inner / 2, 0);
    shape.lineTo(inner / 2, 0);
    shape.lineTo(inner / 2, rightBody);
    shape.lineTo(-inner / 2, leftBody);
    shape.closePath();
    return shape;
  }, [inner, leftBody, rightBody]);
  const drawerStackCm = drawerStackHeight(unit);
  const drawerStack = drawerStackCm / 100;
  const doorBody = Math.max(0.04, body - drawerStack - 0.006);
  const doorBase = plinth + drawerStack;
  const doorTop = doorBase + doorBody;
  const doorFrontZ = D / 2 + (drawerStack > 0 ? 0.026 : 0.01);
  const drawerFrontZ = D / 2 + 0.05;
  const drawerProgress = useRef(0);
  const drawerGroups = useRef<Array<THREE.Group | null>>([]);
  const drawerTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#9b8064";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 3; y < canvas.height; y += 7) {
      context.strokeStyle = y % 14 === 3 ? "rgba(60,42,28,.22)" : "rgba(255,240,210,.14)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, y);
      context.bezierCurveTo(32, y - 3, 86, y + 4, 128, y - 1);
      context.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.5, 1);
    return texture;
  }, []);
  useFrame((_, dt) => {
    const target = drawersOpen || unit.drawersOpen ? 1 : 0;
    drawerProgress.current = THREE.MathUtils.damp(drawerProgress.current, target, 9, dt);
    drawerGroups.current.forEach((group, index) => {
      if (group) group.position.z = drawerFrontZ + 0.18 * drawerProgress.current * (index + 1);
    });
  });
  const fittings = useMemo(() => fittingsOf(unit), [unit]);
  const appliances = unit.appliances ?? [];
  const base = innerBase(unit) / 100;
  const innerH = innerHeight(unit) / 100;
  const hasFront = unit.front !== "none";
  const handleY = Math.min(
    unit.h - 8,
    Math.max(plinth * 100 + 8, unit.handleY ?? Math.min(unit.h - 20, 100)),
  );
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;

  /**
   * Orbit controls start their own drag on the very same pointerdown, so the camera
   * has to be switched off synchronously — a React state update lands one frame late.
   */
  const lockCamera = () => {
    if (!controls) return;
    controls.enabled = false;
    const release = () => {
      controls.enabled = true;
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
  };

  if (unit.standaloneAppliance) {
    const appliance = unit.standaloneAppliance;
    return (
      <group
        ref={groupRef}
        position={[unit.x / 100, (unit.y ?? 0) / 100, unit.z / 100]}
        rotation={[0, (unit.rot * Math.PI) / 180, 0]}
        onPointerDown={(e) => {
          if (interactingRef?.current) return;
          e.stopPropagation();
          if (e.ctrlKey || e.metaKey) {
            onSelect(true);
            return;
          }
          if (movable && !interior.editInterior) onDragStart(e);
        }}
        onContextMenu={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[W, H, D]} />
          <meshStandardMaterial
            color={appliance === "fridge" ? "#cbd5dc" : "#d9d9d5"}
            roughness={0.32}
            metalness={0.2}
          />
        </mesh>
        <mesh position={[0, H * 0.48, D / 2 + 0.012]}>
          <boxGeometry args={[W * 0.78, Math.max(0.02, H * 0.03), 0.018]} />
          <meshStandardMaterial color="#555b5d" metalness={0.7} roughness={0.28} />
        </mesh>
        {selected && showDimensions && (
          <Html center position={[0, H + 0.12, D / 2]} distanceFactor={5}>
            <span className="rounded-full border border-primary/60 bg-card/90 px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm">
              {ITEM_META[appliance].name} · {unit.w} × {unit.h} × {unit.d} cm
            </span>
          </Html>
        )}
      </group>
    );
  }

  return (
    <group
      ref={groupRef}
      position={[unit.x / 100, (unit.y ?? 0) / 100, unit.z / 100]}
      rotation={[0, (unit.rot * Math.PI) / 180, 0]}
      onPointerDown={(e) => {
        // an interior fitting or handle grabbed the pointer first — never move the frame
        if (interactingRef?.current) return;
        e.stopPropagation();
        if (e.ctrlKey || e.metaKey) {
          onSelect(true);
          return;
        }
        if (!movable) return;
        if (!interior.editInterior) onDragStart(e);
      }}
      onContextMenu={(e) => {
        e.stopPropagation();
        onSelect();
        const nativeEvent = e.nativeEvent as PointerEvent;
        window.dispatchEvent(
          new CustomEvent("wardrobe-unit-context", {
            detail: { id: unit.id, x: nativeEvent.clientX, y: nativeEvent.clientY },
          }),
        );
      }}
    >
      {plinth > 0 && (
        <Panel
          size={[W - 0.02, plinth, D - 0.04]}
          position={[0, plinth / 2, 0]}
          color="#7d7a74"
          roughness={0.9}
        />
      )}
      {/* sides */}
      <Panel
        size={[P, leftBody, D]}
        position={[-W / 2 + P / 2, plinth + leftBody / 2, 0]}
        color={f.hex}
        roughness={f.roughness}
      />
      <Panel
        size={[P, rightBody, D]}
        position={[W / 2 - P / 2, plinth + rightBody / 2, 0]}
        color={f.hex}
        roughness={f.roughness}
      />
      {/* top + bottom */}
      <Panel
        size={[inner, P, D]}
        position={[0, plinth + P / 2, 0]}
        color={f.hex}
        roughness={f.roughness}
      />
      {unit.underStairs ? (
        <mesh
          position={[0, (leftTop + rightTop) / 2 - P / 2, 0]}
          rotation={[0, 0, topAngle]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[topLength, P, D]} />
          <meshStandardMaterial color={f.hex} roughness={f.roughness} />
        </mesh>
      ) : (
        <Panel
          size={[inner, P, D]}
          position={[0, H - P / 2, 0]}
          color={f.hex}
          roughness={f.roughness}
        />
      )}
      {/* back */}
      {unit.underStairs ? (
        <mesh position={[0, plinth, -D / 2 + 0.006]} receiveShadow>
          <extrudeGeometry args={[backShape, { depth: 0.008, bevelEnabled: false }]} />
          <meshStandardMaterial color={f.hex} roughness={0.85} />
        </mesh>
      ) : (
        <Panel
          size={[inner, body, 0.008]}
          position={[0, plinth + body / 2, -D / 2 + 0.006]}
          color={f.hex}
          roughness={0.85}
        />
      )}
      {/* interior fittings on the 32 mm hole matrix */}
      {fittings.map((fit) => {
        const meta = FITTING_META[fit.type];
        const y = base + (fit.y + meta.height / 2) / 100;
        const active = interior.selectedFitting === fit.id;
        const pick = (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          lockCamera();
          interior.onSelectFitting(fit.id);
          onFittingDown(unit, fit, e);
        };
        return (
          <group
            key={fit.id}
            position={[0, y, 0]}
            onPointerDown={pick}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = "grab";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "auto";
            }}
          >
            {/* generous invisible grab volume so any fitting is easy to catch with the mouse */}
            <mesh position={[0, 0, 0.01]}>
              <boxGeometry args={[inner, Math.max(0.14, meta.height / 100 + 0.06), D - 0.02]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {fit.type === "shelf" && (
              <Panel
                size={[inner, 0.018, D - 0.03]}
                position={[0, 0, 0.008]}
                color={f.hex}
                roughness={f.roughness}
              />
            )}
            {fit.type === "rail" && (
              <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.014, 0.014, inner, 16]} />
                <meshStandardMaterial color="#b9bec2" metalness={0.85} roughness={0.25} />
              </mesh>
            )}
            {fit.type === "drawer" && (
              <group>
                <Panel
                  size={[inner - 0.01, 0.014, D - 0.05]}
                  position={[0, -0.085, 0]}
                  color={f.hex}
                  roughness={f.roughness}
                />
                <Panel
                  size={[inner - 0.01, 0.16, 0.014]}
                  position={[0, 0, D / 2 - 0.045]}
                  color={f.hex}
                  roughness={f.roughness}
                />
                <Panel
                  size={[0.012, 0.16, D - 0.05]}
                  position={[-(inner - 0.01) / 2, 0, 0]}
                  color={f.hex}
                  roughness={f.roughness}
                />
                <Panel
                  size={[0.012, 0.16, D - 0.05]}
                  position={[(inner - 0.01) / 2, 0, 0]}
                  color={f.hex}
                  roughness={f.roughness}
                />
              </group>
            )}
            {fit.type === "basket" && (
              <group>
                <Panel
                  size={[inner - 0.02, 0.012, D - 0.06]}
                  position={[0, -0.07, 0]}
                  color="#b9bec2"
                  roughness={0.35}
                />
                <Panel
                  size={[inner - 0.02, 0.14, 0.01]}
                  position={[0, 0, D / 2 - 0.05]}
                  color="#b9bec2"
                  roughness={0.35}
                />
                <Panel
                  size={[inner - 0.02, 0.14, 0.01]}
                  position={[0, 0, -D / 2 + 0.05]}
                  color="#b9bec2"
                  roughness={0.35}
                />
                <Panel
                  size={[0.01, 0.14, D - 0.06]}
                  position={[-(inner - 0.02) / 2, 0, 0]}
                  color="#b9bec2"
                  roughness={0.35}
                />
                <Panel
                  size={[0.01, 0.14, D - 0.06]}
                  position={[(inner - 0.02) / 2, 0, 0]}
                  color="#b9bec2"
                  roughness={0.35}
                />
              </group>
            )}
            {fit.type === "shoerack" && (
              <group rotation={[-0.28, 0, 0]}>
                {[-0.045, 0.045].map((dz) => (
                  <mesh key={dz} rotation={[0, 0, Math.PI / 2]} position={[0, 0, dz]} castShadow>
                    <cylinderGeometry args={[0.008, 0.008, inner - 0.02, 12]} />
                    <meshStandardMaterial color="#b9bec2" metalness={0.8} roughness={0.3} />
                  </mesh>
                ))}
              </group>
            )}
            {fit.type === "cargo" && (
              <group>
                <Panel
                  size={[inner - 0.06, 1.16, 0.014]}
                  position={[0, 0, D / 2 - 0.05]}
                  color={f.hex}
                  roughness={f.roughness}
                />
                {[0, 1, 2, 3].map((i) => (
                  <Panel
                    key={i}
                    size={[inner - 0.08, 0.014, D - 0.09]}
                    position={[0, -0.5 + i * 0.33, 0]}
                    color={f.hex}
                    roughness={f.roughness}
                  />
                ))}
                {[-1, 1].map((s) => (
                  <mesh key={s} position={[(s * (inner - 0.07)) / 2, 0, 0]} castShadow>
                    <boxGeometry args={[0.012, 1.16, 0.04]} />
                    <meshStandardMaterial color="#9aa2a6" metalness={0.8} roughness={0.3} />
                  </mesh>
                ))}
              </group>
            )}
            {(interior.editInterior || active) && (
              <mesh position={[0, 0, 0.01]}>
                <boxGeometry args={[inner + 0.01, meta.height / 100 + 0.01, D - 0.02]} />
                <meshBasicMaterial
                  color={active ? "#6f9c82" : "#b6c3bb"}
                  wireframe
                  transparent
                  opacity={active ? 0.9 : 0.35}
                />
              </mesh>
            )}
            {active && showDimensions && (
              <Html center position={[inner / 2 + 0.34, 0.02, D / 2 + 0.1]} distanceFactor={5}>
                <span className="rounded-full border border-primary/60 bg-card/90 px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm backdrop-blur-sm">
                  {meta.name} · H: {Math.round(fit.y + innerBase(unit))} cm from base
                </span>
              </Html>
            )}
          </group>
        );
      })}
      {appliances.map((appliance) => {
        const applianceHeight = Math.min(ITEM_META[appliance.type].height, innerHeight(unit));
        const y = base + appliance.y / 100 + applianceHeight / 200;
        const applianceX = Math.max(
          -(W / 2 - 0.12),
          Math.min(W / 2 - 0.12, (appliance.x ?? 0) / 100),
        );
        const kitchenTop = unit.underStairs ? Math.min(leftTop, rightTop) : H;
        if (appliance.type === "sink" || appliance.type === "hob") {
          const isSink = appliance.type === "sink";
          return (
            <group key={appliance.id} position={[applianceX, kitchenTop + 0.012, 0]}>
              <Panel
                size={[
                  Math.max(0.34, Math.min(0.68, W - 0.16)),
                  0.025,
                  Math.max(0.34, Math.min(0.58, D - 0.16)),
                ]}
                position={[0, 0, 0]}
                color={isSink ? "#aeb9bb" : "#17191a"}
                roughness={isSink ? 0.28 : 0.2}
              />
              {isSink ? (
                <Panel
                  size={[
                    Math.max(0.24, Math.min(0.5, W - 0.3)),
                    0.018,
                    Math.max(0.22, Math.min(0.42, D - 0.28)),
                  ]}
                  position={[0, 0.018, 0]}
                  color="#657174"
                  roughness={0.25}
                />
              ) : (
                [-0.16, 0.16].flatMap((x) =>
                  [-0.13, 0.13].map((z) => (
                    <mesh
                      key={`${x}-${z}`}
                      position={[x, 0.026, z]}
                      rotation={[-Math.PI / 2, 0, 0]}
                    >
                      <torusGeometry args={[0.055, 0.008, 12, 24]} />
                      <meshStandardMaterial color="#64686a" metalness={0.55} roughness={0.26} />
                    </mesh>
                  )),
                )
              )}
            </group>
          );
        }
        return (
          <group key={appliance.id} position={[applianceX, y, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry
                args={[Math.max(0.2, W - 0.09), applianceHeight / 100, Math.max(0.2, D - 0.09)]}
              />
              <meshStandardMaterial
                color={appliance.type === "fridge" ? "#cbd5dc" : "#d9d9d5"}
                roughness={0.35}
                metalness={0.18}
              />
            </mesh>
          </group>
        );
      })}
      {unit.countertop && !unit.underStairs && (
        <Panel
          size={[W + 0.04, 0.045, D + 0.06]}
          position={[0, H + 0.022, 0]}
          color={
            unit.countertopMaterial === "wood"
              ? "#b98a58"
              : unit.countertopMaterial === "laminate"
                ? "#d9d1c4"
                : "#8c9390"
          }
          roughness={unit.countertopMaterial === "stone" ? 0.3 : 0.6}
        />
      )}
      {invalid && showDimensions && (
        <>
          <mesh position={[0, (unit.y ?? 0) / 100 + H / 2, 0]}>
            <boxGeometry args={[W + 0.035, H + 0.035, D + 0.035]} />
            <meshBasicMaterial color="#c74b4b" wireframe transparent opacity={0.95} />
          </mesh>
          <Html center position={[0, H + 0.16, D / 2 + 0.06]} distanceFactor={5}>
            <span className="whitespace-nowrap rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 shadow-sm">
              Check placement
            </span>
          </Html>
        </>
      )}
      {unit.backsplash && unit.countertop && !unit.underStairs && (
        <Panel
          size={[W + 0.04, (unit.backsplashHeight ?? 60) / 100, 0.025]}
          position={[0, H + 0.045 + (unit.backsplashHeight ?? 60) / 200, -D / 2 - 0.014]}
          color={
            unit.countertopMaterial === "wood"
              ? "#d4b17e"
              : unit.countertopMaterial === "laminate"
                ? "#eee9df"
                : "#c3c9c6"
          }
          roughness={unit.countertopMaterial === "stone" ? 0.36 : 0.58}
        />
      )}
      {unit.faucet && !unit.underStairs && (
        <group position={[0, H + 0.045, D * 0.18]}>
          <mesh position={[0, 0.09, 0]} castShadow>
            <cylinderGeometry args={[0.014, 0.014, 0.18, 16]} />
            <meshStandardMaterial color="#a9b1b3" metalness={0.9} roughness={0.18} />
          </mesh>
          <mesh position={[0.045, 0.17, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.014, 0.014, 0.09, 16]} />
            <meshStandardMaterial color="#a9b1b3" metalness={0.9} roughness={0.18} />
          </mesh>
        </group>
      )}
      {showDimensions && interior.editInterior && selected && innerH > 0 && (
        <DimLine
          from={[-W / 2 - 0.12, base, D / 2]}
          to={[-W / 2 - 0.12, base + innerH, D / 2]}
          label={`Interior · ${Math.round(innerHeight(unit))} cm`}
          labelOffset={[-0.26, 0, 0.24]}
        />
      )}
      {unit.light && (
        <Panel
          size={[inner * 0.8, 0.012, 0.05]}
          position={[0, (unit.underStairs ? Math.min(leftTop, rightTop) : H) - 0.05, D / 2 - 0.12]}
          color="#fff6e2"
          roughness={0.3}
        />
      )}

      {/* fronts */}
      {unit.drawers > 0 &&
        Array.from({ length: Math.max(1, unit.drawers || 3) }, (_, i) => {
          const n = Math.max(1, unit.drawers || 3);
          const dh = (unit.front === "drawers" ? body : drawerStack) / n - 0.006;
          const stackHeight = unit.front === "drawers" ? body : drawerStack;
          const faceY = plinth + (i + 0.5) * (stackHeight / n);
          return (
            <group
              key={i}
              ref={(group) => {
                drawerGroups.current[i] = group;
              }}
              position={[0, faceY, drawerFrontZ]}
            >
              {(drawersOpen || unit.drawersOpen) && (
                <>
                  <mesh position={[0, -dh * 0.3, -0.09]}>
                    <boxGeometry
                      args={[Math.max(0.12, W - 0.05), 0.018, Math.max(0.12, D * 0.55)]}
                    />
                    <meshStandardMaterial map={drawerTexture} color={f.hex} roughness={0.8} />
                  </mesh>
                  <mesh position={[-W * 0.18, -dh * 0.12, -0.02]}>
                    <boxGeometry
                      args={[Math.min(0.16, W * 0.22), Math.min(0.06, dh * 0.3), 0.08]}
                    />
                    <meshStandardMaterial map={drawerTexture} color="#b9a58e" roughness={0.9} />
                  </mesh>
                  <mesh position={[W * 0.18, -dh * 0.12, -0.02]}>
                    <boxGeometry
                      args={[Math.min(0.18, W * 0.26), Math.min(0.05, dh * 0.26), 0.07]}
                    />
                    <meshStandardMaterial map={drawerTexture} color="#879b91" roughness={0.9} />
                  </mesh>
                </>
              )}
              <Panel
                size={[W - 0.008, dh, 0.026]}
                position={[0, 0, 0]}
                color={f.hex}
                roughness={f.roughness}
              />
              <mesh position={[0, 0, 0.018]} castShadow>
                <boxGeometry args={[Math.min(0.22, W * 0.34), 0.012, 0.018]} />
                <meshStandardMaterial color="#9aa2a6" metalness={0.9} roughness={0.25} />
              </mesh>
            </group>
          );
        })}
      {(unit.front === "door" || unit.front === "double") &&
        (unit.front === "double" ? [-1, 1] : [0]).flatMap((s, li) => {
          const sections = Math.max(1, Math.min(3, unit.frontSections ?? 1));
          const sectionHeight = doorBody / sections - 0.006;
          return Array.from({ length: sections }, (_, section) => {
            const L = sectionSpec(unit, li, section);
            const sectionBase = doorBase + section * (doorBody / sections);
            const sectionTop = sectionBase + sectionHeight;
            const handleMin = sectionBase + 0.08;
            const handleMax = Math.max(handleMin, sectionTop - 0.08);
            const ly = Math.min(handleMax, Math.max(handleMin, L.handleY / 100));
            return (
              <DoorLeaf
                key={`${s}-${section}`}
                width={unit.front === "double" ? W / 2 - 0.006 : W - 0.008}
                height={sectionHeight}
                x={unit.front === "double" ? (s * W) / 4 : 0}
                y={sectionBase + sectionHeight / 2}
                z={doorFrontZ}
                hinge={L.hinge}
                open={L.open}
                mode={L.mode}
                color={f.hex}
                roughness={f.roughness}
                material={L.material}
                style={L.style}
                handle={{
                  style: L.handleStyle,
                  pos: L.handlePos,
                  worldY: ly,
                  onPointerDown: (e) => {
                    e.stopPropagation();
                    lockCamera();
                    interior.onSelectDoor(unit.id);
                    onHandleDown(unit, e);
                  },
                }}
              />
            );
          });
        })}
      {unit.front === "glass" &&
        Array.from({ length: Math.max(1, Math.min(3, unit.frontSections ?? 1)) }, (_, section) => {
          const sections = Math.max(1, Math.min(3, unit.frontSections ?? 1));
          const sectionHeight = doorBody / sections - 0.006;
          const sectionBase = doorBase + section * (doorBody / sections);
          const sectionTop = sectionBase + sectionHeight;
          const L = sectionSpec(unit, 0, section);
          return (
            <DoorLeaf
              key={`glass-${section}`}
              width={W - 0.008}
              height={sectionHeight}
              x={0}
              y={sectionBase + sectionHeight / 2}
              z={doorFrontZ}
              hinge={L.hinge}
              open={L.open}
              mode={L.mode}
              color={f.hex}
              roughness={f.roughness}
              material={L.material !== "solid" ? L.material : "clear"}
              style={L.style}
              handle={{
                style: L.handleStyle,
                pos: L.handlePos,
                worldY: Math.min(
                  Math.max(sectionBase + 0.08, sectionTop - 0.08),
                  Math.max(sectionBase + 0.08, L.handleY / 100),
                ),
                onPointerDown: (e) => {
                  e.stopPropagation();
                  lockCamera();
                  interior.onSelectDoor(unit.id);
                  onHandleDown(unit, e);
                },
              }}
            />
          );
        })}

      {/* selection outline */}
      {(selected || dragging) && (
        <mesh position={[0, H / 2, 0]} raycast={() => null}>
          <boxGeometry args={[W + 0.02, H + 0.02, D + 0.02]} />
          <meshBasicMaterial
            color={interior.editInterior ? "#c08a4a" : "#6f9c82"}
            wireframe
            transparent
            opacity={0.75}
          />
        </mesh>
      )}
      {selected && <UnitToolbar unit={unit} actions={actions} interior={interior} />}
      {showDimensions && selected && (
        <DimLine
          from={[-W / 2, 0.004, D / 2 + 0.06]}
          to={[W / 2, 0.004, D / 2 + 0.06]}
          label={`W · ${unit.w} cm`}
          labelOffset={[0, -0.02, 0.42]}
        />
      )}
      {showDimensions && selected && (
        <DimLine
          from={[W / 2 + 0.05, 0, D / 2]}
          to={[W / 2 + 0.05, H, D / 2]}
          label={`H · ${unit.h} cm`}
          labelOffset={[outRight + 0.3, 0, 0.3]}
        />
      )}
      {showDimensions && selected && floating && (
        <DimLine
          from={[-W / 2 - 0.05, -(unit.y ?? 0) / 100, D / 2]}
          to={[-W / 2 - 0.05, 0, D / 2]}
          label={`Clearance · ${unit.y} cm`}
          labelOffset={[-(outLeft + 0.3), 0, 0.3]}
        />
      )}
    </group>
  );
});

export default function ModularScene({
  units,
  room,
  selectedId,
  selectedIds = [],
  onSelect,
  onMove,
  onTransform,
  actions,
  interior,
  showDimensions,
  drawersOpen = false,
  invalidUnitIds = [],
}: {
  units: Unit[];
  room: ModularRoom;
  selectedId: string | null;
  selectedIds?: string[];
  onSelect: (id: string | null, additive?: boolean) => void;
  onMove: (id: string, x: number, z: number) => void;
  onTransform: (id: string, x: number, y: number, z: number) => void;
  actions: Actions;
  interior: Interior;
  showDimensions: boolean;
  drawersOpen?: boolean;
  invalidUnitIds?: string[];
}) {
  const [drag, setDrag] = useState<{ id: string; dx: number; dz: number } | null>(null);
  const [armedUnitId, setArmedUnitId] = useState<string | null>(null);
  const [fitDrag, setFitDrag] = useState<{ unitId: string; fittingId: string } | null>(null);
  const [handleDrag, setHandleDrag] = useState<{ unitId: string } | null>(null);
  /** Synchronous guard: the fitting handler runs before the frame handler in the same event. */
  const interactingRef = useRef(false);
  const [gizmoTarget, setGizmoTarget] = useState<THREE.Group | null>(null);
  const [focus, setFocus] = useState<FocusRequest>(null);
  const isMobile = useIsMobile();
  const plane = useRef<THREE.Mesh>(null);
  const groups = useRef<Record<string, THREE.Group | null>>({});

  /** Centre the camera on a unit (double-click or the F key). */
  const focusUnit = (id: string | null) => {
    const u = units.find((x) => x.id === id);
    if (!u) return;
    setFocus({
      point: [u.x / 100, (u.y ?? 0) / 100 + u.h / 200 - 0.9, u.z / 100],
      distance: Math.max(1.6, (u.w / 100) * 2.4),
      key: Date.now(),
    });
  };

  const resetView = () => {
    setFocus({
      point: [0, tallest * 0.4 - 0.9, 0],
      distance: Math.max(3.2, span * 1.35),
      key: Date.now(),
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "f" || e.key === "F") focusUnit(selectedId);
      if (e.key === "r" || e.key === "R") resetView();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, units]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setGizmoTarget(
      selectedId && !interior.editInterior && !fitDrag && !handleDrag
        ? (groups.current[selectedId] ?? null)
        : null,
    );
  }, [selectedId, units.length, interior.editInterior, fitDrag, handleDrag]);

  // Frame the whole assembly: widest extent left↔right plus a comfortable margin.
  const span = Math.max(
    room.width / 100,
    units.reduce((s, u) => Math.max(s, Math.abs(u.x / 100) + u.w / 200), 0.9) * 2.6,
  );
  const tallest = Math.max(room.height / 100, ...units.map((u) => (u.y ?? 0) / 100 + u.h / 100));

  const startDrag = (u: Unit) => (e: ThreeEvent<PointerEvent>) => {
    setDrag({ id: u.id, dx: u.x / 100 - e.point.x, dz: u.z / 100 - e.point.z });
  };

  /** Vertical drag plane in front of the assembly, used for fittings + handles. */
  const dragPlaneZ = Math.max(0.9, ...units.map((u) => u.z / 100 + u.d / 200 + 0.35));

  const onDragPlaneMove = (e: ThreeEvent<PointerEvent>) => {
    if (!fitDrag && !handleDrag) return;
    e.stopPropagation();
    const worldY = (e.point.y + 0.9) * 100; // undo the scene offset group
    if (handleDrag) {
      const u = units.find((x) => x.id === handleDrag.unitId);
      if (u) interior.onMoveHandle(u.id, worldY - (u.y ?? 0));
      return;
    }
    const u = units.find((x) => x.id === fitDrag!.unitId);
    if (!u) return;
    // horizontal position decides which cabinet (bay) receives the fitting
    const px = e.point.x * 100;
    const target = units.find((o) => Math.abs(px - o.x) <= o.w / 2) ?? u;
    const y = worldY - (target.y ?? 0) - innerBase(target);
    interior.onMoveFitting(u.id, fitDrag!.fittingId, y, target.id);
    if (target.id !== u.id) setFitDrag({ unitId: target.id, fittingId: fitDrag!.fittingId });
  };

  const endInteriorDrag = () => {
    interactingRef.current = false;
    setFitDrag(null);
    setHandleDrag(null);
  };

  /** A pointer released anywhere (also outside the canvas) always ends the interior drag. */
  useEffect(() => {
    const up = () => endInteriorDrag();
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  /** Outer X extents of the whole assembly, in cm — keeps labels clear of every cabinet. */
  const bounds = useMemo(
    () => ({
      min: units.length ? Math.min(...units.map((u) => u.x - u.w / 2)) : 0,
      max: units.length ? Math.max(...units.map((u) => u.x + u.w / 2)) : 0,
    }),
    [units],
  );

  const commitGizmo = () => {
    if (!selectedId) return;
    const g = groups.current[selectedId];
    const moving = units.find((u) => u.id === selectedId);
    if (!g || !moving) return;
    const raw = {
      ...moving,
      x: g.position.x * 100,
      y: Math.max(0, g.position.y * 100),
      z: g.position.z * 100,
    };
    const snapped = snapUnitToRoom(raw, units, room);
    onTransform(selectedId, snapped.x, snapElevation({ ...snapped, y: raw.y }, units), snapped.z);
  };

  return (
    <Canvas
      shadows={!isMobile}
      dpr={isMobile ? [1, 1.35] : [1, 1.75]}
      camera={{ position: [span * 0.75, tallest * 1.25 + 1.05, 3.5 + span * 1.35], fov: 48 }}
      onPointerMissed={() => {
        setArmedUnitId(null);
        onSelect(null);
      }}
      gl={{ antialias: !isMobile, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#f7f4ef"]} />
      <fog attach="fog" args={["#f7f4ef", 12, 36]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#fff4e0", "#e6e0d6", 0.5]} />
      <directionalLight
        position={[3.2, 5.2, 3.4]}
        intensity={2.1}
        color="#fff2df"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-4, 3, -2.5]} intensity={0.45} color="#eaf1ff" />

      <group position={[0, -0.9, 0]}>
        <RoomShell room={room} showDimensions={showDimensions} />
        {/* invisible floor used as the drag target */}
        <mesh
          ref={plane}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          onPointerMove={(e) => {
            if (!drag) return;
            e.stopPropagation();
            const moving = units.find((u) => u.id === drag.id);
            if (!moving) return;
            const raw = {
              ...moving,
              x: (e.point.x + drag.dx) * 100,
              z: (e.point.z + drag.dz) * 100,
            };
            const snapped = snapUnitToRoom(raw, units, room);
            onMove(drag.id, snapped.x, snapped.z);
          }}
          onPointerUp={() => setDrag(null)}
          onPointerLeave={() => setDrag(null)}
        >
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#f1ede6" roughness={0.9} metalness={0.05} />
        </mesh>

        {units.map((u) => (
          <group
            key={u.id}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setArmedUnitId(u.id);
              onSelect(u.id);
            }}
          >
            <UnitMesh
              unit={u}
              selected={selectedId === u.id || selectedIds.includes(u.id)}
              dragging={drag?.id === u.id}
              groupRef={(g) => {
                groups.current[u.id] = g;
              }}
              onSelect={(additive) => onSelect(u.id, additive)}
              onDragStart={startDrag(u)}
              actions={actions}
              interior={interior}
              interactingRef={interactingRef}
              onFittingDown={(unit, f) => {
                interactingRef.current = true;
                onSelect(unit.id);
                setFitDrag({ unitId: unit.id, fittingId: f.id });
              }}
              onHandleDown={(unit) => {
                interactingRef.current = true;
                setHandleDrag({ unitId: unit.id });
              }}
              outLeft={Math.max(0, u.x - u.w / 2 - bounds.min) / 100}
              outRight={Math.max(0, bounds.max - (u.x + u.w / 2)) / 100}
              showDimensions={showDimensions}
              drawersOpen={drawersOpen}
              invalid={invalidUnitIds.includes(u.id)}
              movable={armedUnitId === u.id}
            />
          </group>
        ))}

        {(fitDrag || handleDrag) && (
          <mesh
            position={[0, 1.4, dragPlaneZ]}
            onPointerMove={onDragPlaneMove}
            onPointerUp={endInteriorDrag}
            onPointerLeave={endInteriorDrag}
          >
            <planeGeometry args={[60, 24]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}

        {gizmoTarget && !fitDrag && !handleDrag && (
          <TransformControls
            object={gizmoTarget}
            mode="translate"
            size={isMobile ? 1.35 : 0.75}
            translationSnap={0.01}
            onMouseUp={commitGizmo}
            onObjectChange={commitGizmo}
          />
        )}

        <ContactShadows
          position={[0, 0.003, 0]}
          opacity={0.42}
          scale={18}
          blur={2.6}
          far={4}
          resolution={1024}
        />
        <Grid
          args={[26, 26]}
          cellSize={0.25}
          cellColor="#e0dbd2"
          sectionSize={1}
          sectionColor="#cbc4b8"
          fadeDistance={20}
          infiniteGrid
        />
      </group>

      <Suspense fallback={null}>
        <CameraRig
          enabled={!drag && !fitDrag && !handleDrag}
          touch={isMobile}
          focus={focus}
          minDistance={1.4}
          maxDistance={20}
          target={[0, tallest * 0.4 - 0.9, 0]}
        />
      </Suspense>
    </Canvas>
  );
}
