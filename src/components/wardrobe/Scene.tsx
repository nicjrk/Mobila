import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Environment, ContactShadows, Grid, Html, Line } from "@react-three/drei";
import {
  createContext,
  lazy,
  memo,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import type { FocusRequest } from "./CameraRig";

const CameraRig = lazy(() => import("./CameraRig"));
import { useIsMobile } from "@/hooks/use-mobile";
import {
  FINISHES,
  FRIDGE_W,
  ITEM_META,
  bayCount,
  bayHeights,
  bayOffsets,
  bayWidths,
  doorMaterialOf,
  doorModeOf,
  fridgeBay,
  heightAtCm,
  gridCells,
  isGrid,
  colHeight,
  colDepth,
  moduleOf,
  slopeAngle,
  slopeOf,
  handleOf,
  doorPartsOf,
  runWidth,
  wallSpec,
  type Config,
  type DoorMaterial,
  type HandleStyle,
  cellKey,
  type InteriorItem,
  type WallId,
} from "@/lib/wardrobe";

const T = 0.018; // panel thickness (m)
const cm = (v: number) => v / 100;
const createWoodTexture = () => {
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
};
const DimensionsContext = createContext(true);

export type DoorSel = { wall: WallId; bay: number; part?: number } | null;
type Sel = { kind: "item"; id: string } | null;
type Drag = { id: string; bay: number; y: number; out: boolean } | null;

const DRAGGABLE: InteriorItem["type"][] = ["shelf", "rail", "drawer", "basket", "washer"];

const Panel = memo(function Panel({
  size,
  position,
  color,
  roughness,
  highlight,
  ...rest
}: {
  size: [number, number, number];
  position: [number, number, number];
  color: string;
  roughness: number;
  highlight?: "none" | "hover" | "select";
} & Record<string, unknown>) {
  const emissive =
    highlight === "select" ? "#2f6d5a" : highlight === "hover" ? "#7fa99b" : "#000000";
  return (
    <mesh position={position} castShadow receiveShadow {...rest}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={0.04}
        emissive={emissive}
        emissiveIntensity={highlight && highlight !== "none" ? 0.35 : 0}
      />
    </mesh>
  );
});

/** Rear enclosure panel whose top edge follows the Under-Stairs slope. */
const SlopedBackPanel = memo(function SlopedBackPanel({
  x,
  y,
  width,
  heightLeft,
  heightRight,
  z,
  color,
  roughness,
}: {
  x: number;
  y: number;
  width: number;
  heightLeft: number;
  heightRight: number;
  z: number;
  color: string;
  roughness: number;
}) {
  const shape = useMemo(() => {
    const next = new THREE.Shape();
    next.moveTo(0, 0);
    next.lineTo(width, 0);
    next.lineTo(width, heightRight);
    next.lineTo(0, heightLeft);
    next.closePath();
    return next;
  }, [heightLeft, heightRight, width]);

  return (
    <mesh position={[x, y, z]} receiveShadow>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={0.04}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
});

function Interior({
  item,
  bayW,
  bayX,
  depth,
  color,
  roughness,
  sel,
  setSel,
  onDragStart,
  dragging,
  openDoors,
}: {
  item: InteriorItem;
  bayW: number;
  bayX: number;
  depth: number;
  color: string;
  roughness: number;
  sel: Sel;
  setSel: (s: Sel) => void;
  onDragStart?: (item: InteriorItem) => void;
  dragging?: boolean;
  openDoors?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const state =
    dragging || (sel?.kind === "item" && sel.id === item.id) ? "select" : hover ? "hover" : "none";
  const y = cm(item.y);
  const w = bayW - 2 * T;
  const d = depth - 0.04;
  const handlers = {
    onPointerOver: (e: THREE.Event) => {
      (e as unknown as { stopPropagation: () => void }).stopPropagation();
      setHover(true);
    },
    onPointerOut: () => setHover(false),
    onClick: (e: THREE.Event) => {
      (e as unknown as { stopPropagation: () => void }).stopPropagation();
      setSel({ kind: "item", id: item.id });
    },
    onPointerDown: (e: THREE.Event) => {
      if (!onDragStart || !DRAGGABLE.includes(item.type)) return;
      (e as unknown as { stopPropagation: () => void }).stopPropagation();
      setSel({ kind: "item", id: item.id });
      onDragStart(item);
    },
  };

  if (item.type === "fridge") {
    const h = cm(Math.min(ITEM_META.fridge.height, 200));
    return (
      <group {...handlers}>
        {/* appliance body */}
        <mesh position={[bayX, y + h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[w - 0.008, h, d - 0.01]} />
          <meshStandardMaterial color="#d7dadd" roughness={0.35} metalness={0.55} />
        </mesh>
        {/* fridge / freezer split line */}
        <mesh position={[bayX, y + h * 0.7, (d - 0.01) / 2 + 0.004]}>
          <boxGeometry args={[w - 0.02, 0.008, 0.006]} />
          <meshStandardMaterial color="#9aa0a6" roughness={0.4} metalness={0.7} />
        </mesh>
        {[0.35, 0.85].map((f) => (
          <mesh key={f} position={[bayX + w * 0.32, y + h * f, (d - 0.01) / 2 + 0.012]}>
            <boxGeometry args={[0.02, 0.16, 0.02]} />
            <meshStandardMaterial color="#8b9095" roughness={0.25} metalness={0.9} />
          </mesh>
        ))}
      </group>
    );
  }

  if (item.type === "washer") {
    const h = cm(ITEM_META.washer.height);
    const frontZ = d / 2 + 0.014;
    return (
      <group {...handlers}>
        <mesh position={[bayX, y + h / 2, d * 0.02]} castShadow receiveShadow>
          <boxGeometry args={[w - 0.008, h, d - 0.01]} />
          <meshStandardMaterial
            color="#d6d8d7"
            roughness={0.3}
            metalness={0.45}
            emissive={state === "select" ? "#2f6d5a" : state === "hover" ? "#7fa99b" : "#000"}
            emissiveIntensity={state === "none" ? 0 : 0.3}
          />
        </mesh>
        <mesh position={[bayX, y + h * 0.72, frontZ]}>
          <boxGeometry args={[w * 0.72, h * 0.1, 0.012]} />
          <meshStandardMaterial color="#252a2b" roughness={0.25} metalness={0.2} />
        </mesh>
        <mesh position={[bayX, y + h * 0.4, frontZ + 0.006]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[Math.min(w, h) * 0.27, Math.min(w, h) * 0.27, 0.012, 32]} />
          <meshStandardMaterial color="#344244" roughness={0.16} metalness={0.3} />
        </mesh>
        <mesh position={[bayX, y + h * 0.4, frontZ + 0.014]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[Math.min(w, h) * 0.27, 0.012, 10, 32]} />
          <meshStandardMaterial color="#aeb4b2" roughness={0.24} metalness={0.7} />
        </mesh>
      </group>
    );
  }

  if (item.type === "cargo") {
    const ch = Math.min(cm(ITEM_META.cargo.height), 1.8);
    const out = openDoors ? d * 0.55 : 0;
    const trays = [0.15, 0.45, 0.75].map((f) => ch * f);
    return (
      <group {...handlers} position={[0, 0, out]}>
        <mesh position={[bayX, y + 0.01, 0]} castShadow>
          <boxGeometry args={[w - 0.04, 0.02, d - 0.03]} />
          <meshStandardMaterial color="#7e858b" roughness={0.35} metalness={0.8} />
        </mesh>
        {[-1, 1].map((sgn) => (
          <mesh key={sgn} position={[bayX + sgn * (w / 2 - 0.03), y + ch / 2, 0]} castShadow>
            <boxGeometry args={[0.016, ch, 0.016]} />
            <meshStandardMaterial
              color="#8b9095"
              roughness={0.3}
              metalness={0.85}
              emissive={state === "select" ? "#2f6d5a" : state === "hover" ? "#7fa99b" : "#000"}
              emissiveIntensity={state === "none" ? 0 : 0.4}
            />
          </mesh>
        ))}
        {trays.map((t) => (
          <mesh key={t} position={[bayX, y + t, 0]} castShadow>
            <boxGeometry args={[w - 0.05, 0.012, d - 0.05]} />
            <meshStandardMaterial
              color="#9aa0a6"
              roughness={0.35}
              metalness={0.7}
              transparent
              opacity={0.85}
            />
          </mesh>
        ))}
      </group>
    );
  }

  if (item.type === "shelf")
    return (
      <Panel
        size={[w, T, d]}
        position={[bayX, y, 0]}
        color={color}
        roughness={roughness}
        highlight={state}
        {...handlers}
      />
    );

  if (item.type === "rail")
    return (
      <group {...handlers}>
        <mesh position={[bayX, y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.014, 0.014, w, 20]} />
          <meshStandardMaterial
            color="#b9bcc0"
            roughness={0.25}
            metalness={0.9}
            emissive={state === "select" ? "#2f6d5a" : state === "hover" ? "#7fa99b" : "#000"}
            emissiveIntensity={state === "none" ? 0 : 0.4}
          />
        </mesh>
      </group>
    );

  const h = cm(ITEM_META[item.type].height);
  const isBasket = item.type === "basket";
  return (
    <group {...handlers}>
      <mesh position={[bayX, y + h / 2, d * 0.02]} castShadow receiveShadow>
        <boxGeometry args={[w - 0.01, h, d - 0.02]} />
        <meshStandardMaterial
          color={isBasket ? "#9aa0a6" : color}
          roughness={isBasket ? 0.35 : roughness}
          metalness={isBasket ? 0.7 : 0.05}
          transparent={isBasket}
          opacity={isBasket ? 0.75 : 1}
          emissive={state === "select" ? "#2f6d5a" : state === "hover" ? "#7fa99b" : "#000"}
          emissiveIntensity={state === "none" ? 0 : 0.35}
        />
      </mesh>
      {!isBasket && (
        <mesh position={[bayX, y + h / 2, d / 2 + 0.012]}>
          <boxGeometry args={[w * 0.4, 0.014, 0.02]} />
          <meshStandardMaterial color="#8b8f94" roughness={0.3} metalness={0.8} />
        </mesh>
      )}
    </group>
  );
}

function Light({ bayX, bayW, y, depth }: { bayX: number; bayW: number; y: number; depth: number }) {
  return (
    <group>
      <mesh position={[bayX, y, -depth * 0.1]}>
        <boxGeometry args={[bayW * 0.7, 0.02, 0.05]} />
        <meshStandardMaterial color="#fffaf0" emissive="#fff2cc" emissiveIntensity={2.2} />
      </mesh>
      <pointLight position={[bayX, y - 0.05, 0]} intensity={0.6} distance={1.6} color="#ffe9c4" />
    </group>
  );
}

/** The visible skin of a single door leaf, driven by its material. */
function DoorSkin({
  material,
  w,
  h,
  color,
  roughness,
  style,
  emissive,
  ei,
}: {
  material: DoorMaterial;
  w: number;
  h: number;
  color: string;
  roughness: number;
  style: Config["doorStyle"];
  emissive: string;
  ei: number;
}) {
  const ribs = useMemo(() => {
    const n = Math.max(6, Math.round(w / 0.045));
    return Array.from({ length: n }, (_, i) => -w / 2 + (w / n) * (i + 0.5));
  }, [w]);

  if (material === "mirror")
    return (
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w - 0.006, h, T]} />
        <meshStandardMaterial
          color="#eef3f6"
          roughness={0.04}
          metalness={1}
          envMapIntensity={1.8}
          emissive={emissive}
          emissiveIntensity={ei}
        />
      </mesh>
    );

  if (
    material === "clear" ||
    material === "smoked" ||
    material === "fluted" ||
    material === "alu"
  ) {
    const glass = material === "alu" ? "clear" : material;
    const inset = material === "alu" ? 0.05 : 0;
    const gw = w - 0.006 - inset * 2;
    const gh = h - inset * 2;
    return (
      <group>
        <mesh castShadow>
          <boxGeometry args={[gw, gh, T * 0.7]} />
          <meshPhysicalMaterial
            color={glass === "smoked" ? "#4d5458" : "#dfeef0"}
            roughness={glass === "fluted" ? 0.28 : 0.06}
            transmission={glass === "smoked" ? 0.55 : glass === "fluted" ? 0.7 : 0.9}
            thickness={0.35}
            ior={1.5}
            transparent
            opacity={glass === "smoked" ? 0.6 : 0.42}
            emissive={emissive}
            emissiveIntensity={ei}
          />
        </mesh>
        {glass === "fluted" &&
          ribs.map((x) => (
            <mesh key={x} position={[x, 0, T * 0.45]}>
              <cylinderGeometry args={[0.011, 0.011, gh, 10, 1, false, 0, Math.PI]} />
              <meshPhysicalMaterial
                color="#e8f2f2"
                roughness={0.12}
                transmission={0.8}
                thickness={0.2}
                transparent
                opacity={0.5}
              />
            </mesh>
          ))}
        {material === "alu" && (
          <group>
            {[
              { p: [0, gh / 2 + inset / 2, 0], s: [w - 0.006, inset, T] },
              { p: [0, -gh / 2 - inset / 2, 0], s: [w - 0.006, inset, T] },
              { p: [-gw / 2 - inset / 2, 0, 0], s: [inset, h, T] },
              { p: [gw / 2 + inset / 2, 0, 0], s: [inset, h, T] },
            ].map((f, i) => (
              <mesh key={i} position={f.p as [number, number, number]} castShadow>
                <boxGeometry args={f.s as [number, number, number]} />
                <meshStandardMaterial color="#a8afb5" roughness={0.3} metalness={0.95} />
              </mesh>
            ))}
          </group>
        )}
      </group>
    );
  }

  // solid panel — follows global door style
  return (
    <group>
      {style === "glass" ? (
        <mesh castShadow>
          <boxGeometry args={[w - 0.006, h, T]} />
          <meshPhysicalMaterial
            color="#dfe7e6"
            roughness={0.35}
            transmission={0.7}
            thickness={0.4}
            transparent
            opacity={0.6}
            emissive={emissive}
            emissiveIntensity={ei}
          />
        </mesh>
      ) : (
        <mesh castShadow receiveShadow>
          <boxGeometry args={[w - 0.006, h, T]} />
          <meshStandardMaterial
            color={color}
            roughness={roughness}
            metalness={0.05}
            emissive={emissive}
            emissiveIntensity={ei}
          />
        </mesh>
      )}
      {(style === "framed" || style === "flat") && (
        <group position={[0, 0, T / 2 + 0.004]}>
          {style === "framed" ? (
            <mesh>
              <boxGeometry args={[Math.max(0.05, w - 0.1), Math.max(0.05, h - 0.1), 0.008]} />
              <meshStandardMaterial color={color} roughness={Math.min(1, roughness + 0.15)} />
            </mesh>
          ) : (
            <>
              <mesh position={[0, h / 2 - 0.018, 0]}>
                <boxGeometry args={[Math.max(0.05, w - 0.04), 0.012, 0.008]} />
                <meshStandardMaterial color="#77756e" roughness={0.65} />
              </mesh>
              <mesh position={[0, -h / 2 + 0.018, 0]}>
                <boxGeometry args={[Math.max(0.05, w - 0.04), 0.012, 0.008]} />
                <meshStandardMaterial color="#77756e" roughness={0.65} />
              </mesh>
              <mesh position={[-w / 2 + 0.018, 0, 0]}>
                <boxGeometry args={[0.012, Math.max(0.05, h - 0.04), 0.008]} />
                <meshStandardMaterial color="#77756e" roughness={0.65} />
              </mesh>
              <mesh position={[w / 2 - 0.018, 0, 0]}>
                <boxGeometry args={[0.012, Math.max(0.05, h - 0.04), 0.008]} />
                <meshStandardMaterial color="#77756e" roughness={0.65} />
              </mesh>
            </>
          )}
        </group>
      )}
    </group>
  );
}

function Door({
  x,
  yCenter,
  hinge,
  w,
  h,
  z,
  color,
  roughness,
  style,
  material,
  handleSide,
  handleAlign,
  handlePosition,
  handleStyle = "bar",
  open,
  selected,
  onSelect,
}: {
  x: number;
  yCenter: number;
  hinge: 1 | -1;
  w: number;
  h: number;
  z: number;
  color: string;
  roughness: number;
  style: Config["doorStyle"];
  material: DoorMaterial;
  handleSide: "left" | "right" | "push";
  handleAlign: "center" | "top" | "bottom" | "profile";
  handlePosition?: number | undefined;
  handleStyle?: HandleStyle;
  open: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  // hinge -1 = hinged on the left edge, +1 = hinged on the right edge.
  const target = open || (handleSide === "push" && pushOpen) ? (hinge * Math.PI) / 2 : 0;
  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.rotation.y += (target - group.current.rotation.y) * Math.min(1, dt * 6);
  });
  const state = selected ? "select" : hover ? "hover" : "none";
  const emissive = state === "select" ? "#2f6d5a" : state === "hover" ? "#7fa99b" : "#000";
  const ei = state === "none" ? 0 : 0.3;
  // pivot sits exactly on the hinged edge; the leaf is offset back to the bay centre
  const pivotX = hinge === -1 ? x : x + w;
  const leafOffset = hinge === -1 ? w / 2 : -w / 2;
  const handleX = handleSide === "left" ? -(w / 2 - 0.035) : w / 2 - 0.035;

  return (
    <group position={[pivotX, yCenter, z]} ref={group}>
      <group
        position={[leafOffset, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
        onClick={(e) => {
          e.stopPropagation();
          if (handleSide === "push") setPushOpen((value) => !value);
          onSelect();
        }}
      >
        <DoorSkin
          material={material}
          w={w}
          h={h}
          color={color}
          roughness={roughness}
          style={style}
          emissive={emissive}
          ei={ei}
        />
        {handleSide !== "push" && (
          <Handle
            x={handleX}
            h={h}
            w={w}
            align={handleAlign}
            position={handlePosition}
            style={handleStyle}
          />
        )}
      </group>
    </group>
  );
}

function Handle({
  x,
  h,
  w,
  align,
  position,
  style = "bar",
}: {
  x: number;
  h: number;
  w: number;
  align: "center" | "top" | "bottom" | "profile";
  position?: number | undefined;
  style?: HandleStyle;
}) {
  const z = T / 2 + 0.02;
  const mat = <meshStandardMaterial color="#adb2b7" roughness={0.25} metalness={0.9} />;
  if (style === "push") return null;
  if (style === "knob")
    return (
      <mesh
        position={[
          x,
          position != null
            ? Math.max(-h / 2 + 0.08, Math.min(h / 2 - 0.08, h * (position / 100 - 0.5)))
            : align === "top"
              ? h / 2 - 0.1
              : align === "bottom"
                ? -h / 2 + 0.1
                : 0,
          z,
        ]}
      >
        <sphereGeometry args={[0.035, 16, 12]} />
        {mat}
      </mesh>
    );
  if (style === "edge")
    return (
      <mesh position={[x, 0, z]}>
        <boxGeometry args={[0.018, Math.max(0.12, h - 0.08), 0.018]} />
        {mat}
      </mesh>
    );
  if (style === "profile" || align === "profile")
    return (
      <mesh position={[x, 0, z]}>
        <boxGeometry args={[0.022, Math.max(0.1, h - 0.05), 0.022]} />
        {mat}
      </mesh>
    );
  if (align === "center")
    return (
      <mesh
        position={[
          x,
          position != null
            ? Math.max(-h / 2 + 0.08, Math.min(h / 2 - 0.08, h * (position / 100 - 0.5)))
            : 0,
          z,
        ]}
      >
        <cylinderGeometry args={[0.008, 0.008, Math.min(0.24, h * 0.55), 16]} />
        {mat}
      </mesh>
    );
  const y =
    position != null
      ? Math.max(-h / 2 + 0.08, Math.min(h / 2 - 0.08, h * (position / 100 - 0.5)))
      : align === "top"
        ? h / 2 - 0.09
        : -h / 2 + 0.09;
  return (
    <mesh position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.008, 0.008, Math.min(0.18, w * 0.5), 16]} />
      {mat}
    </mesh>
  );
}

/** Trapezoid outline of a panel cut at the stair pitch (local origin = bottom centre). */
function pitchShape(w: number, hL: number, hR: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, hR);
  s.lineTo(-w / 2, hL);
  s.closePath();
  return s;
}

/** Hinged door leaf sliced at the slope; handle stays clear of the angled edge. */
function SlopedDoor({
  x,
  yBottom,
  hinge,
  w,
  hL,
  hR,
  z,
  color,
  roughness,
  material,
  handleSide,
  handleAlign,
  handlePosition,
  handleStyle = "bar",
  open,
  selected,
  onSelect,
}: {
  x: number;
  yBottom: number;
  hinge: 1 | -1;
  w: number;
  hL: number;
  hR: number;
  z: number;
  color: string;
  roughness: number;
  material: DoorMaterial;
  handleSide: "left" | "right" | "push";
  handleAlign: "center" | "top" | "bottom" | "profile";
  handlePosition?: number | undefined;
  handleStyle?: HandleStyle;
  open: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  const target = open || (handleSide === "push" && pushOpen) ? (hinge * Math.PI) / 2 : 0;
  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.rotation.y += (target - group.current.rotation.y) * Math.min(1, dt * 6);
  });
  const shape = useMemo(() => pitchShape(w - 0.006, hL, hR), [w, hL, hR]);
  const state = selected ? "select" : hover ? "hover" : "none";
  const emissive = state === "select" ? "#2f6d5a" : state === "hover" ? "#7fa99b" : "#000";
  const ei = state === "none" ? 0 : 0.3;
  const pivotX = hinge === -1 ? x : x + w;
  const leafOffset = hinge === -1 ? w / 2 : -w / 2;
  const glass = material === "clear" || material === "smoked" || material === "fluted";
  // handle side edge height — everything must sit below the mitred top edge
  const edgeH = handleSide === "left" ? hL : hR;
  const safeTop = Math.min(hL, hR, edgeH) - 0.11;
  const handleX = handleSide === "left" ? -(w / 2 - 0.035) : w / 2 - 0.035;
  const handleY =
    handlePosition != null
      ? Math.min(safeTop, Math.max(0.08, Math.min(hL, hR) * (handlePosition / 100)))
      : handleAlign === "bottom"
        ? Math.min(0.12, safeTop)
        : handleAlign === "top"
          ? Math.max(0.08, safeTop - 0.05)
          : Math.min(safeTop, Math.min(hL, hR) * 0.5);
  const handleHeight = Math.max(0.1, safeTop - 0.06);

  return (
    <group position={[pivotX, yBottom, z]} ref={group}>
      <group
        position={[leafOffset, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
        onClick={(e) => {
          e.stopPropagation();
          if (handleSide === "push") setPushOpen((value) => !value);
          onSelect();
        }}
      >
        <mesh position={[0, 0, -T / 2]} castShadow receiveShadow>
          <extrudeGeometry args={[shape, { depth: T, bevelEnabled: false }]} />
          {glass || material === "mirror" ? (
            <meshPhysicalMaterial
              color={
                material === "smoked" ? "#4d5458" : material === "mirror" ? "#eef3f6" : "#dfeef0"
              }
              roughness={material === "mirror" ? 0.05 : 0.12}
              metalness={material === "mirror" ? 1 : 0}
              transmission={material === "mirror" ? 0 : 0.8}
              thickness={0.3}
              transparent={material !== "mirror"}
              opacity={material === "mirror" ? 1 : 0.5}
              emissive={emissive}
              emissiveIntensity={ei}
            />
          ) : (
            <meshStandardMaterial
              color={material === "alu" ? "#a8afb5" : color}
              roughness={material === "alu" ? 0.3 : roughness}
              metalness={material === "alu" ? 0.9 : 0.05}
              emissive={emissive}
              emissiveIntensity={ei}
            />
          )}
        </mesh>
        <Line
          points={[
            [-w / 2, 0, T / 2 + 0.028],
            [w / 2, 0, T / 2 + 0.028],
            [w / 2, hR, T / 2 + 0.028],
            [-w / 2, hL, T / 2 + 0.028],
            [-w / 2, 0, T / 2 + 0.028],
          ]}
          color="#77756e"
          lineWidth={1.2}
        />
        {handleSide !== "push" &&
          (handleStyle === "knob" ? (
            <mesh position={[handleX, Math.max(0.08, handleY), T / 2 + 0.02]}>
              <sphereGeometry args={[0.035, 16, 12]} />
              <meshStandardMaterial color="#adb2b7" roughness={0.25} metalness={0.9} />
            </mesh>
          ) : handleStyle === "edge" || handleStyle === "profile" || handleAlign === "profile" ? (
            <mesh position={[handleX, handleHeight / 2 + 0.04, T / 2 + 0.02]}>
              <boxGeometry args={[handleStyle === "edge" ? 0.018 : 0.022, handleHeight, 0.022]} />
              <meshStandardMaterial color="#adb2b7" roughness={0.25} metalness={0.9} />
            </mesh>
          ) : (
            <mesh
              position={[handleX, Math.max(0.08, handleY), T / 2 + 0.02]}
              {...(handleAlign === "top" || handleAlign === "bottom"
                ? { rotation: [0, 0, Math.PI / 2] as [number, number, number] }
                : {})}
            >
              <cylinderGeometry
                args={[
                  0.008,
                  0.008,
                  Math.min(0.22, Math.max(0.1, handleAlign === "center" ? safeTop * 0.5 : w * 0.5)),
                  16,
                ]}
              />
              <meshStandardMaterial color="#adb2b7" roughness={0.25} metalness={0.9} />
            </mesh>
          ))}
      </group>
    </group>
  );
}

/** Two vertically stacked door leaves for one compartment, including sloped leaves. */
function SplitDoorPair({
  sloped,
  parts,
  x,
  yBottom,
  hinge,
  w,
  hL,
  hR,
  z,
  color,
  roughness,
  style,
  material,
  handleSide,
  handleAlign,
  handlePosition,
  handleStyle,
  open,
  selected,
  onSelect,
}: {
  sloped: boolean;
  parts: number;
  x: number;
  yBottom: number;
  hinge: 1 | -1;
  w: number;
  hL: number;
  hR: number;
  z: number;
  color: string;
  roughness: number;
  style: Config["doorStyle"];
  material: DoorMaterial;
  handleSide: "left" | "right" | "push";
  handleAlign: "center" | "top" | "bottom" | "profile";
  handlePosition?: number | undefined;
  handleStyle: HandleStyle;
  open: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const count = Math.max(2, Math.min(6, Math.round(parts)));
  const splitH = Math.min(hL, hR) / count;
  const leafW = Math.max(cm(8), w - cm(0.3));
  const common = {
    color,
    roughness,
    material,
    handleSide,
    handleAlign,
    handlePosition,
    handleStyle,
    open,
    selected,
    onSelect,
  };
  return (
    <>
      {Array.from({ length: count }, (_, index) => {
        const y = yBottom + splitH * index;
        const partHLeft = index === count - 1 ? Math.max(cm(2), hL - splitH * (count - 1)) : splitH;
        const partHRight =
          index === count - 1 ? Math.max(cm(2), hR - splitH * (count - 1)) : splitH;
        return sloped ? (
          <SlopedDoor
            key={`sloped-leaf-${index}`}
            {...common}
            x={x + cm(0.15)}
            yBottom={y}
            hinge={hinge}
            w={leafW}
            hL={partHLeft}
            hR={partHRight}
            z={z}
          />
        ) : (
          <Door
            key={`door-leaf-${index}`}
            {...common}
            x={x + cm(0.15)}
            yCenter={y + partHLeft / 2}
            hinge={hinge}
            w={leafW}
            h={partHLeft}
            z={z}
            style={style}
          />
        );
      })}
      {Array.from({ length: count - 1 }, (_, index) => (
        <Panel
          key={`horizontal-divider-${index}`}
          size={[leafW, cm(0.45), cm(0.08)]}
          position={[x + w / 2, yBottom + splitH * (index + 1), z + T + 0.006]}
          color="#5a5a56"
          roughness={0.7}
        />
      ))}
    </>
  );
}

/** Tall pull-out unit: the whole cabinet body travels out behind a flush sloped front. */
function PullOutFront({
  x,
  yBottom,
  w,
  hL,
  hR,
  z,
  depth,
  color,
  roughness,
  handleSide,
  handleAlign,
  handlePosition,
  open,
  selected,
  onSelect,
}: {
  x: number;
  yBottom: number;
  w: number;
  hL: number;
  hR: number;
  z: number;
  depth: number;
  color: string;
  roughness: number;
  handleSide: "left" | "right" | "push";
  handleAlign: "center" | "top" | "bottom" | "profile";
  handlePosition?: number | undefined;
  open: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const travel = depth * 0.86;
  useFrame((_, dt) => {
    if (!group.current) return;
    const t = open || drawerOpen ? travel : 0;
    group.current.position.z += (z + t - group.current.position.z) * Math.min(1, dt * 5);
  });
  const shape = useMemo(() => pitchShape(w - 0.006, hL, hR), [w, hL, hR]);
  const state = selected ? "select" : hover ? "hover" : "none";
  const emissive = state === "select" ? "#2f6d5a" : state === "hover" ? "#7fa99b" : "#000";
  const minH = Math.min(hL, hR);
  const bodyD = depth * 0.86;
  const bodyW = w - 0.05;
  const zc = -bodyD / 2 - 0.01;
  // stacked pull-out trays / baskets, evenly split inside the tower
  const levels = Math.max(2, Math.min(5, Math.round(minH / 0.34)));
  const trays = Array.from({ length: levels }, (_, i) => 0.06 + ((minH - 0.14) / levels) * i);
  // handle is centred on the front and always below the mitred top edge
  const safeTop = minH - 0.09;
  const vertical = handleAlign === "profile";
  const customHandleY =
    handlePosition != null ? Math.max(0.1, Math.min(safeTop, minH * (handlePosition / 100))) : null;

  return (
    <group position={[x + w / 2, yBottom, z]} ref={group}>
      <group
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
        onPointerDown={(e) => {
          e.stopPropagation();
          setDragging(true);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          if (dragging) setDrawerOpen((value) => !value);
          setDragging(false);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <mesh position={[0, 0, -T / 2]} castShadow receiveShadow>
          <extrudeGeometry args={[shape, { depth: T, bevelEnabled: false }]} />
          <meshStandardMaterial
            color={color}
            roughness={roughness}
            metalness={0.05}
            emissive={emissive}
            emissiveIntensity={state === "none" ? 0 : 0.3}
          />
        </mesh>
        {/* handle — centred on the front, horizontal or vertical */}
        {handleSide !== "push" && (
          <mesh
            position={[
              0,
              customHandleY ??
                (vertical ? Math.max(0.12, safeTop * 0.5) : Math.max(0.1, safeTop * 0.62)),
              T / 2 + 0.022,
            ]}
            rotation={[0, 0, vertical ? 0 : Math.PI / 2]}
          >
            <cylinderGeometry
              args={[
                0.009,
                0.009,
                vertical ? Math.min(0.34, safeTop * 0.6) : Math.min(0.3, w * 0.55),
                16,
              ]}
            />
            <meshStandardMaterial color="#adb2b7" roughness={0.25} metalness={0.9} />
          </mesh>
        )}
        {/* tall drawer body — travels out together with the front */}
        <mesh position={[0, 0.035, zc]} castShadow receiveShadow>
          <boxGeometry args={[bodyW, 0.018, bodyD]} />
          <meshStandardMaterial color={color} roughness={roughness} />
        </mesh>
        {[-1, 1].map((sgn) => (
          <mesh key={sgn} position={[sgn * (bodyW / 2 - 0.008), minH / 2 + 0.02, zc]} castShadow>
            <boxGeometry args={[0.016, minH - 0.05, bodyD]} />
            <meshStandardMaterial color={color} roughness={roughness} />
          </mesh>
        ))}
        {/* runner rails */}
        {[-1, 1].map((sgn) => (
          <mesh key={`r${sgn}`} position={[sgn * (bodyW / 2 + 0.012), 0.06, zc]}>
            <boxGeometry args={[0.012, 0.035, bodyD * 0.98]} />
            <meshStandardMaterial color="#7e858b" roughness={0.3} metalness={0.85} />
          </mesh>
        ))}
        {/* stacked pull-out shelves / wire baskets */}
        {trays.map((y, i) => (
          <group key={i} position={[0, y + 0.06, zc]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[bodyW - 0.04, 0.014, bodyD - 0.03]} />
              <meshStandardMaterial
                color={i % 2 ? "#9aa0a6" : color}
                roughness={i % 2 ? 0.35 : roughness}
                metalness={i % 2 ? 0.7 : 0.05}
                transparent={i % 2 === 1}
                opacity={i % 2 ? 0.85 : 1}
              />
            </mesh>
            <mesh position={[0, 0.045, (bodyD - 0.03) / 2]} castShadow>
              <boxGeometry args={[bodyW - 0.04, 0.09, 0.012]} />
              <meshStandardMaterial
                color="#9aa0a6"
                roughness={0.35}
                metalness={0.6}
                transparent
                opacity={0.8}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

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
  const showDimensions = useContext(DimensionsContext);
  if (!showDimensions) return null;
  const mid: [number, number, number] = [
    (from[0] + to[0]) / 2 + labelOffset[0],
    (from[1] + to[1]) / 2 + labelOffset[1],
    (from[2] + to[2]) / 2 + labelOffset[2],
  ];
  return (
    <group>
      <Line
        points={[from, to]}
        color="#7c8b86"
        lineWidth={1.4}
        dashed
        dashSize={0.04}
        gapSize={0.03}
      />
      <Html position={mid} center distanceFactor={2.4}>
        <div className="rounded-full border border-border bg-card/90 whitespace-nowrap px-2 py-0.5 text-[11px] font-medium text-foreground shadow-sm">
          {label}
        </div>
      </Html>
    </group>
  );
}

function CornerUnit({
  sizeX,
  sizeZ,
  height,
  fillTo,
  color,
  roughness,
  underStairsPlinth,
}: {
  sizeX: number;
  sizeZ: number;
  /** Shared carcass height — the lower of the two joined walls. */
  height: number;
  /** Total height of the taller neighbour; a filler closes the gap. */
  fillTo: number;
  color: string;
  roughness: number;
  underStairsPlinth?: number;
}) {
  const plinth = cm(underStairsPlinth ?? 2);
  const size = Math.min(sizeX, sizeZ);
  return (
    <group>
      <Panel
        size={[sizeX, T, sizeZ]}
        position={[0, plinth + T / 2, 0]}
        color={color}
        roughness={roughness}
      />
      <Panel
        size={[sizeX, T, sizeZ]}
        position={[0, height + plinth - T / 2, 0]}
        color={color}
        roughness={roughness}
      />
      {fillTo > height + 0.01 && (
        <Panel
          size={[sizeX, fillTo - height, sizeZ]}
          position={[0, plinth + height + (fillTo - height) / 2, 0]}
          color={color}
          roughness={Math.min(1, roughness + 0.1)}
        />
      )}
      <Panel
        size={[sizeX, height, 0.008]}
        position={[0, height / 2 + plinth, -sizeZ / 2 + 0.004]}
        color={color}
        roughness={Math.min(1, roughness + 0.15)}
      />
      <Panel
        size={[0.008, height, sizeZ]}
        position={[-sizeX / 2 + 0.004, height / 2 + plinth, 0]}
        color={color}
        roughness={Math.min(1, roughness + 0.15)}
      />
      {/* diagonal shelves — smart corner storage */}
      {[0.5, 1.1, 1.6]
        .filter((y) => y < height - 0.1)
        .map((y) => (
          <mesh
            key={y}
            position={[0.02, plinth + y, 0.02]}
            rotation={[0, Math.PI / 4, 0]}
            castShadow
          >
            <boxGeometry args={[size * 1.05, T, size * 0.6]} />
            <meshStandardMaterial color={color} roughness={roughness} />
          </mesh>
        ))}
      <Panel
        size={[sizeX - 0.06, plinth, sizeZ - 0.06]}
        position={[0, plinth / 2, 0]}
        color="#4a4a4a"
        roughness={0.9}
      />
    </group>
  );
}

function Run({
  wall,
  config,
  sel,
  setSel,
  activeWall,
  activeBay,
  setActive,
  onMoveItem,
  onDeleteItem,
  doorSel,
  onSelectDoor,
}: {
  wall: WallId;
  config: Config;
  sel: Sel;
  setSel: (s: Sel) => void;
  activeWall: WallId;
  activeBay: number;
  setActive: (wall: WallId, bay: number) => void;
  onMoveItem: (id: string, wall: WallId, bay: number, y: number) => void;
  onDeleteItem: (id: string) => void;
  doorSel: DoorSel;
  onSelectDoor: (d: DoorSel) => void;
}) {
  const root = useRef<THREE.Group>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const domElement = useThree((s) => s.gl).domElement;

  const totalCm = runWidth(config, wall);
  const spec = wallSpec(config, wall);
  const W = cm(totalCm);
  const H = cm(spec.height);
  const D = cm(spec.depth);
  const finish = FINISHES.find((f) => f.id === spec.finish) ?? FINISHES[0]!;
  const widths = bayWidths(config, wall).map(cm);
  const offsets = bayOffsets(config, wall).map(cm);
  const bays = widths.length;
  const fridge = fridgeBay(config, wall);
  const drawerCounts = useMemo(
    () =>
      widths.map(
        (_, bay) =>
          config.items.filter(
            (item) => item.wall === wall && item.bay === bay && item.type === "drawer",
          ).length,
      ),
    [config.items, wall, widths],
  );
  const plinth = cm(config.roomShape === "understairs" ? (config.underStairsPlinth ?? 5) : 2);
  const slope = slopeOf(config, wall);
  const offsetsCm = bayOffsets(config, wall);
  const widthsCm = bayWidths(config, wall);
  // Keep a consistent reveal between adjacent fronts so multiple doors read
  // as an intentional facade instead of one continuous panel.
  const frontGap = cm(slope.on ? 0.7 : 0.9);
  const angle = slopeAngle(config, wall);
  /** carcass height at a divider position, in metres */
  const hAt = (xCm: number) => (slope.on ? cm(heightAtCm(config, wall, xCm)) : H);

  const left = -W / 2;
  const bayCenters = useMemo(
    () => widths.map((w, i) => left + (offsets[i] ?? 0) + w / 2),
    [widths, offsets, left],
  );

  useEffect(() => {
    if (controls) controls.enabled = !drag;
    domElement.style.cursor = drag ? (drag.out ? "not-allowed" : "grabbing") : "";
    return () => {
      if (controls) controls.enabled = true;
    };
  }, [drag, controls, domElement]);

  const minY = 6;
  const maxY = spec.height - 8;
  const maxYIn = (bay: number) => (slope.on ? bayHeights(config, wall, bay).min - 8 : maxY);

  const bayFromX = (xLocal: number) => {
    let idx = 0;
    for (let i = 0; i < bays; i++) if (xLocal >= left + (offsets[i] ?? 0)) idx = i;
    return idx;
  };

  const onPlaneMove = (e: { point: THREE.Vector3 }) => {
    if (!drag || !root.current) return;
    const p = root.current.worldToLocal(e.point.clone());
    const raw = Math.round(((p.y - plinth) * 100) / 5) * 5;
    const bay = bayFromX(p.x);
    const snapped = Math.min(maxYIn(bay), Math.max(minY, raw));
    const out = p.x < -W / 2 - 0.16 || p.x > W / 2 + 0.16;
    setDrag({ ...drag, y: snapped, bay, out });
  };

  const endDrag = () => {
    if (!drag) return;
    if (drag.out) onDeleteItem(drag.id);
    else {
      onMoveItem(drag.id, wall, drag.bay, drag.y);
      setActive(wall, drag.bay);
    }
    setDrag(null);
  };

  const activeX = left + (offsets[activeBay] ?? 0);
  const activeW = widths[activeBay] ?? widths[0] ?? 0;

  return (
    <group ref={root}>
      {drag && (
        <mesh
          position={[0, H / 2 + plinth, D / 2 + 0.02]}
          onPointerMove={onPlaneMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
        >
          <planeGeometry args={[W + 6, H + 6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* sides + dividers — each one cut to the ceiling height at its position */}
      {[...offsetsCm, totalCm].map((oCm, i) => {
        const hi = hAt(oCm);
        return (
          <Panel
            key={`side-${i}`}
            size={[T, hi, D]}
            position={[left + cm(oCm), hi / 2 + plinth, 0]}
            color={finish.hex}
            roughness={finish.roughness}
          />
        );
      })}
      {slope.on ? (
        // top panels sliced at the stair pitch, one slab per bay
        widthsCm.map((wCm, i) => {
          const x0 = offsetsCm[i] ?? 0;
          const hL = hAt(x0);
          const hR = hAt(x0 + wCm);
          const w = cm(wCm);
          const len = Math.hypot(w, hR - hL);
          const ang = Math.atan2(hR - hL, w);
          return (
            <mesh
              key={`top-${i}`}
              position={[left + cm(x0) + w / 2, plinth + (hL + hR) / 2 - T / 2 / Math.cos(ang), 0]}
              rotation={[0, 0, ang]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[len + T * Math.abs(Math.tan(ang)), T, D]} />
              <meshStandardMaterial
                color={finish.hex}
                roughness={finish.roughness}
                metalness={0.04}
              />
            </mesh>
          );
        })
      ) : (
        <Panel
          size={[W, T, D]}
          position={[0, H + plinth - T / 2, 0]}
          color={finish.hex}
          roughness={finish.roughness}
        />
      )}
      <Panel
        size={[W, T, D]}
        position={[0, plinth + T / 2, 0]}
        color={finish.hex}
        roughness={finish.roughness}
      />
      {/* back panels — skipped on the fridge bay for ventilation */}
      {widths.map((w, i) => {
        if (i === fridge || config.openCells?.[cellKey(wall, i, 0)]) return null;
        if (slope.on) {
          // trapezoid back, cut along the pitch so the enclosure is fully closed
          const x0 = offsetsCm[i] ?? 0;
          const hL = hAt(x0);
          const hR = hAt(x0 + (widthsCm[i] ?? 0));
          return (
            <mesh
              key={`back-${i}`}
              position={[bayCenters[i] ?? 0, plinth, -D / 2 + 0.002]}
              castShadow
              receiveShadow
            >
              <extrudeGeometry
                args={[pitchShape(w, hL, hR), { depth: 0.008, bevelEnabled: false }]}
              />
              <meshStandardMaterial
                color={finish.hex}
                roughness={Math.min(1, finish.roughness + 0.15)}
              />
            </mesh>
          );
        }
        const bh = H;
        return (
          <Panel
            key={`back-${i}`}
            size={[w, bh, 0.008]}
            position={[bayCenters[i] ?? 0, bh / 2 + plinth, -D / 2 + 0.004]}
            color={finish.hex}
            roughness={Math.min(1, finish.roughness + 0.15)}
          />
        );
      })}
      <Panel
        size={[W - 0.06, plinth, D - 0.06]}
        position={[0, plinth / 2, 0]}
        color="#4a4a4a"
        roughness={0.9}
      />

      {/* active bay highlight */}
      {activeWall === wall && (
        <Line
          points={[
            [activeX + 0.002, plinth + 0.02, D / 2 + 0.01],
            [activeX + activeW - 0.002, plinth + 0.02, D / 2 + 0.01],
            [
              activeX + activeW - 0.002,
              (slope.on ? cm(bayHeights(config, wall, activeBay).min) : H) + plinth - 0.02,
              D / 2 + 0.01,
            ],
            [
              activeX + 0.002,
              (slope.on ? cm(bayHeights(config, wall, activeBay).min) : H) + plinth - 0.02,
              D / 2 + 0.01,
            ],
            [activeX + 0.002, plinth + 0.02, D / 2 + 0.01],
          ]}
          color="#2f6d5a"
          lineWidth={1.8}
        />
      )}

      {/* interior */}
      {config.items
        .filter((i) => (i.wall ?? "a") === wall && i.bay < bays && i.type !== "drawer")
        .map((raw) => {
          const isDragging = drag?.id === raw.id;
          const base = isDragging ? { ...raw, bay: drag!.bay, y: drag!.y } : raw;
          // keep every module inside the sloped enclosure — never above the pitch line
          const item = { ...base, y: Math.min(base.y, Math.max(minY, maxYIn(base.bay))) };
          return item.type === "light" ? (
            <Light
              key={item.id}
              bayX={bayCenters[item.bay] ?? 0}
              bayW={widths[item.bay] ?? widths[0] ?? 0}
              y={plinth + cm(item.y)}
              depth={cm(colDepth(config, wall, item.bay))}
            />
          ) : (
            <group key={item.id} position={[0, plinth, 0]}>
              <Interior
                item={item}
                bayW={widths[item.bay] ?? widths[0] ?? 0}
                bayX={bayCenters[item.bay] ?? 0}
                depth={D}
                color={finish.hex}
                roughness={finish.roughness}
                sel={sel}
                setSel={setSel}
                openDoors={config.openDoors}
                dragging={isDragging}
                onDragStart={(it) => setDrag({ id: it.id, bay: it.bay, y: it.y, out: false })}
              />
              {isDragging && (
                <Html
                  position={[
                    (bayCenters[item.bay] ?? 0) + (widths[item.bay] ?? 0) / 2 + 0.08,
                    cm(item.y),
                    D / 2 + 0.05,
                  ]}
                  center
                  distanceFactor={2.4}
                >
                  <div
                    className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-md ${
                      drag!.out
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {drag!.out ? "Release to delete" : `H: ${item.y} cm · Section ${item.bay + 1}`}
                  </div>
                </Html>
              )}
            </group>
          );
        })}

      {/* Exterior drawer fronts: drawers sit outside the carcase and doors start above them. */}
      {widths.map((w, i) => {
        const count = drawerCounts[i] ?? 0;
        if (!count || i === fridge) return null;
        const drawerItems = config.items.filter(
          (item) => item.wall === wall && item.bay === i && item.type === "drawer",
        );
        const drawerHeights = drawerItems.map((item) =>
          Math.min(60, Math.max(8, item.height ?? ITEM_META.drawer.height)),
        );
        const available = Math.max(
          cm(20),
          (slope.on ? cm(bayHeights(config, wall, i).min) : H) - cm(2) - plinth,
        );
        const requestedStackH = drawerHeights.reduce((sum, height) => sum + cm(height), 0);
        const stackH = Math.min(available - cm(4), requestedStackH);
        return (
          <DrawerStack
            key={`exterior-drawers-${wall}-${i}`}
            x={left + (offsets[i] ?? 0)}
            y0={plinth}
            w={w}
            h={stackH}
            z={D / 2 + T + 0.025}
            color={finish.hex}
            roughness={finish.roughness}
            open={config.openDrawers ?? false}
            drawerHeights={drawerHeights}
            handleStyle={handleOf(config, wall, i).style}
            selected={doorSel?.wall === wall && doorSel.bay === i}
            onSelect={() => onSelectDoor({ wall, bay: i })}
          />
        );
      })}

      {drag && (
        <>
          {[-1, 1].map((s) => (
            <Html
              key={s}
              position={[s * (W / 2 + 0.3), plinth + 0.2, D / 2]}
              center
              distanceFactor={2.6}
            >
              <div
                className={`flex flex-col items-center gap-1 whitespace-nowrap rounded-xl border-2 border-dashed px-4 py-2 text-[10px] font-medium ${
                  drag.out
                    ? "border-destructive bg-destructive/15 text-destructive"
                    : "border-border bg-card/80 text-muted-foreground"
                }`}
              >
                <span className="text-lg leading-none">🗑</span>
                Drop to remove
              </div>
            </Html>
          ))}
        </>
      )}

      {/* doors */}
      {config.showDoors &&
        widths.map((w, i) => {
          const material = doorMaterialOf(config, wall, i);
          const handle = handleOf(config, wall, i);
          if (config.openCells?.[cellKey(wall, i, 0)]) return null;
          const x = left + (offsets[i] ?? 0);
          // handle on the right -> hinge on the left, and vice versa
          const hinge: 1 | -1 = handle.side === "left" ? 1 : -1;
          const isSel = doorSel?.wall === wall && doorSel.bay === i;
          const fullH = H - cm(1);
          if (i === fridge) {
            // split fridge/freezer front: 70% lower + 30% upper
            const parts = [
              { h: fullH * 0.7, yc: plinth + cm(1) + (fullH * 0.7) / 2, p: 0 },
              { h: fullH * 0.3, yc: plinth + cm(1) + fullH * 0.7 + (fullH * 0.3) / 2, p: 1 },
            ];
            return parts.map((pt) => (
              <Door
                key={`door-${wall}-${i}-${pt.p}`}
                x={x + frontGap / 2}
                yCenter={pt.yc}
                hinge={hinge}
                w={Math.max(cm(8), w - frontGap)}
                h={pt.h}
                z={D / 2 + T}
                color={finish.hex}
                roughness={finish.roughness}
                style={spec.doorStyle}
                material={material}
                handleSide={handle.side}
                handleAlign={handle.align}
                handlePosition={handle.position}
                handleStyle={handle.style}
                open={config.openDoors}
                selected={!!isSel}
                onSelect={() => onSelectDoor({ wall, bay: i, part: pt.p })}
              />
            ));
          }
          const bh = bayHeights(config, wall, i);
          const mode = doorModeOf(config, wall, i);
          const doorParts = doorPartsOf(config, wall, i);
          const drawerItems = config.items.filter(
            (item) => item.wall === wall && item.bay === i && item.type === "drawer",
          );
          const drawerHeightCm = drawerItems.reduce(
            (sum, item) => sum + Math.min(60, Math.max(8, item.height ?? ITEM_META.drawer.height)),
            0,
          );
          const drawerHeight =
            i === fridge ? 0 : Math.min(Math.max(0, drawerHeightCm), Math.max(0, bh.min - 12));
          // under-stairs fronts sit tight to the carcass: zero visible gaps
          const gap = slope.on ? cm(0.3) : cm(1);
          const yBottom = plinth + cm(drawerHeight) + gap;
          const hL = cm(bh.left - drawerHeight) - gap * 1.5;
          const hR = cm(bh.right - drawerHeight) - gap * 1.5;
          const frontX = x + frontGap / 2;
          const frontW = Math.max(cm(8), w - frontGap);
          if (mode === "pullout")
            return (
              <PullOutFront
                key={`pull-${wall}-${i}`}
                x={frontX}
                yBottom={yBottom}
                w={frontW}
                hL={slope.on ? hL : fullH}
                hR={slope.on ? hR : fullH}
                z={D / 2 + T}
                depth={D}
                color={finish.hex}
                roughness={finish.roughness}
                handleSide={handle.side}
                handleAlign={handle.align}
                handlePosition={handle.position}
                open={config.openDoors}
                selected={!!isSel}
                onSelect={() => onSelectDoor({ wall, bay: i })}
              />
            );
          if (slope.on && Math.abs(hL - hR) > 0.005)
            return doorParts > 1 ? (
              <SplitDoorPair
                key={`sdoor-pair-${wall}-${i}`}
                sloped
                parts={doorParts}
                x={frontX}
                yBottom={yBottom}
                hinge={hinge}
                w={frontW}
                hL={hL}
                hR={hR}
                z={D / 2 + T}
                color={finish.hex}
                roughness={finish.roughness}
                style={spec.doorStyle}
                material={material}
                handleSide={handle.side}
                handleAlign={handle.align}
                handlePosition={handle.position}
                handleStyle={handle.style}
                open={config.openDoors}
                selected={!!isSel}
                onSelect={() => onSelectDoor({ wall, bay: i })}
              />
            ) : (
              <SlopedDoor
                key={`sdoor-${wall}-${i}`}
                x={frontX}
                yBottom={yBottom}
                hinge={hinge}
                w={frontW}
                hL={hL}
                hR={hR}
                z={D / 2 + T}
                color={finish.hex}
                roughness={finish.roughness}
                material={material}
                handleSide={handle.side}
                handleAlign={handle.align}
                handlePosition={handle.position}
                handleStyle={handle.style}
                open={config.openDoors}
                selected={!!isSel}
                onSelect={() => onSelectDoor({ wall, bay: i })}
              />
            );
          const flatH = slope.on ? Math.min(hL, hR) : fullH - cm(drawerHeight);
          return doorParts > 1 ? (
            <SplitDoorPair
              key={`door-pair-${wall}-${i}`}
              sloped={false}
              parts={doorParts}
              x={frontX}
              yBottom={yBottom}
              hinge={hinge}
              w={frontW}
              hL={flatH}
              hR={flatH}
              z={D / 2 + T}
              color={finish.hex}
              roughness={finish.roughness}
              style={spec.doorStyle}
              material={material}
              handleSide={handle.side}
              handleAlign={handle.align}
              handlePosition={handle.position}
              handleStyle={handle.style}
              open={config.openDoors}
              selected={!!isSel}
              onSelect={() => onSelectDoor({ wall, bay: i })}
            />
          ) : (
            <Door
              key={`door-${wall}-${i}`}
              x={frontX}
              yCenter={yBottom + flatH / 2}
              hinge={hinge}
              w={frontW}
              h={flatH}
              z={D / 2 + T}
              color={finish.hex}
              roughness={finish.roughness}
              style={spec.doorStyle}
              material={material}
              handleSide={handle.side}
              handleAlign={handle.align}
              handlePosition={handle.position}
              handleStyle={handle.style}
              open={config.openDoors}
              selected={!!isSel}
              onSelect={() => onSelectDoor({ wall, bay: i })}
            />
          );
        })}

      {/* dimensions */}
      <DimLine
        from={[-W / 2, -0.06, D / 2]}
        to={[W / 2, -0.06, D / 2]}
        label={`${totalCm} cm`}
        labelOffset={[0, -0.08, 0.05]}
      />
      <DimLine
        from={[W / 2 + 0.12, 0, D / 2]}
        to={[W / 2 + 0.12, H + plinth, D / 2]}
        label={`${spec.height} cm`}
        labelOffset={[0.1, 0, 0]}
      />
      <DimLine
        from={[W / 2 + 0.05, -0.06, -D / 2]}
        to={[W / 2 + 0.05, -0.06, D / 2]}
        label={`${spec.depth} cm`}
        labelOffset={[0.1, 0, 0]}
      />
      {slope.on && config.showDimensions && (
        <>
          <DimLine
            from={[left, plinth, D / 2 + 0.05]}
            to={[left, plinth + hAt(0), D / 2 + 0.05]}
            label={`${Math.round(heightAtCm(config, wall, 0))} cm`}
            labelOffset={[-0.1, 0, 0]}
          />
          <DimLine
            from={[left + W, plinth, D / 2 + 0.05]}
            to={[left + W, plinth + hAt(totalCm), D / 2 + 0.05]}
            label={`${Math.round(heightAtCm(config, wall, totalCm))} cm`}
            labelOffset={[0.1, 0, 0]}
          />
          <Html
            position={[0, plinth + (hAt(0) + hAt(totalCm)) / 2 + 0.12, D / 2]}
            center
            distanceFactor={2.6}
          >
            <div className="whitespace-nowrap rounded-full border border-border bg-card/90 px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm">
              Under-stairs pitch · {angle}°
            </div>
          </Html>
        </>
      )}
      {fridge !== null && config.showDimensions && (
        <Html
          position={[bayCenters[fridge] ?? 0, H + plinth + 0.14, D / 2]}
          center
          distanceFactor={2.6}
        >
          <div className="whitespace-nowrap rounded-full border border-border bg-card/90 px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm">
            Fridge bay · locked {FRIDGE_W} cm
          </div>
        </Html>
      )}
    </group>
  );
}

/** One stacked drawer front unit filling a grid cell. */
function DrawerStack({
  x,
  y0,
  w,
  h,
  z,
  color,
  roughness,
  open,
  drawerHeights,
  handleStyle = "bar",
  selected,
  onSelect,
}: {
  x: number;
  y0: number;
  w: number;
  h: number;
  z: number;
  color: string;
  roughness: number;
  open: boolean;
  /** Requested individual drawer heights in cm; omitted for equal grid stacks. */
  drawerHeights?: number[];
  handleStyle?: HandleStyle;
  selected: boolean;
  onSelect: () => void;
}) {
  const [hover, setHover] = useState(false);
  const slide = useRef(0);
  const drawerGroups = useRef<Array<THREE.Group | null>>([]);
  const texture = useMemo(createWoodTexture, []);
  const n = Math.max(2, Math.min(5, Math.round(h / cm(22))));
  const requestedHeights = drawerHeights?.length
    ? drawerHeights.map((value) => cm(Math.min(60, Math.max(8, value))))
    : Array.from({ length: n }, () => h / n);
  const requestedTotal = requestedHeights.reduce((sum, value) => sum + value, 0);
  const heightScale = requestedTotal > h ? h / requestedTotal : 1;
  const drawerHeightsM = requestedHeights.map((value) => value * heightScale);
  const state = selected ? "select" : hover ? "hover" : "none";
  useFrame((_, dt) => {
    slide.current = THREE.MathUtils.damp(slide.current, open ? 1 : 0, 9, dt);
    drawerGroups.current.forEach((group) => {
      if (group) group.position.z = cm(18) * slide.current;
    });
  });
  return (
    <group
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {drawerHeightsM.map((drawerH, i) => {
        const drawerY = y0 + drawerHeightsM.slice(0, i).reduce((sum, value) => sum + value, 0);
        return (
          <group
            key={i}
            ref={(group) => {
              drawerGroups.current[i] = group;
            }}
            position={[0, 0, 0]}
          >
            {open && (
              <>
                {/* The drawer box moves with the front, leaving a readable open cavity. */}
                {/* Open drawer box: bottom, side walls and back make the extension readable. */}
                <mesh position={[x + w / 2, drawerY + cm(2), z - cm(8)]}>
                  <boxGeometry args={[w - cm(2), cm(2), Math.max(cm(8), cm(28))]} />
                  <meshStandardMaterial map={texture} color={color} roughness={0.8} />
                </mesh>
                <mesh position={[x + cm(2), drawerY + drawerH * 0.42, z - cm(8)]}>
                  <boxGeometry
                    args={[cm(1.5), Math.max(cm(7), drawerH * 0.55), Math.max(cm(8), cm(28))]}
                  />
                  <meshStandardMaterial map={texture} color={color} roughness={0.8} />
                </mesh>
                <mesh position={[x + w - cm(2), drawerY + drawerH * 0.42, z - cm(8)]}>
                  <boxGeometry
                    args={[cm(1.5), Math.max(cm(7), drawerH * 0.55), Math.max(cm(8), cm(28))]}
                  />
                  <meshStandardMaterial map={texture} color={color} roughness={0.8} />
                </mesh>
                <mesh position={[x + w / 2, drawerY + drawerH * 0.42, z - cm(21)]}>
                  <boxGeometry args={[w - cm(2), Math.max(cm(7), drawerH * 0.55), cm(1.5)]} />
                  <meshStandardMaterial color="#756b63" roughness={0.85} />
                </mesh>
                <mesh position={[x + w * 0.32, drawerY + cm(5), z - cm(1)]}>
                  <boxGeometry args={[Math.min(cm(12), w * 0.22), cm(5), cm(4)]} />
                  <meshStandardMaterial map={texture} color="#b9a58e" roughness={0.9} />
                </mesh>
                <mesh position={[x + w * 0.65, drawerY + cm(5), z - cm(1)]}>
                  <boxGeometry args={[Math.min(cm(16), w * 0.28), cm(4), cm(5)]} />
                  <meshStandardMaterial map={texture} color="#879b91" roughness={0.9} />
                </mesh>
              </>
            )}
            <Panel
              // A slightly wider reveal keeps each front visually separate.
              size={[w - cm(0.8), Math.max(cm(1), drawerH - cm(1.2)), T]}
              position={[x + w / 2, drawerY + drawerH / 2, z]}
              color={color}
              roughness={roughness}
              highlight={state}
            />
            <mesh position={[x + w / 2, drawerY + cm(0.7), z + T + cm(0.01)]}>
              <boxGeometry args={[Math.max(cm(10), w - cm(8)), cm(0.7), cm(0.3)]} />
              <meshStandardMaterial color="#756b63" roughness={0.72} />
            </mesh>
            {handleStyle === "knob" ? (
              <mesh position={[x + w / 2, drawerY + drawerH / 2, z + T]}>
                <sphereGeometry args={[cm(2), 16, 12]} />
                <meshStandardMaterial color="#8d9296" roughness={0.35} metalness={0.75} />
              </mesh>
            ) : (
              <mesh position={[x + w / 2, drawerY + drawerH - cm(4), z + T]}>
                <boxGeometry
                  args={[
                    handleStyle === "profile" || handleStyle === "edge"
                      ? cm(1.8)
                      : Math.min(w * 0.56, cm(32)),
                    handleStyle === "profile" ? Math.max(cm(10), drawerH - cm(4)) : cm(1.6),
                    cm(1.4),
                  ]}
                />
                <meshStandardMaterial color="#8d9296" roughness={0.35} metalness={0.75} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

/** A wall run built from the modular column grid (independent widths + stacked cells). */
function GridRun({
  wall,
  config,
  sel,
  setSel,
  activeWall,
  activeBay,
  setActive,
  doorSel,
  onSelectDoor,
}: {
  wall: WallId;
  config: Config;
  sel: Sel;
  setSel: (s: Sel) => void;
  activeWall: WallId;
  activeBay: number;
  setActive: (wall: WallId, bay: number) => void;
  doorSel: DoorSel;
  onSelectDoor: (d: DoorSel) => void;
}) {
  const spec = wallSpec(config, wall);
  const totalCm = runWidth(config, wall);
  const W = cm(totalCm);
  const plinth = cm(config.roomShape === "understairs" ? (config.underStairsPlinth ?? 5) : 2);
  const finish = FINISHES.find((f) => f.id === spec.finish) ?? FINISHES[0]!;
  const widthsCm = bayWidths(config, wall);
  const offsetsCm = bayOffsets(config, wall);
  const left = -W / 2;
  const stairSlope = slopeOf(config, wall);
  const tallestCm = Math.max(...widthsCm.map((_, col) => colHeight(config, wall, col)), 40);
  const deepestCm = Math.max(...widthsCm.map((_, col) => colDepth(config, wall, col)), 20);
  const Hmax = cm(tallestCm);
  const Dmax = cm(deepestCm);

  // Group consecutive columns that share the same height and depth into ONE
  // unified carcase: single top, single bottom, one continuous back, 18 mm
  // internal dividers instead of two touching side panels.
  const groups: { cols: number[]; hCm: number; dCm: number }[] = [];
  widthsCm.forEach((_, col) => {
    const hCm = colHeight(config, wall, col);
    const dCm = colDepth(config, wall, col);
    const last = groups[groups.length - 1];
    if (last && last.hCm === hCm && last.dCm === dCm) last.cols.push(col);
    else groups.push({ cols: [col], hCm, dCm });
  });

  return (
    <group>
      {config.roomShape === "understairs" &&
        wall === "a" &&
        widthsCm.map((wCm, i) => {
          const x0 = offsetsCm[i] ?? 0;
          const hL = cm(heightAtCm(config, wall, x0));
          const hR = cm(heightAtCm(config, wall, x0 + wCm));
          const w = cm(wCm);
          return (
            <SlopedBackPanel
              key={`understairs-continuous-back-${i}`}
              x={left + cm(x0)}
              y={plinth}
              width={Math.max(0.01, w - T)}
              heightLeft={hL}
              heightRight={hR}
              z={-Dmax / 2 - 0.004}
              color={finish.hex}
              roughness={Math.min(1, finish.roughness + 0.15)}
            />
          );
        })}
      {stairSlope.on &&
        widthsCm.map((wCm, i) => {
          const x0 = offsetsCm[i] ?? 0;
          const hL = cm(heightAtCm(config, wall, x0));
          const hR = cm(heightAtCm(config, wall, x0 + wCm));
          const w = cm(wCm);
          const len = Math.hypot(w, hR - hL);
          const angle = Math.atan2(hR - hL, w);
          return (
            <mesh
              key={`grid-stair-top-${i}`}
              position={[left + cm(x0) + w / 2, plinth + (hL + hR) / 2, 0]}
              rotation={[0, 0, angle]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[len, T, Dmax]} />
              <meshStandardMaterial color={finish.hex} roughness={finish.roughness} />
            </mesh>
          );
        })}
      {groups.map((g, gi) => {
        const H = cm(g.hCm);
        const D = cm(g.dCm);
        const gStart = g.cols[0]!;
        const gEnd = g.cols[g.cols.length - 1]!;
        const gx0 = left + cm(offsetsCm[gStart] ?? 0);
        const gw = cm((offsetsCm[gEnd] ?? 0) + (widthsCm[gEnd] ?? 0) - (offsetsCm[gStart] ?? 0));
        const leftBoundaryHeight = stairSlope.on
          ? cm(heightAtCm(config, wall, offsetsCm[gStart] ?? 0))
          : H;
        const rightBoundaryHeight = stairSlope.on
          ? cm(heightAtCm(config, wall, (offsetsCm[gEnd] ?? 0) + (widthsCm[gEnd] ?? 0)))
          : H;
        return (
          <group key={`grp-${gi}`}>
            {/* one plinth for the whole body */}
            <Panel
              size={[gw - cm(3), plinth, D - cm(6)]}
              position={[gx0 + gw / 2, plinth / 2, 0]}
              color="#4a4a4a"
              roughness={0.9}
            />
            {/* single bottom + single top panel */}
            <Panel
              size={[gw, T, D]}
              position={[gx0 + gw / 2, plinth + T / 2, 0]}
              color={finish.hex}
              roughness={finish.roughness}
            />
            {!stairSlope.on && (
              <Panel
                size={[gw, T, D]}
                position={[gx0 + gw / 2, plinth + H - T / 2, 0]}
                color={finish.hex}
                roughness={finish.roughness}
              />
            )}
            {/* outer side panels */}
            {[
              { x: gx0 + T / 2, height: leftBoundaryHeight },
              { x: gx0 + gw - T / 2, height: rightBoundaryHeight },
            ].map(({ x: sx, height }, si) => (
              <Panel
                key={`side-${si}`}
                size={[T, height, D]}
                position={[sx, plinth + height / 2, 0]}
                color={finish.hex}
                roughness={finish.roughness}
              />
            ))}
            {/* single 18 mm internal dividers where columns meet */}
            {g.cols.slice(1).map((col) => (
              <Panel
                key={`div-${col}`}
                size={[
                  T,
                  (stairSlope.on ? cm(heightAtCm(config, wall, offsetsCm[col] ?? 0)) : H) - 2 * T,
                  D,
                ]}
                position={[
                  left + cm(offsetsCm[col] ?? 0),
                  plinth +
                    T +
                    ((stairSlope.on ? cm(heightAtCm(config, wall, offsetsCm[col] ?? 0)) : H) -
                      2 * T) /
                      2,
                  0,
                ]}
                color={finish.hex}
                roughness={finish.roughness}
              />
            ))}
            {g.cols.map((col) => {
              const wCm = widthsCm[col] ?? 0;
              const x0 = left + cm(offsetsCm[col] ?? 0);
              const w = cm(wCm);
              const isFirst = col === gStart;
              const isLast = col === gEnd;
              // clear opening between the neighbouring panels
              const ix0 = x0 + (isFirst ? T : T / 2);
              const ix1 = x0 + w - (isLast ? T : T / 2);
              const iw = ix1 - ix0;
              const cells = gridCells(config, wall, col);
              const isActiveCol = activeWall === wall && activeBay === col;
              const handle = handleOf(config, wall, col);
              return (
                <group key={`col-${col}`}>
                  {cells.map((cell) => {
                    const mod = config.openCells?.[cellKey(wall, col, cell.level)]
                      ? "open"
                      : moduleOf(config, wall, col, cell.level);
                    const y0 = plinth + cm(cell.y0);
                    const h = cm(cell.h);
                    const bayOffsetCm = offsetsCm[col] ?? 0;
                    const slopeCellLeft = Math.max(
                      0,
                      Math.min(h, cm(heightAtCm(config, wall, bayOffsetCm)) - cm(cell.y0)),
                    );
                    const slopeCellRight = Math.max(
                      0,
                      Math.min(h, cm(heightAtCm(config, wall, bayOffsetCm + wCm)) - cm(cell.y0)),
                    );
                    const useSlopedDoor =
                      config.roomShape === "understairs" && wall === "a" && stairSlope.on;
                    const selCell =
                      doorSel?.wall === wall &&
                      doorSel.bay === col &&
                      (doorSel.part ?? 0) === cell.level;
                    const doorParts = doorPartsOf(config, wall, col, cell.level);
                    return (
                      <group key={`cell-${cell.level}`}>
                        {/* Open cells have no front, but Under-Stairs still needs a
                            continuous back board to close the enclosure. */}
                        {(mod !== "open" || config.roomShape === "understairs") && (
                          <Panel
                            size={[iw, Math.max(cm(2), h - cm(1)), 0.008]}
                            position={[ix0 + iw / 2, y0 + h / 2, -D / 2 + 0.004]}
                            color={finish.hex}
                            roughness={Math.min(1, finish.roughness + 0.15)}
                          />
                        )}
                        {/* horizontal split shelf between stacked cells (only inside this column) */}
                        {cell.level > 0 && (
                          <Panel
                            size={[iw, T, D - cm(1)]}
                            position={[ix0 + iw / 2, y0 - T / 2, 0]}
                            color={finish.hex}
                            roughness={finish.roughness}
                          />
                        )}

                        {mod === "open" && (
                          <Html
                            position={[ix0 + iw / 2, y0 + h / 2, D / 2 - cm(6)]}
                            center
                            distanceFactor={2.6}
                          >
                            <div className="rounded-full border border-dashed border-border bg-card/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Open niche
                            </div>
                          </Html>
                        )}

                        {/* vitrine glass shelves */}
                        {mod === "vitrine" &&
                          [0.34, 0.67].map((t) => (
                            <mesh key={t} position={[ix0 + iw / 2, y0 + h * t, 0]}>
                              <boxGeometry args={[iw, cm(1), D - cm(3)]} />
                              <meshPhysicalMaterial
                                color="#dbe7ea"
                                transparent
                                opacity={0.45}
                                roughness={0.08}
                                metalness={0}
                              />
                            </mesh>
                          ))}

                        {/* fronts */}
                        {config.showDoors && mod === "drawers" && (
                          <DrawerStack
                            x={x0}
                            y0={y0 + cm(0.4)}
                            w={w}
                            h={h - cm(0.8)}
                            z={D / 2 + T}
                            color={finish.hex}
                            roughness={finish.roughness}
                            open={config.openDrawers ?? false}
                            handleStyle={handleOf(config, wall, col).style}
                            selected={!!selCell}
                            onSelect={() => {
                              setActive(wall, col);
                              onSelectDoor({ wall, bay: col, part: cell.level });
                            }}
                          />
                        )}
                        {config.showDoors &&
                          (mod === "door" || mod === "vitrine") &&
                          (doorParts > 1 ? (
                            <SplitDoorPair
                              sloped={useSlopedDoor}
                              parts={doorParts}
                              x={ix0}
                              yBottom={y0}
                              hinge={handle.side === "left" ? 1 : -1}
                              w={iw}
                              hL={useSlopedDoor ? slopeCellLeft : h - cm(0.8)}
                              hR={useSlopedDoor ? slopeCellRight : h - cm(0.8)}
                              z={D / 2 + T}
                              color={finish.hex}
                              roughness={finish.roughness}
                              style={spec.doorStyle}
                              material={
                                mod === "vitrine" ? "clear" : doorMaterialOf(config, wall, col)
                              }
                              handleSide={handle.side}
                              handleAlign={handle.align}
                              handlePosition={handle.position}
                              handleStyle={handle.style}
                              open={config.openDoors}
                              selected={!!selCell}
                              onSelect={() => {
                                setActive(wall, col);
                                onSelectDoor({ wall, bay: col, part: cell.level });
                              }}
                            />
                          ) : useSlopedDoor ? (
                            <SlopedDoor
                              x={ix0}
                              yBottom={y0}
                              hinge={handle.side === "left" ? 1 : -1}
                              w={iw}
                              hL={slopeCellLeft}
                              hR={slopeCellRight}
                              z={D / 2 + T}
                              color={finish.hex}
                              roughness={finish.roughness}
                              material={
                                mod === "vitrine" ? "clear" : doorMaterialOf(config, wall, col)
                              }
                              handleSide={handle.side}
                              handleAlign={handle.align}
                              handlePosition={handle.position}
                              handleStyle={handle.style}
                              open={config.openDoors}
                              selected={!!selCell}
                              onSelect={() => {
                                setActive(wall, col);
                                onSelectDoor({ wall, bay: col, part: cell.level });
                              }}
                            />
                          ) : (
                            <Door
                              x={x0 + cm(0.3)}
                              yCenter={y0 + h / 2}
                              hinge={handle.side === "left" ? 1 : -1}
                              w={w - cm(0.6)}
                              h={h - cm(0.8)}
                              z={D / 2 + T}
                              color={finish.hex}
                              roughness={finish.roughness}
                              style={spec.doorStyle}
                              material={
                                mod === "vitrine" ? "clear" : doorMaterialOf(config, wall, col)
                              }
                              handleSide={handle.side}
                              handleAlign={handle.align}
                              handlePosition={handle.position}
                              handleStyle={handle.style}
                              open={config.openDoors}
                              selected={!!selCell}
                              onSelect={() => {
                                setActive(wall, col);
                                onSelectDoor({ wall, bay: col, part: cell.level });
                              }}
                            />
                          ))}

                        {/* per-cell technical dimensions */}
                        <DimLine
                          from={[ix0, y0 + cm(1), D / 2 + 0.03]}
                          to={[ix1, y0 + cm(1), D / 2 + 0.03]}
                          label={`${Math.round(iw * 100)} cm`}
                          labelOffset={[0, 0.08, 0.05]}
                        />
                        <DimLine
                          from={[ix0 + cm(2), y0 + cm(1), D / 2 + 0.05]}
                          to={[ix0 + cm(2), y0 + h - cm(1), D / 2 + 0.05]}
                          label={`${Math.round(cell.h)} cm`}
                          labelOffset={[0.08, 0, 0]}
                        />
                      </group>
                    );
                  })}

                  {isActiveCol && (
                    <Line
                      points={[
                        [x0 + 0.002, plinth + 0.01, D / 2 + 0.012],
                        [x0 + w - 0.002, plinth + 0.01, D / 2 + 0.012],
                        [x0 + w - 0.002, plinth + H - 0.01, D / 2 + 0.012],
                        [x0 + 0.002, plinth + H - 0.01, D / 2 + 0.012],
                        [x0 + 0.002, plinth + 0.01, D / 2 + 0.012],
                      ]}
                      color="#2f6d5a"
                      lineWidth={1.8}
                    />
                  )}
                </group>
              );
            })}

            {/* unified body width */}
            <DimLine
              from={[gx0, plinth + H + 0.1, D / 2]}
              to={[gx0 + gw, plinth + H + 0.1, D / 2]}
              label={`body ${Math.round(gw * 100)} cm`}
              labelOffset={[0, 0.12, 0.08]}
            />
          </group>
        );
      })}

      {/* interior modules still live inside their column */}
      {config.items
        .filter((i) => (i.wall ?? "a") === wall && i.bay < widthsCm.length)
        .map((item) => {
          const bcol = item.bay;
          const bx0 = left + cm(offsetsCm[bcol] ?? 0);
          const bw = cm(widthsCm[bcol] ?? 0);
          const grp = groups.find((g) => g.cols.includes(bcol));
          const isFirst = grp ? grp.cols[0] === bcol : true;
          const isLast = grp ? grp.cols[grp.cols.length - 1] === bcol : true;
          const ix0 = bx0 + (isFirst ? T : T / 2);
          const ix1 = bx0 + bw - (isLast ? T : T / 2);
          // Interior insets by T on each side, so pad the clear span back out
          const clearW = ix1 - ix0 + 2 * T;
          const cx = (ix0 + ix1) / 2;
          return item.type === "light" ? (
            <Light
              key={item.id}
              bayX={cx}
              bayW={ix1 - ix0}
              y={plinth + cm(item.y)}
              depth={cm(colDepth(config, wall, item.bay))}
            />
          ) : (
            <group key={item.id} position={[0, plinth, 0]}>
              <Interior
                item={item}
                bayW={clearW}
                bayX={cx}
                depth={cm(colDepth(config, wall, item.bay))}
                color={finish.hex}
                roughness={finish.roughness}
                sel={sel}
                setSel={setSel}
                openDoors={config.openDoors}
                dragging={false}
                onDragStart={() => {}}
              />
            </group>
          );
        })}

      {/* overall run dimensions (envelope of the independent columns) */}
      <DimLine
        from={[-W / 2, -0.06, Dmax / 2]}
        to={[W / 2, -0.06, Dmax / 2]}
        label={`${totalCm} cm`}
        labelOffset={[0, -0.12, 0.08]}
      />
      <DimLine
        from={[W / 2 + 0.12, 0, Dmax / 2]}
        to={[W / 2 + 0.12, Hmax + plinth, Dmax / 2]}
        label={`max ${tallestCm} cm`}
        labelOffset={[0.15, 0, 0]}
      />
      <DimLine
        from={[W / 2 + 0.05, -0.06, -Dmax / 2]}
        to={[W / 2 + 0.05, -0.06, Dmax / 2]}
        label={`max ${deepestCm} cm`}
        labelOffset={[0.12, 0, 0]}
      />
    </group>
  );
}

export default function Scene({
  config,
  activeWall,
  activeBay,
  setActive,
  onMoveItem,
  onDeleteItem,
  doorSel,
  onSelectDoor,
}: {
  config: Config;
  activeWall: WallId;
  activeBay: number;
  setActive: (wall: WallId, bay: number) => void;
  onMoveItem: (id: string, wall: WallId, bay: number, y: number) => void;
  onDeleteItem: (id: string) => void;
  doorSel: DoorSel;
  onSelectDoor: (d: DoorSel) => void;
}) {
  const [sel, setSel] = useState<Sel>(null);
  const [focus, setFocus] = useState<FocusRequest>(null);
  const isMobile = useIsMobile();
  const shape = config.roomShape;
  const L = shape === "lshape";
  const WA = cm(config.width);
  const WB = cm(config.wallB);
  const WC = cm(config.wallC);
  const AI = cm(config.aisle);
  // Every wall segment owns its own depth / height / finish.
  const sa = wallSpec(config, "a");
  const sb = wallSpec(config, "b");
  const sc = wallSpec(config, "c");
  const DA = cm(sa.depth);
  const DB = cm(sb.depth);
  const DC = cm(sc.depth);
  const HA = cm(sa.height);
  const HB = cm(sb.height);
  const cornerFinish = FINISHES.find((f) => f.id === sa.finish) ?? FINISHES[0]!;

  type Place = { wall: WallId; pos: [number, number, number]; rot: number };
  // Each Run is authored centred on its own origin, facing +z.
  const places: Place[] =
    shape === "straight"
      ? [{ wall: "a", pos: [0, 0, 0], rot: 0 }]
      : shape === "understairs"
        ? config.underStairsExtraRun
          ? [
              { wall: "a", pos: [-(WA + WB) / 2 + WA / 2, 0, 0], rot: 0 },
              { wall: "b", pos: [-(WA + WB) / 2 + WA + WB / 2, 0, 0], rot: 0 },
            ]
          : [{ wall: "a", pos: [0, 0, 0], rot: 0 }]
        : L
          ? [
              { wall: "a", pos: [DB + WA / 2, 0, DA / 2], rot: 0 },
              { wall: "b", pos: [DB / 2, 0, DA + WB / 2], rot: Math.PI / 2 },
            ]
          : shape === "ushape"
            ? [
                { wall: "a", pos: [0, 0, DA / 2], rot: 0 },
                { wall: "b", pos: [-WA / 2 + DB / 2, 0, DA + WB / 2], rot: Math.PI / 2 },
                { wall: "c", pos: [WA / 2 - DC / 2, 0, DA + WC / 2], rot: -Math.PI / 2 },
              ]
            : [
                { wall: "a", pos: [0, 0, DA / 2], rot: 0 },
                { wall: "b", pos: [0, 0, DA + AI + DB / 2], rot: Math.PI },
              ];

  // Assembly is roughly centred around the origin for comfortable orbiting.
  const offset: [number, number, number] = L
    ? [-(DB + WA) / 2, 0, -(DA + WB) / 2]
    : shape === "ushape"
      ? [0, 0, -(DA + Math.max(WB, WC)) / 2]
      : shape === "galley"
        ? [0, 0, -(DA + DB + AI) / 2]
        : shape === "understairs" && config.underStairsExtraRun
          ? [0, 0, 0]
          : [0, 0, 0];

  const span = Math.max(
    WA,
    shape === "straight"
      ? 0
      : shape === "understairs" && config.underStairsExtraRun
        ? WA + WB
        : shape === "understairs"
          ? 0
          : shape === "galley"
            ? DA + DB + AI
            : Math.max(WB, WC) + DA,
  );
  const tallest = Math.max(...places.map((p) => cm(wallSpec(config, p.wall).height)));
  const camDist = 2.2 + span * 1.7;
  const fitTarget: [number, number, number] = [0, tallest * 0.45, 0];

  return (
    <Canvas
      key={shape}
      shadows={!isMobile}
      dpr={isMobile ? [1, 1.35] : [1, 1.75]}
      camera={{ position: [camDist * 0.55, 1.6 + span * 0.55, camDist], fov: 42 }}
      onPointerMissed={() => {
        setSel(null);
        onSelectDoor(null);
      }}
      gl={{ antialias: !isMobile, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#f6f4f0"]} />
      <fog attach="fog" args={["#f6f4f0", 9, 24]} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[3.5, 5, 3]}
        intensity={2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-4, 3, -2]} intensity={0.5} />
      <Environment preset="apartment" />
      <DimensionsContext.Provider value={config.showDimensions}>
        <group position={[0, -0.9, 0]}>
          <group
            position={offset}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setFocus({ point: [e.point.x, e.point.y, e.point.z], key: Date.now() });
            }}
          >
            {L && (
              <group position={[DB / 2, 0, DA / 2]}>
                {/* geometry adapts to two walls with different depths and heights */}
                <CornerUnit
                  sizeX={DB}
                  sizeZ={DA}
                  height={Math.min(HA, HB)}
                  fillTo={Math.max(HA, HB)}
                  color={cornerFinish.hex}
                  roughness={cornerFinish.roughness}
                  {...(config.roomShape === "understairs" && config.underStairsPlinth != null
                    ? { underStairsPlinth: config.underStairsPlinth }
                    : {})}
                />
              </group>
            )}
            {places.map((p) => (
              <group key={p.wall} position={p.pos} rotation={[0, p.rot, 0]}>
                {isGrid(config, p.wall) ? (
                  <GridRun
                    wall={p.wall}
                    config={config}
                    sel={sel}
                    setSel={setSel}
                    activeWall={activeWall}
                    activeBay={activeBay}
                    setActive={setActive}
                    doorSel={doorSel}
                    onSelectDoor={onSelectDoor}
                  />
                ) : (
                  <Run
                    wall={p.wall}
                    config={config}
                    sel={sel}
                    setSel={setSel}
                    activeWall={activeWall}
                    activeBay={activeBay}
                    setActive={setActive}
                    onMoveItem={onMoveItem}
                    onDeleteItem={onDeleteItem}
                    doorSel={doorSel}
                    onSelectDoor={onSelectDoor}
                  />
                )}
              </group>
            ))}
          </group>
          <ContactShadows
            position={[0, 0.002, 0]}
            opacity={0.45}
            scale={16}
            blur={2.4}
            far={4}
            resolution={1024}
          />
          <Grid
            position={[0, 0, 0]}
            args={[24, 24]}
            cellSize={0.25}
            cellColor="#dcd7cf"
            sectionSize={1}
            sectionColor="#c7c0b5"
            fadeDistance={18}
            infiniteGrid
          />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} receiveShadow>
            <planeGeometry args={[40, 40]} />
            <meshStandardMaterial color="#efece6" roughness={0.95} />
          </mesh>
        </group>
      </DimensionsContext.Provider>
      <CameraFit span={span} tallest={tallest} />
      <Suspense fallback={null}>
        <CameraRig
          touch={isMobile}
          focus={focus}
          minDistance={1.4}
          maxDistance={18}
          target={fitTarget}
        />
      </Suspense>
    </Canvas>
  );
}

/** Re-frames the camera whenever the assembly footprint or height changes. */
function CameraFit({ span, tallest }: { span: number; tallest: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as {
    target: THREE.Vector3;
    update: () => void;
  } | null;
  useEffect(() => {
    const d = 2.4 + span * 1.25 + tallest * 0.5;
    camera.position.set(d * 0.45, tallest * 0.95 + 0.5, d);
    if (controls) {
      controls.target.set(0, tallest * 0.45, 0);
      controls.update();
    }
    camera.lookAt(0, tallest * 0.45, 0);
  }, [span, tallest, camera, controls]);
  return null;
}
