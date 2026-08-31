import { skuForBomKey } from "@/lib/catalog";

export type FinishId = "greige" | "white" | "oak" | "blackbrown";
export type DoorStyle = "flat" | "glass" | "framed";
export type ItemType =
  | "shelf"
  | "rail"
  | "drawer"
  | "basket"
  | "light"
  | "fridge"
  | "washer"
  | "oven"
  | "microwave"
  | "dishwasher"
  | "hob"
  | "sink"
  | "extractor"
  | "cargo";
export type ApplianceType = Exclude<
  ItemType,
  "shelf" | "rail" | "drawer" | "basket" | "light" | "cargo"
>;
export const APPLIANCE_TYPES: ApplianceType[] = [
  "fridge",
  "washer",
  "oven",
  "microwave",
  "dishwasher",
  "hob",
  "sink",
  "extractor",
];

/** Appliances whose front occupies the cabinet opening instead of a door leaf. */
export const FRONT_APPLIANCE_TYPES: readonly ApplianceType[] = [
  "fridge",
  "washer",
  "oven",
  "microwave",
  "dishwasher",
];

export const isFrontAppliance = (type: ApplianceType) => FRONT_APPLIANCE_TYPES.includes(type);
export type SlopeSide = "left" | "right";
export type DoorMode = "hinged" | "pullout";
/** Grid builder: what fills one cell of the column grid. */
export type ModuleType = "door" | "vitrine" | "drawers" | "open";
/** Under-stairs sloped ceiling of one wall segment. */
export type SlopeSpec = {
  on: boolean;
  /** Which end of the run carries the Max Height. */
  side: SlopeSide;
  maxHeight: number;
  minHeight: number;
};
export type WallId = "a" | "b" | "c";
export type RoomShape = "straight" | "lshape" | "ushape" | "galley" | "understairs" | "modular";
export type DoorMaterial = "solid" | "clear" | "smoked" | "fluted" | "mirror" | "alu";
export type HandleSide = "left" | "right" | "push";
export type HandleAlign = "center" | "top" | "bottom" | "profile";

export const FRIDGE_W = 60;

export const ROOM_SHAPES: { id: RoomShape; name: string; desc: string }[] = [
  { id: "straight", name: "Straight Wall", desc: "Single run" },
  { id: "lshape", name: "L-Shape Corner", desc: "Two walls + corner" },
  { id: "ushape", name: "U-Shape Walk-in", desc: "Back wall + 2 returns" },
  { id: "galley", name: "Parallel Walls", desc: "Two facing runs" },
  { id: "understairs", name: "Under-Stairs Cabinet", desc: "Standalone sloped module" },
  { id: "modular", name: "Modular Assembly", desc: "Add & snap single units" },
];

/**
 * The two customer-facing workspaces. Legacy room shapes remain in the data
 * model so old designs can still be opened, but new navigation only exposes
 * the two workflows we actively support.
 */
export const PRIMARY_WORKSPACES: { id: RoomShape; name: string; desc: string }[] = [
  {
    id: "understairs",
    name: "Understairs / Triangular",
    desc: "Sloped and triangular cabinet modules",
  },
  { id: "modular", name: "Modular Assembly", desc: "Add, place and customize cabinets" },
];

export const HANDLE_SIDES: { id: HandleSide; name: string; desc: string }[] = [
  { id: "left", name: "Left", desc: "Handle left · hinge right" },
  { id: "right", name: "Right", desc: "Handle right · hinge left" },
  { id: "push", name: "Push-to-Open", desc: "No handle · hinge left" },
];

export const HANDLE_ALIGNS: { id: HandleAlign; name: string }[] = [
  { id: "center", name: "Center" },
  { id: "top", name: "Top" },
  { id: "bottom", name: "Bottom" },
  { id: "profile", name: "Vertical Profile" },
];

export const FINISHES: {
  id: FinishId;
  name: string;
  hex: string;
  swatch: string;
  roughness: number;
}[] = [
  { id: "greige", name: "Cashmere / Greige", hex: "#cfc4b4", swatch: "#cfc4b4", roughness: 0.65 },
  { id: "white", name: "Matt White", hex: "#f2f0ec", swatch: "#f2f0ec", roughness: 0.8 },
  { id: "oak", name: "Oak Wood", hex: "#c08f56", swatch: "#c08f56", roughness: 0.5 },
  { id: "blackbrown", name: "Black Brown", hex: "#3b2f2a", swatch: "#3b2f2a", roughness: 0.55 },
];

export const DOOR_STYLES: { id: DoorStyle; name: string; desc: string }[] = [
  { id: "flat", name: "Flat Panel", desc: "Smooth full-height front" },
  { id: "glass", name: "Glass", desc: "Frosted glass insert" },
  { id: "framed", name: "Framed", desc: "Shaker-style border" },
];

export const DOOR_MATERIALS: {
  id: DoorMaterial;
  name: string;
  desc: string;
  swatch: string;
  price: number;
}[] = [
  { id: "solid", name: "Solid Panel", desc: "Matches cabinet finish", swatch: "#cfc4b4", price: 0 },
  {
    id: "clear",
    name: "Glass — Clear",
    desc: "Tempered clear glass",
    swatch: "#dff0f3",
    price: 45,
  },
  { id: "smoked", name: "Glass — Smoked", desc: "Tinted grey glass", swatch: "#6f757a", price: 55 },
  {
    id: "fluted",
    name: "Glass — Fluted",
    desc: "Rifled / reeded glass",
    swatch: "#c6d8d6",
    price: 65,
  },
  { id: "mirror", name: "Mirror Finish", desc: "Full-height mirror", swatch: "#c9d2d8", price: 70 },
  {
    id: "alu",
    name: "Aluminium + Glass",
    desc: "Slim alu profile frame",
    swatch: "#9fa6ac",
    price: 85,
  },
];

export const DOOR_MODES: { id: DoorMode; name: string; desc: string }[] = [
  { id: "hinged", name: "Hinged sloped door", desc: "Angled leaf, cut at the pitch" },
  {
    id: "pullout",
    name: "Pull-out tall drawer",
    desc: "Drag the front toward you like a drawer",
  },
];

export const ITEM_META: Record<ItemType, { name: string; price: number; height: number }> = {
  shelf: { name: "Shelf", price: 15, height: 2 },
  rail: { name: "Hanging Rail", price: 12, height: 3 },
  drawer: { name: "Drawer", price: 45, height: 20 },
  basket: { name: "Wire Basket", price: 22, height: 16 },
  light: { name: "Top Light", price: 28, height: 4 },
  fridge: { name: "Built-in Refrigerator", price: 240, height: 180 },
  washer: { name: "Washing Machine", price: 380, height: 85 },
  oven: { name: "Built-in Oven", price: 320, height: 60 },
  microwave: { name: "Built-in Microwave", price: 210, height: 45 },
  dishwasher: { name: "Integrated Dishwasher", price: 410, height: 82 },
  hob: { name: "Induction Hob", price: 260, height: 5 },
  sink: { name: "Built-in Sink", price: 180, height: 25 },
  extractor: { name: "Extractor Hood", price: 230, height: 35 },
  cargo: { name: "Pull-out Cargo Unit", price: 195, height: 120 },
};

export const DOOR_PRICE: Record<DoorStyle, number> = { flat: 55, glass: 89, framed: 72 };
export const CORNER_UNIT_PRICE = 180;
export const SLOPED_TOP_CUT_PRICE = 68;
export const SLOPED_DOOR_CUT_PRICE = 26;
export const PULLOUT_FRONT_PRICE = 58;
export const CELL_CARCASS_PRICE = 62;

export const MODULE_TYPES: { id: ModuleType; name: string; desc: string; price: number }[] = [
  { id: "door", name: "Hinged door", desc: "Solid front, one leaf", price: 55 },
  { id: "vitrine", name: "Glass vitrine", desc: "Clear front + 2 glass shelves", price: 135 },
  { id: "drawers", name: "Drawer stack", desc: "4 stacked drawer fronts", price: 185 },
  { id: "open", name: "Open cabinet", desc: "No door and no back panel", price: 0 },
];
export const MODULE_PRICE: Record<ModuleType, number> = {
  door: 55,
  vitrine: 135,
  drawers: 185,
  open: 0,
};

export type InteriorItem = {
  id: string;
  wall: WallId;
  bay: number;
  type: ItemType;
  y: number;
  /** Individual exterior drawer height in cm. */
  height?: number;
};

/* ---------------- Standalone modular units ---------------- */

export type UnitFront = "none" | "door" | "double" | "drawers" | "glass";

/* ---- Interior fittings (32 mm hole matrix) & door hardware ---- */

export type FittingType = "shelf" | "rail" | "drawer" | "basket" | "shoerack" | "cargo";

/** One interior fitting inside a unit. `y` = cm above the unit's inner base. */
export type Fitting = { id: string; type: FittingType; y: number };
/** Appliance position inside its cabinet. x/y are centimetres from the cabinet centre/base. */
export type UnitAppliance = { id: string; type: ApplianceType; x?: number; y: number };
export type CountertopMaterial = "stone" | "wood" | "laminate";

export type HandleStyle = "bar" | "knob" | "edge" | "profile" | "push";
export type HandlePos = "left" | "right" | "center";

export const HANDLE_STYLES: { id: HandleStyle; name: string }[] = [
  { id: "bar", name: "Bar" },
  { id: "knob", name: "Knob" },
  { id: "edge", name: "Edge profile" },
  { id: "profile", name: "Vertical profile" },
  { id: "push", name: "Push-to-open" },
];

export const HANDLE_POSITIONS: { id: HandlePos; name: string }[] = [
  { id: "left", name: "Left" },
  { id: "center", name: "Center" },
  { id: "right", name: "Right" },
];

export const UNIT_FRONTS: { id: UnitFront; name: string; desc: string; price: number }[] = [
  { id: "none", name: "Open", desc: "No front", price: 0 },
  { id: "door", name: "Single door", desc: "One hinged leaf", price: 55 },
  { id: "double", name: "Double doors", desc: "Two leaves", price: 98 },
  { id: "drawers", name: "Drawer front", desc: "3 exterior drawers", price: 165 },
  { id: "glass", name: "Glass door", desc: "Clear vitrine leaf", price: 120 },
];

/** One freestanding cabinet placed on the floor plan (cm, centre coordinates). */
export type Unit = {
  id: string;
  x: number;
  z: number;
  rot: number;
  w: number;
  h: number;
  d: number;
  /** Optional under-stairs profile for this individual Modular Assembly unit. */
  underStairs?: boolean;
  /** Height of the low side, in cm, when the unit has a sloped top. */
  slopeMinHeight?: number;
  /** Which side of the unit is the low side. */
  slopeSide?: "left" | "right";
  finish: FinishId;
  front: UnitFront;
  /** Number of horizontal front sections (1 full front, 2 or 3 stacked sections). */
  frontSections?: 1 | 2 | 3;
  /** Number of coplanar vertical front leaves; supports three-door sketch modules. */
  frontLeaves?: 1 | 2 | 3;
  /** Relative heights for stacked front sections, kept as sketch proportions. */
  frontSectionRatios?: number[];
  shelves: number;
  rail: boolean;
  drawers: number;
  /** Height of each exterior drawer front, in cm. */
  drawerHeight?: number;
  light: boolean;
  /** Elevation of the unit bottom above the floor, in cm. */
  y: number;
  /** Mounting preset. */
  mount: UnitMount;
  /** When false the unit ignores magnetic snapping (free-standing island). */
  snap: boolean;
  name?: string;
  /** Positioned interior fittings. Derived from the counts above when absent. */
  fittings?: Fitting[];
  /** Full-height appliances placed inside this modular unit. */
  appliances?: UnitAppliance[];
  /** Legacy field kept only so older files can be migrated to a housing module. */
  standaloneAppliance?: ApplianceType;
  /** Kitchen worktop sitting on top of the cabinet. */
  countertop?: boolean;
  countertopMaterial?: CountertopMaterial;
  /** Kitchen tap mounted above a sink on this cabinet. */
  faucet?: boolean;
  /** Vertical backsplash panel behind a kitchen worktop, in cm. */
  backsplash?: boolean;
  backsplashHeight?: number;
  handleStyle?: HandleStyle;
  handlePos?: HandlePos;
  /** Handle centre height, cm from the unit bottom. */
  handleY?: number;
  /** Vertical alignment preset of the handle (Straight Wall parity). */
  handleAlign?: HandleAlign;
  /** Door leaf construction — flat, glass insert or shaker frame. */
  doorStyle?: DoorStyle;
  /** Door surface material (Straight Wall parity). */
  doorMaterial?: DoorMaterial;
  /** When true the door leaves swing open in the 3D view. */
  open?: boolean;
  /** When true exterior drawer fronts slide forward in the 3D preview. */
  drawersOpen?: boolean;
  /** Hinge side of the door leaf. When absent it is derived from the handle side. */
  hingeSide?: "left" | "right";
  /** Per-leaf overrides, keyed by leaf index ("0", "1"). */
  leaves?: Record<string, LeafSpec>;
};

/** Individual door leaf customization inside one cabinet. */
export type LeafSpec = {
  material?: DoorMaterial;
  style?: DoorStyle;
  hinge?: "left" | "right";
  handleStyle?: HandleStyle;
  handlePos?: HandlePos;
  handleY?: number;
  open?: boolean;
  /** Hinge orientation / handle side, incl. push-to-open (Straight Wall parity). */
  side?: HandleSide;
  /** Vertical alignment preset of the handle. */
  align?: HandleAlign;
  /** Front type — hinged leaf or pull-out front. */
  mode?: DoorMode;
};

/** Number of door leaves a unit shows. */
export function leafCount(u: Unit): number {
  if (u.frontLeaves) return Math.max(1, Math.min(3, Math.round(u.frontLeaves)));
  if (u.front === "double") return 2;
  if (u.front === "door" || u.front === "glass") return 1;
  return 0;
}

/** Normalized stacked-front proportions; defaults to equal sections. */
export function frontSectionFractions(u: Unit): number[] {
  const count = Math.max(1, Math.min(3, u.frontSections ?? 1));
  const ratios = (u.frontSectionRatios ?? [])
    .slice(0, count)
    .map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const total = ratios.reduce((sum, value) => sum + value, 0);
  return total > 0 && ratios.length === count
    ? ratios.map((value) => value / total)
    : Array.from({ length: count }, () => 1 / count);
}

/** Resolve one leaf's settings, falling back to the cabinet-level values. */
export function leafSpec(u: Unit, i: number, sectionOverride?: LeafSpec) {
  const l = { ...(u.leaves?.[String(i)] ?? {}), ...(sectionOverride ?? {}) };
  const dbl = u.front === "double";
  const baseHinge = u.hingeSide ?? ((u.handlePos ?? "right") === "left" ? "right" : "left");
  const side = l.side;
  const align = (l.align ?? u.handleAlign ?? "center") as HandleAlign;
  const defaultHinge = l.hinge ?? (dbl ? (i === 0 ? "left" : "right") : baseHinge);
  const hinge: "left" | "right" =
    side === "left" ? "right" : side === "right" ? "left" : side === "push" ? "left" : defaultHinge;
  const defaultPos = (l.handlePos ??
    (dbl ? (i === 0 ? "right" : "left") : (u.handlePos ?? "right"))) as HandlePos;
  const handleStyle = (
    side === "push"
      ? "push"
      : align === "profile"
        ? "profile"
        : (l.handleStyle ?? u.handleStyle ?? "bar")
  ) as HandleStyle;
  const alignY =
    align === "top"
      ? Math.round(u.h * 0.85)
      : align === "bottom"
        ? Math.round(u.h * 0.15)
        : align === "profile"
          ? Math.round(u.h * 0.5)
          : undefined;
  return {
    material: (l.material ?? u.doorMaterial ?? "solid") as DoorMaterial,
    style: (l.style ?? u.doorStyle ?? "flat") as DoorStyle,
    hinge,
    side: (side ?? (hinge === "left" ? "right" : "left")) as HandleSide,
    align,
    mode: (l.mode ?? "hinged") as DoorMode,
    handleStyle,
    handlePos: side === "left" ? "left" : side === "right" ? "right" : defaultPos,
    handleY: l.handleY ?? alignY ?? u.handleY ?? Math.min(u.h - 20, 100),
    open: l.open ?? !!u.open,
  };
}

/** Resolve an individual horizontal front section, inheriting its door leaf settings. */
export function sectionSpec(u: Unit, leaf: number, section: number) {
  return leafSpec(u, leaf, u.leaves?.[`section-${leaf}-${section}`]);
}

export const sectionKey = (leaf: number, section: number) => `section-${leaf}-${section}`;

export type UnitMount = "base" | "wall" | "tall";

export const UNIT_MOUNTS: { id: UnitMount; name: string; desc: string; y: number; h?: number }[] = [
  { id: "base", name: "Base Unit", desc: "Sits on the floor", y: 0 },
  { id: "wall", name: "Wall Hanging", desc: "Floats at clearance", y: 140, h: 80 },
  { id: "tall", name: "Tall Tower", desc: "Floor to top", y: 0, h: 220 },
];

export const UNIT_LIMITS = { w: [30, 150], h: [40, 360], d: [25, 80], y: [0, 280] } as const;

export const clampUnit = (u: Unit): Unit => ({
  ...u,
  w: Math.max(UNIT_LIMITS.w[0], Math.min(UNIT_LIMITS.w[1], Math.round(u.w))),
  h: Math.max(UNIT_LIMITS.h[0], Math.min(UNIT_LIMITS.h[1], Math.round(u.h))),
  d: Math.max(UNIT_LIMITS.d[0], Math.min(UNIT_LIMITS.d[1], Math.round(u.d))),
  slopeSide: u.slopeSide ?? "right",
  y: Math.max(UNIT_LIMITS.y[0], Math.min(UNIT_LIMITS.y[1], Math.round(u.y ?? 0))),
  mount: u.mount ?? "base",
  snap: u.snap ?? true,
  ...(u.slopeMinHeight == null
    ? {}
    : {
        slopeMinHeight: Math.max(40, Math.min(Math.round(u.h) - 10, Math.round(u.slopeMinHeight))),
      }),
});

export const newUnit = (patch: Partial<Unit> = {}): Unit =>
  clampUnit({
    id: newId(),
    x: 0,
    z: 0,
    rot: 0,
    w: 60,
    h: 200,
    d: 60,
    finish: "greige",
    front: "door",
    frontSections: 1,
    // New cabinets start empty. Accessories are explicit user choices.
    shelves: 0,
    rail: false,
    drawers: 0,
    drawerHeight: ITEM_META.drawer.height,
    light: false,
    y: 0,
    mount: "base",
    snap: true,
    drawersOpen: false,
    appliances: [],
    countertop: false,
    countertopMaterial: "stone",
    faucet: false,
    backsplash: false,
    backsplashHeight: 60,
    ...patch,
  });

/**
 * Standard housing used when an appliance is placed as an individual module.
 * The returned carcass is deliberately a normal `Unit`, so it gets the same
 * drag, snap, duplicate, BOM and CNC behaviour as every other cabinet.
 */
export type ApplianceModuleSpec = {
  w: number;
  h: number;
  d: number;
  y: number;
  mount: UnitMount;
  front: UnitFront;
  countertop: boolean;
  countertopMaterial: CountertopMaterial;
  faucet: boolean;
  label: string;
  applianceTypes: readonly ApplianceType[];
};

export function applianceModuleSpec(type: ApplianceType): ApplianceModuleSpec {
  switch (type) {
    case "fridge":
      return {
        w: 60,
        h: 220,
        d: 60,
        y: 0,
        mount: "tall",
        front: "none",
        countertop: false,
        countertopMaterial: "stone",
        faucet: false,
        label: "Fridge tower",
        applianceTypes: ["fridge"],
      };
    case "microwave":
      return {
        w: 60,
        h: 80,
        d: 40,
        y: 140,
        mount: "wall",
        front: "none",
        countertop: false,
        countertopMaterial: "stone",
        faucet: false,
        label: "Built-in microwave wall module",
        applianceTypes: ["microwave"],
      };
    case "extractor":
      return {
        w: 60,
        h: 75,
        d: 35,
        y: 155,
        mount: "wall",
        front: "none",
        countertop: false,
        countertopMaterial: "stone",
        faucet: false,
        label: "Extractor wall module",
        applianceTypes: ["extractor"],
      };
    case "washer":
      return {
        w: 60,
        h: 80,
        d: 60,
        y: 0,
        mount: "base",
        front: "none",
        countertop: true,
        countertopMaterial: "stone",
        faucet: false,
        label: "Washing machine base module",
        applianceTypes: ["washer"],
      };
    case "dishwasher":
      return {
        w: 60,
        h: 80,
        d: 60,
        y: 0,
        mount: "base",
        front: "none",
        countertop: true,
        countertopMaterial: "stone",
        faucet: false,
        label: "Dishwasher base module",
        applianceTypes: ["dishwasher"],
      };
    case "oven":
      return {
        w: 60,
        h: 80,
        d: 60,
        y: 0,
        mount: "base",
        front: "none",
        countertop: true,
        countertopMaterial: "stone",
        faucet: false,
        label: "Oven + hob base module",
        applianceTypes: ["oven", "hob"],
      };
    case "sink":
      return {
        w: 60,
        h: 80,
        d: 60,
        y: 0,
        mount: "base",
        front: "door",
        countertop: true,
        countertopMaterial: "stone",
        faucet: true,
        label: "Sink base module",
        applianceTypes: ["sink"],
      };
    case "hob":
      return {
        w: 60,
        h: 80,
        d: 60,
        y: 0,
        mount: "base",
        front: "door",
        countertop: true,
        countertopMaterial: "stone",
        faucet: false,
        label: "Hob base module",
        applianceTypes: ["hob"],
      };
  }
}

export const unitPrice = (u: Unit) =>
  u.standaloneAppliance
    ? ITEM_META[u.standaloneAppliance].price
    : Math.round(
        70 +
          u.w * u.h * 0.0042 +
          u.d * 0.8 +
          (UNIT_FRONTS.find((f) => f.id === u.front)?.price ?? 0) +
          (u.front !== "none"
            ? (DOOR_MATERIALS.find((m) => m.id === (u.doorMaterial ?? "solid"))?.price ?? 0)
            : 0) +
          u.shelves * ITEM_META.shelf.price +
          (u.rail ? ITEM_META.rail.price : 0) +
          u.drawers * ITEM_META.drawer.price +
          (u.light ? ITEM_META.light.price : 0) +
          (u.countertop ? 80 + u.w * 0.45 : 0) +
          (u.faucet ? 95 : 0) +
          (u.backsplash ? 28 + u.w * 0.18 : 0) +
          (u.appliances ?? []).reduce((sum, appliance) => sum + ITEM_META[appliance.type].price, 0),
      );

export type Config = {
  roomShape: RoomShape;
  width: number;
  wallB: number;
  wallC: number;
  aisle: number;
  height: number;
  depth: number;
  finish: FinishId;
  doorStyle: DoorStyle;
  showDoors: boolean;
  showDimensions: boolean;
  openDoors: boolean;
  openDrawers?: boolean;
  items: InteriorItem[];
  doorMaterials: Record<string, DoorMaterial>;
  doorHandles: Record<
    string,
    { side: HandleSide; align: HandleAlign; style?: HandleStyle; position?: number }
  >;
  /** Per-door front type: hinged leaf or full pull-out front. */
  doorModes: Record<string, DoorMode>;
  /** Per-compartment option for two side-by-side door leaves. */
  doorSplits: Record<string, boolean>;
  /** Number of horizontal door leaves for each compartment (1 = one door). */
  doorSections: Record<string, number>;
  /** Per-wall overrides. Missing values fall back to the base config. */
  wallSpecs: Partial<Record<WallId, Partial<WallSpec>>>;
  /** Under-Stairs mode only: number of equal step modules along the run. */
  usModules: number;
  /** Under-stairs plinth height in cm. Older saved designs fall back to 5 cm. */
  underStairsPlinth?: number;
  /** Optional straight cabinet run placed beside the under-stairs run. */
  underStairsExtraRun?: boolean;
  /** Number of straight cabinet units in the optional companion run. */
  underStairsExtraUnits?: number;
  /** Grid builder: independent column widths (cm) per wall. Empty = auto equal bays. */
  colWidths: Partial<Record<WallId, number[]>>;
  /** Grid builder: horizontal split height (cm) per column, key `${wall}${col}`. */
  splits: Record<string, number>;
  /** Grid builder: independent total height (cm) per column, key `${wall}${col}`. */
  colHeights: Record<string, number>;
  /** Grid builder: independent depth (cm) per column, key `${wall}${col}`. */
  colDepths: Record<string, number>;
  /** Grid builder: module filling each cell, key `${wall}${col}:${level}`. */
  modules: Record<string, ModuleType>;
  /** Explicit open-front cells, including legacy non-grid runs. */
  openCells?: Record<string, boolean>;
  /** Modular Assembly mode: freestanding units snapped on the floor plan. */
  units: Unit[];
  /** Modular Assembly room envelope in centimetres. Back wall is z = 0. */
  modularRoom: ModularRoom;
  /** Shared CNC material and nesting settings. */
  cnc?: CncSettings;
};

export type CncSettings = {
  panelThickness: number;
  backThickness: number;
  kerf: number;
  sheetWidth: number;
  sheetHeight: number;
  sheetMargin: number;
};

export const DEFAULT_CNC_SETTINGS: CncSettings = {
  panelThickness: 18,
  backThickness: 3,
  kerf: 4,
  sheetWidth: 2800,
  sheetHeight: 2070,
  sheetMargin: 10,
};

export type ModularRoom = {
  width: number;
  depth: number;
  height: number;
  wallThickness: number;
  entryWidth: number;
};

export const DEFAULT_MODULAR_ROOM: ModularRoom = {
  // Generous IKEA-style planning envelope for complete kitchen runs and tall columns.
  width: 800,
  depth: 600,
  height: 300,
  wallThickness: 12,
  entryWidth: 110,
};

/** Everything a single wall segment owns independently. */
export type WallSpec = {
  height: number;
  depth: number;
  finish: FinishId;
  doorStyle: DoorStyle;
  slope: SlopeSpec;
};

export const bayCount = (width: number) => Math.max(1, Math.min(6, Math.round(width / 50)));

/** Section count of a run — Under-Stairs mode uses fixed equal step modules. */
export const bayCountOf = (c: Config, wall: WallId = "a") =>
  gridCols(c, wall)?.length ??
  (c.roomShape === "understairs" && wall === "a"
    ? Math.max(2, Math.min(6, Math.round(c.usModules || 3)))
    : bayCount(runWidth(c, wall)));

export const runWidth = (c: Config, wall: WallId) => {
  const cols = gridCols(c, wall);
  if (cols) return Math.round(cols.reduce((s, v) => s + v, 0));
  return wall === "a" ? c.width : wall === "b" ? c.wallB : c.wallC;
};

/* ---------------- Modular grid builder ---------------- */

export const colKey = (wall: WallId, col: number) => `${wall}${col}`;
export const cellKey = (wall: WallId, col: number, level: number) => `${wall}${col}:${level}`;

/** Custom column widths of a wall, or null when the run uses auto equal bays. */
export function gridCols(c: Config, wall: WallId): number[] | null {
  // Under-Stairs modules are controlled only by Step modules. Ignore legacy
  // custom widths on the sloped run so old designs do not lock the layout.
  if (c.roomShape === "understairs" && wall === "a") return null;
  const raw = c.colWidths?.[wall];
  if (!raw || raw.length === 0) return null;
  return raw.map((v) => Math.max(20, Math.min(150, Math.round(v))));
}

export const isGrid = (c: Config, wall: WallId) => gridCols(c, wall) !== null;

/** Turn the grid builder on for a wall, seeded from the current auto bays. */
export const enableGrid = (c: Config, wall: WallId): Config => ({
  ...c,
  colWidths: {
    ...c.colWidths,
    [wall]: bayWidths(c, wall).map((w) => Math.max(20, Math.min(150, Math.round(w)))),
  },
});

export const disableGrid = (c: Config, wall: WallId): Config => {
  const next = { ...(c.colWidths ?? {}) };
  delete next[wall];
  return { ...c, colWidths: next };
};

export const setColWidth = (c: Config, wall: WallId, col: number, v: number): Config => {
  const cols = gridCols(c, wall) ?? bayWidths(c, wall).map((w) => Math.round(w));
  const next = cols.map((w, i) => (i === col ? Math.max(20, Math.min(150, v)) : w));
  return { ...c, colWidths: { ...c.colWidths, [wall]: next } };
};

export const addColumn = (c: Config, wall: WallId): Config => {
  const cols = gridCols(c, wall) ?? bayWidths(c, wall).map((w) => Math.round(w));
  if (cols.length >= 8) return c;
  return { ...c, colWidths: { ...c.colWidths, [wall]: [...cols, cols[cols.length - 1] ?? 60] } };
};

export const removeColumn = (c: Config, wall: WallId, col: number): Config => {
  const cols = gridCols(c, wall) ?? bayWidths(c, wall).map((w) => Math.round(w));
  if (cols.length <= 1) return c;
  // shift every per-column record down so column params never leak sideways
  const shift = <T>(rec: Record<string, T>) => {
    const out: Record<string, T> = {};
    for (const [k, v] of Object.entries(rec ?? {})) {
      const m = k.match(/^([abc])(\d+)(:\d+)?$/);
      if (!m || m[1] !== wall) {
        out[k] = v;
        continue;
      }
      const i = Number(m[2]);
      if (i === col) continue;
      out[`${wall}${i > col ? i - 1 : i}${m[3] ?? ""}`] = v;
    }
    return out;
  };
  return {
    ...c,
    colWidths: { ...c.colWidths, [wall]: cols.filter((_, i) => i !== col) },
    splits: shift(c.splits ?? {}),
    colHeights: shift(c.colHeights ?? {}),
    colDepths: shift(c.colDepths ?? {}),
    modules: shift(c.modules ?? {}),
    openCells: shift(c.openCells ?? {}),
    items: c.items.filter((i) => !(i.wall === wall && i.bay === col)),
  };
};

/** Independent total height (cm) of one grid column. */
export const colHeight = (c: Config, wall: WallId, col: number): number => {
  const v = c.colHeights?.[colKey(wall, col)];
  if (v && v >= 40) return Math.min(300, Math.round(v));
  if (c.roomShape === "understairs" && slopeOf(c, wall).on) {
    return Math.round(bayHeights(c, wall, col).min);
  }
  return wallSpec(c, wall).height;
};

/** Independent depth (cm) of one grid column. */
export const colDepth = (c: Config, wall: WallId, col: number): number => {
  const v = c.colDepths?.[colKey(wall, col)];
  return v && v >= 20 ? Math.min(90, Math.round(v)) : wallSpec(c, wall).depth;
};

export const setColHeight = (c: Config, wall: WallId, col: number, v: number): Config => ({
  ...c,
  colHeights: { ...c.colHeights, [colKey(wall, col)]: Math.max(40, Math.min(300, Math.round(v))) },
});

export const setColDepth = (c: Config, wall: WallId, col: number, v: number): Config => ({
  ...c,
  colDepths: { ...c.colDepths, [colKey(wall, col)]: Math.max(20, Math.min(90, Math.round(v))) },
});

/** Horizontal split height (cm) of a column, or null when it is one tall cell. */
export function splitOf(c: Config, wall: WallId, col: number): number | null {
  const h = colHeight(c, wall, col);
  const v = c.splits?.[colKey(wall, col)];
  if (!v || v < 20 || v > h - 20) return null;
  return Math.round(v);
}

export const setSplit = (c: Config, wall: WallId, col: number, v: number | null): Config => {
  const next = { ...(c.splits ?? {}) };
  if (v === null) delete next[colKey(wall, col)];
  else next[colKey(wall, col)] = Math.round(v);
  return { ...c, splits: next };
};

/** Vertical cells of one column, bottom-up, in cm from the carcass floor. */
export function gridCells(
  c: Config,
  wall: WallId,
  col: number,
): { level: number; y0: number; h: number }[] {
  const H = colHeight(c, wall, col);
  const s = splitOf(c, wall, col);
  if (s === null) return [{ level: 0, y0: 0, h: H }];
  return [
    { level: 0, y0: 0, h: s },
    { level: 1, y0: s, h: H - s },
  ];
}

export const moduleOf = (c: Config, wall: WallId, col: number, level: number): ModuleType =>
  c.modules?.[cellKey(wall, col, level)] ?? "door";

export const setModule = (
  c: Config,
  wall: WallId,
  col: number,
  level: number,
  m: ModuleType,
): Config => {
  const key = cellKey(wall, col, level);
  const openCells = { ...(c.openCells ?? {}) };
  if (m !== "open") delete openCells[key];
  return {
    ...c,
    modules: { ...c.modules, [key]: m },
    openCells,
  };
};

/** Resolved, independent spec of one wall segment. */
export const wallSpec = (c: Config, wall: WallId): WallSpec => {
  const o = c.wallSpecs?.[wall] ?? {};
  return {
    height: o.height ?? c.height,
    depth: o.depth ?? c.depth,
    finish: o.finish ?? c.finish,
    doorStyle: o.doorStyle ?? c.doorStyle,
    slope: {
      on: false,
      side: "right",
      maxHeight: o.height ?? c.height,
      minHeight: Math.max(60, Math.round((o.height ?? c.height) * 0.5)),
      ...(o.slope ?? {}),
    },
  };
};

/** Write per-wall overrides without touching any other wall. */
export const setWallSpec = (c: Config, wall: WallId, patch: Partial<WallSpec>): Config => ({
  ...c,
  wallSpecs: { ...c.wallSpecs, [wall]: { ...(c.wallSpecs?.[wall] ?? {}), ...patch } },
});

/** Set the total width (length) of a single wall segment. */
export const setWallWidth = (c: Config, wall: WallId, v: number): Config =>
  wall === "a" ? { ...c, width: v } : wall === "b" ? { ...c, wallB: v } : { ...c, wallC: v };

/** Resolved slope of a wall, with Max clamped to the carcass height. */
export function slopeOf(c: Config, wall: WallId): SlopeSpec {
  const s = wallSpec(c, wall);
  const max = Math.min(s.height, Math.max(80, s.slope.maxHeight));
  const min = Math.min(max - 5, Math.max(40, s.slope.minHeight));
  return {
    // Only the cabinet under the stairs is forced to follow the slope. An
    // optional companion run (wall b) remains a straight cabinet and must use
    // its configured full height.
    on: c.roomShape === "understairs" && wall === "a" ? true : s.slope.on,
    side: s.slope.side,
    maxHeight: max,
    minHeight: min,
  };
}

/** Pitch angle in degrees derived from Max/Min height over the run length. */
export function slopeAngle(c: Config, wall: WallId): number {
  const sl = slopeOf(c, wall);
  const L = runWidth(c, wall);
  if (!L) return 0;
  return +(Math.atan2(sl.maxHeight - sl.minHeight, L) * (180 / Math.PI)).toFixed(1);
}

/** Set the pitch angle by recomputing Min height for the current length. */
export function setSlopeAngle(c: Config, wall: WallId, deg: number): Config {
  const sl = slopeOf(c, wall);
  const L = runWidth(c, wall);
  const min = Math.round(sl.maxHeight - Math.tan((deg * Math.PI) / 180) * L);
  return setWallSpec(c, wall, {
    slope: { ...sl, minHeight: Math.min(sl.maxHeight - 5, Math.max(40, min)) },
  });
}

/** Ceiling height (cm) at a distance x (cm) from the run left edge. */
export function heightAtCm(c: Config, wall: WallId, x: number): number {
  const s = wallSpec(c, wall);
  const sl = slopeOf(c, wall);
  if (!sl.on) return s.height;
  const L = Math.max(1, runWidth(c, wall));
  const t = Math.min(1, Math.max(0, x / L));
  return sl.side === "left"
    ? sl.maxHeight - (sl.maxHeight - sl.minHeight) * t
    : sl.minHeight + (sl.maxHeight - sl.minHeight) * t;
}

/** Left / right / usable (lowest) top height of one bay, in cm. */
export function bayHeights(c: Config, wall: WallId, bay: number) {
  const offs = bayOffsets(c, wall);
  const ws = bayWidths(c, wall);
  const x0 = offs[bay] ?? 0;
  const w = ws[bay] ?? 0;
  const left = heightAtCm(c, wall, x0);
  const right = heightAtCm(c, wall, x0 + w);
  return { left, right, min: Math.min(left, right), max: Math.max(left, right) };
}

export const doorModeOf = (c: Config, wall: WallId, bay: number): DoorMode =>
  c.doorModes?.[doorKey(wall, bay)] ?? "hinged";

export const doorSplitOf = (c: Config, wall: WallId, bay: number, level = 0): boolean =>
  !!c.doorSplits?.[cellKey(wall, bay, level)];

export const doorPartsOf = (c: Config, wall: WallId, bay: number, level = 0): number => {
  const key = cellKey(wall, bay, level);
  const configured = c.doorSections?.[key];
  if (configured != null) return Math.max(1, Math.min(6, Math.round(configured)));
  return c.doorSplits?.[key] ? 2 : 1;
};

export const walls = (c: Config): WallId[] =>
  c.roomShape === "modular"
    ? []
    : c.roomShape === "straight"
      ? ["a"]
      : c.roomShape === "understairs"
        ? c.underStairsExtraRun
          ? ["a", "b"]
          : ["a"]
        : c.roomShape === "ushape"
          ? ["a", "b", "c"]
          : ["a", "b"];

/** Human labels for each wall segment, per layout. */
export const wallLabel = (shape: RoomShape, wall: WallId) => {
  if (shape === "understairs") return wall === "a" ? "Under-stairs run" : "Straight side run";
  if (shape === "galley") return wall === "a" ? "Run A (front)" : "Run B (facing)";
  if (shape === "ushape")
    return wall === "a" ? "Back wall" : wall === "b" ? "Left return" : "Right return";
  return `Wall ${wall.toUpperCase()}`;
};

export const doorKey = (wall: WallId, bay: number) => `${wall}${bay}`;

export const doorMaterialOf = (c: Config, wall: WallId, bay: number): DoorMaterial =>
  c.doorMaterials[doorKey(wall, bay)] ?? "solid";

export const handleOf = (
  c: Config,
  wall: WallId,
  bay: number,
): { side: HandleSide; align: HandleAlign; style: HandleStyle; position?: number } => {
  const configured = c.doorHandles?.[doorKey(wall, bay)];
  return {
    side: configured?.side ?? (bay % 2 === 0 ? "right" : "left"),
    align: configured?.align ?? "center",
    style: configured?.style ?? "bar",
    ...(configured?.position != null
      ? { position: Math.max(8, Math.min(92, Math.round(configured.position))) }
      : {}),
  };
};

/** Index of the bay holding a built-in fridge on a wall, or null. */
export function fridgeBay(c: Config, wall: WallId): number | null {
  const it = c.items.find((i) => i.wall === wall && i.type === "fridge");
  return it ? it.bay : null;
}

/** Per-bay widths (cm). A fridge bay is locked to 60 cm, the rest share the remainder. */
export function bayWidths(c: Config, wall: WallId): number[] {
  // Grid builder: every column owns its own width — never average the total.
  const grid = gridCols(c, wall);
  if (grid) return grid;
  const total = runWidth(c, wall);
  const n = bayCountOf(c, wall);
  const w = Array.from({ length: n }, () => total / n);
  const f = fridgeBay(c, wall);
  if (f !== null && f < n && n > 1) {
    const rest = (total - FRIDGE_W) / (n - 1);
    if (rest >= 30) for (let i = 0; i < n; i++) w[i] = i === f ? FRIDGE_W : rest;
  }
  return w;
}

/** Left edge offset (cm) of each bay measured from the run's left side. */
export function bayOffsets(c: Config, wall: WallId): number[] {
  const w = bayWidths(c, wall);
  const out: number[] = [];
  let acc = 0;
  for (const v of w) {
    out.push(acc);
    acc += v;
  }
  return out;
}

export const framePrice = (c: Config, wall: WallId = "a") => {
  const width = runWidth(c, wall);
  const s = wallSpec(c, wall);
  return Math.round(80 + (width * s.height * 0.0055 + s.depth * 0.9) * bayCountOf(c, wall) * 0.55);
};

export type BomLine = { key: string; label: string; qty: number; unit: number; sku?: string };

function modularBomLines(c: Config): BomLine[] {
  const groups = new Map<string, BomLine>();
  c.units.forEach((unit) => {
    if (unit.standaloneAppliance) {
      const type = unit.standaloneAppliance;
      const key = `standalone-${type}`;
      const existing = groups.get(key);
      if (existing) existing.qty += 1;
      else {
        groups.set(key, {
          key,
          label: `Freestanding · ${ITEM_META[type].name}`,
          qty: 1,
          unit: ITEM_META[type].price,
          sku: skuForBomKey(type),
        });
      }
      return;
    }
    const fittingsKey = (unit.fittings ?? [])
      .map((fitting) => `${fitting.type}:${fitting.y}`)
      .sort()
      .join(",");
    const appliancesKey = (unit.appliances ?? [])
      .map((appliance) => `${appliance.type}:${appliance.y}`)
      .sort()
      .join(",");
    const key = `${unit.w}x${unit.h}x${unit.d}|${unit.front}|${unit.doorMaterial ?? "solid"}|${unit.finish}|top:${unit.countertop ? (unit.countertopMaterial ?? "stone") : "none"}|tap:${unit.faucet ? "yes" : "no"}|splash:${unit.backsplash ? (unit.backsplashHeight ?? 60) : "none"}|f:${fittingsKey}|a:${appliancesKey}`;
    const existing = groups.get(key);
    if (existing) existing.qty += 1;
    else {
      groups.set(key, {
        key: `unit-${key}`,
        label: `Cabinet · ${unit.w}×${unit.h}×${unit.d} cm · ${unit.front}${unit.countertop ? " · countertop" : ""}${unit.faucet ? " · faucet" : ""}${unit.backsplash ? " · backsplash" : ""}`,
        qty: 1,
        unit: unitPrice(unit),
        sku: "WW-CAB-MODULAR",
      });
    }
  });
  return [...groups.values()];
}

export function billOfMaterials(c: Config): BomLine[] {
  const lines: BomLine[] = [];
  if (c.roomShape === "modular") {
    c.units.forEach((u, i) => {
      lines.push({
        key: `unit-${u.id}`,
        label: `Unit ${i + 1} · ${u.w}×${u.h}×${u.d} cm`,
        qty: 1,
        unit: unitPrice(u),
      });
    });
    return modularBomLines(c);
  }
  for (const wall of walls(c)) {
    lines.push({
      key: `frame-${wall}`,
      label:
        c.roomShape !== "straight"
          ? `Frame · ${wallLabel(c.roomShape, wall)} (${bayCountOf(c, wall)} bay)`
          : `Main Frame (${bayCountOf(c, wall)} bay)`,
      qty: 1,
      unit: framePrice(c, wall),
    });
  }
  for (const wall of walls(c)) {
    const sl = slopeOf(c, wall);
    if (!sl.on) continue;
    const n = bayCountOf(c, wall);
    lines.push({
      key: `slope-top-${wall}`,
      label: `Sloped top panel cut · ${wallLabel(c.roomShape, wall)} (${slopeAngle(c, wall)}°, ${sl.maxHeight}→${sl.minHeight} cm)`,
      qty: n,
      unit: SLOPED_TOP_CUT_PRICE,
    });
    if (c.showDoors) {
      const angled = Array.from({ length: n }, (_, i) => i).filter(
        (i) =>
          doorModeOf(c, wall, i) === "hinged" &&
          bayHeights(c, wall, i).left !== bayHeights(c, wall, i).right,
      ).length;
      if (angled)
        lines.push({
          key: `slope-door-${wall}`,
          label: `Angled door mitre cut · ${wallLabel(c.roomShape, wall)}`,
          qty: angled,
          unit: SLOPED_DOOR_CUT_PRICE,
        });
    }
  }
  if (c.showDoors) {
    const pull = walls(c).reduce(
      (s, wall) =>
        s +
        (isGrid(c, wall)
          ? 0
          : Array.from({ length: bayCountOf(c, wall) }, (_, i) => i).filter(
              (i) => doorModeOf(c, wall, i) === "pullout",
            ).length),
      0,
    );
    if (pull)
      lines.push({
        key: "pullout-fronts",
        label: "Pull-out front + heavy-duty runners",
        qty: pull,
        unit: PULLOUT_FRONT_PRICE,
      });
  }
  if (c.roomShape === "lshape")
    lines.push({ key: "corner", label: "Smart Corner Unit", qty: 1, unit: CORNER_UNIT_PRICE });

  if (c.showDoors) {
    // grouped per wall door style, since each wall carries its own style
    const byMat = new Map<string, number>();
    for (const wall of walls(c)) {
      if (isGrid(c, wall)) continue;
      const n = bayCountOf(c, wall);
      const style = wallSpec(c, wall).doorStyle;
      for (let i = 0; i < n; i++) {
        const m = doorMaterialOf(c, wall, i);
        // fridge bays get a split (2-part) front
        const qty = fridgeBay(c, wall) === i ? 2 : 1;
        const k = `${style}|${m}`;
        byMat.set(k, (byMat.get(k) ?? 0) + qty);
      }
    }
    for (const ds of DOOR_STYLES)
      for (const mat of DOOR_MATERIALS) {
        const qty = byMat.get(`${ds.id}|${mat.id}`) ?? 0;
        if (!qty) continue;
        lines.push({
          key: `doors-${ds.id}-${mat.id}`,
          label: mat.id === "solid" ? `${ds.name} Doors` : `${mat.name} Doors · ${ds.name}`,
          qty,
          unit: DOOR_PRICE[ds.id] + mat.price,
        });
      }
  }

  (Object.keys(ITEM_META) as ItemType[]).forEach((t) => {
    const qty = c.items.filter((i) => i.type === t).length;
    if (qty) lines.push({ key: t, label: ITEM_META[t].name, qty, unit: ITEM_META[t].price });
  });

  // modular grid walls: carcass cells + per-module fronts
  for (const wall of walls(c)) {
    if (!isGrid(c, wall)) continue;
    const n = bayCountOf(c, wall);
    const counts: Record<ModuleType, number> = { door: 0, vitrine: 0, drawers: 0, open: 0 };
    let cells = 0;
    for (let col = 0; col < n; col++)
      for (const cell of gridCells(c, wall, col)) {
        const m = moduleOf(c, wall, col, cell.level);
        counts[m] += 1;
        if (m !== "open") cells += 1;
      }
    if (cells)
      lines.push({
        key: `grid-carcass-${wall}`,
        label: `Grid carcass cells · ${wallLabel(c.roomShape, wall)}`,
        qty: cells,
        unit: CELL_CARCASS_PRICE,
      });
    for (const mt of MODULE_TYPES) {
      const qty = counts[mt.id];
      if (!qty || mt.id === "open") continue;
      lines.push({
        key: `grid-${mt.id}-${wall}`,
        label: `${mt.name} · ${wallLabel(c.roomShape, wall)}`,
        qty,
        unit: mt.price,
      });
    }
  }
  return lines.map((line) => ({ ...line, sku: line.sku ?? skuForBomKey(line.key) }));
}

export const totalPrice = (c: Config) => billOfMaterials(c).reduce((s, l) => s + l.qty * l.unit, 0);

/** Snap new items to free 10cm intervals inside a bay, bottom-up. */
export function nextFreeY(c: Config, wall: WallId, bay: number, type: ItemType): number {
  const inner = bayHeights(c, wall, bay).min - 8;
  if (type === "light") return inner - 6;
  if (type === "fridge" || type === "washer" || type === "cargo") return 4;
  const taken = c.items.filter((i) => i.wall === wall && i.bay === bay).map((i) => i.y);
  const start = 20;
  for (let y = start; y < inner - 10; y += 10) {
    if (!taken.some((t) => Math.abs(t - y) < 12)) return y;
  }
  return start;
}

let seq = 0;
export const newId = () => `i${++seq}-${Date.now().toString(36)}`;

/**
 * Guarantee every unit has a unique id and its own `leaves` object.
 * Duplicated ids made per-door edits (open/close, hinge, handle) leak into
 * every twin unit, so any config coming from a link, cloud or clipboard is
 * normalised here.
 */
export const dedupeUnitIds = (units: Unit[]): Unit[] => {
  const seen = new Set<string>();
  const seenNested = new Set<string>();
  return units.map((u) => {
    const next: Unit = { ...u };
    if (u.leaves) {
      next.leaves = Object.fromEntries(
        Object.entries(u.leaves).map(([k, v]) => [k, { ...v }]),
      ) as Record<string, LeafSpec>;
    }
    if (u.fittings) {
      next.fittings = u.fittings.map((fitting) => {
        const id = !fitting.id || seenNested.has(fitting.id) ? newId() : fitting.id;
        seenNested.add(id);
        return { ...fitting, id };
      });
    }
    if (u.appliances) {
      next.appliances = u.appliances.map((appliance) => {
        const id = !appliance.id || seenNested.has(appliance.id) ? newId() : appliance.id;
        seenNested.add(id);
        return { ...appliance, id };
      });
    }
    if (!next.id || seen.has(next.id)) next.id = newId();
    seen.add(next.id);
    return next;
  });
};

/**
 * Enter the under-stairs preset based on the supplied hand sketch:
 * approximately 370 cm wide, 250 cm high at the right and 50 cm at the left.
 * All values remain editable in the room controls.
 */
export const enterUnderStairs = (c: Config): Config => {
  const base: Config = {
    ...c,
    roomShape: "understairs",
    usModules: 3,
    // Start from the complete under-stairs composition shown in the preset:
    // three sloped modules plus one straight companion appliance unit.
    underStairsExtraRun: true,
    underStairsExtraUnits: 1,
    underStairsPlinth: 5,
    width: 195,
    wallB: 81,
    items: [{ id: newId(), wall: "b", bay: 0, type: "washer", y: 4 }],
    openCells: {},
    doorModes: {},
    doorSplits: {},
    doorSections: {},
    doorMaterials: {},
    doorHandles: {},
    showDoors: true,
    showDimensions: true,
    openDoors: false,
    openDrawers: false,
    wallSpecs: {
      ...c.wallSpecs,
      a: {
        height: 168,
        depth: 60,
        finish: c.finish,
        doorStyle: c.doorStyle,
        slope: { on: true, side: "right", maxHeight: 168, minHeight: 50 },
      },
      b: {
        height: 168,
        depth: 60,
        finish: c.finish,
        doorStyle: c.doorStyle,
        slope: { on: false, side: "right", maxHeight: 168, minHeight: 168 },
      },
    },
    // The sloped run uses equal modules derived from usModules.
    colWidths: { b: [81] },
    splits: { a1: 84 },
    modules: {
      "a0:0": "door",
      "a1:0": "door",
      "a1:1": "door",
      "a2:0": "door",
      "b0:0": "open",
    },
  };
  return base;
};

/** Leave Under-Stairs mode: reset to a plain straight-style run, clean canvas. */
export const exitUnderStairs = (c: Config, shape: RoomShape): Config => ({
  ...c,
  roomShape: shape,
  items: [],
  doorModes: {},
  doorSplits: {},
  doorSections: {},
  wallSpecs: {},
});

/** Enter Modular Assembly mode on a clean canvas. */
export const enterModular = (c: Config): Config => ({
  ...c,
  roomShape: "modular",
  items: [],
  wallSpecs: {},
  colWidths: {},
  units: c.units,
});

export const defaultConfig = (): Config => ({
  roomShape: "modular",
  width: 100,
  wallB: 150,
  wallC: 150,
  aisle: 120,
  height: 236,
  depth: 60,
  finish: "greige",
  doorStyle: "flat",
  showDoors: true,
  showDimensions: true,
  openDoors: false,
  openDrawers: false,
  doorMaterials: {},
  doorHandles: {},
  doorModes: {},
  doorSplits: {},
  doorSections: {},
  wallSpecs: {},
  usModules: 3,
  underStairsPlinth: 5,
  colWidths: {},
  splits: {},
  colHeights: {},
  colDepths: {},
  modules: {},
  openCells: {},
  // Scene-based architecture: start with a clean canvas; users add cabinets explicitly.
  units: [],
  items: [],
  modularRoom: { ...DEFAULT_MODULAR_ROOM },
  cnc: { ...DEFAULT_CNC_SETTINGS },
});
