import { newUnit, type Config, type Unit } from "./wardrobe";

export const PRESET_CATEGORIES = [
  "Kitchen",
  "Wardrobe / Dressing",
  "Living / TV Unit",
  "Bathroom",
] as const;

export type PresetCategory = (typeof PRESET_CATEGORIES)[number];

export type CabinetPreset = {
  id: string;
  name: string;
  category: PresetCategory;
  unit: Omit<Unit, "id" | "x" | "z">;
};

export type KitchenLayoutPreset = {
  id: string;
  name: string;
  description: string;
  units: Array<Partial<Omit<Unit, "id">>>;
};

export type SavedKitchenLayout = {
  id: string;
  name: string;
  createdAt: string;
  units: Array<Partial<Omit<Unit, "id">>>;
  /** Full project snapshot for projects saved by the current planner. */
  config?: Config;
};

/** Built-in complete kitchen layout based on the supplied L-shaped reference. */
export const KITCHEN_LAYOUT_PRESETS: KitchenLayoutPreset[] = [
  {
    id: "l-kitchen-reference",
    name: "L-Kitchen · Sink + Hob + Tall Fridge",
    description: "Complete L-run with sink, oven/hob, drawers, wall cabinets and tall fridge.",
    units: [
      {
        x: -250,
        z: 30,
        w: 60,
        h: 80,
        d: 60,
        finish: "white",
        countertop: true,
        countertopMaterial: "stone",
        backsplash: true,
        faucet: true,
        appliances: [{ id: "sink", type: "sink", y: 4 }],
      },
      {
        x: -190,
        z: 30,
        w: 60,
        h: 80,
        d: 60,
        finish: "white",
        countertop: true,
        countertopMaterial: "stone",
        backsplash: true,
        appliances: [{ id: "dishwasher", type: "dishwasher", y: 4 }],
      },
      {
        x: -130,
        z: 30,
        w: 60,
        h: 80,
        d: 60,
        finish: "white",
        countertop: true,
        countertopMaterial: "stone",
        backsplash: true,
        appliances: [
          { id: "oven", type: "oven", y: 4 },
          { id: "hob", type: "hob", y: 4 },
        ],
      },
      {
        x: -70,
        z: 30,
        w: 60,
        h: 80,
        d: 60,
        finish: "white",
        front: "drawers",
        drawers: 3,
        countertop: true,
        countertopMaterial: "stone",
        backsplash: true,
      },
      {
        x: 250,
        z: 30,
        w: 60,
        h: 220,
        d: 60,
        finish: "white",
        mount: "tall",
        appliances: [{ id: "fridge", type: "fridge", y: 4 }],
      },
      ...[-250, -190, -130, -70, -10].map((x, index) => ({
        x,
        z: 17.5,
        w: 60,
        h: 80,
        d: 35,
        y: 140,
        mount: "wall" as const,
        finish: "white" as const,
        front: index === 2 ? ("glass" as const) : ("door" as const),
      })),
      {
        x: -370,
        z: 120,
        rot: 90,
        w: 60,
        h: 80,
        d: 60,
        finish: "white",
        countertop: true,
        countertopMaterial: "stone",
        backsplash: true,
      },
      {
        x: -370,
        z: 180,
        rot: 90,
        w: 60,
        h: 80,
        d: 60,
        finish: "white",
        countertop: true,
        countertopMaterial: "stone",
        backsplash: true,
      },
    ],
  },
  {
    id: "l-kitchen-reference-2",
    name: "L-Kitchen 2 · Sink on Return",
    description: "Second reference layout with sink on the left return and a clean main run.",
    units: [
      {
        x: -370,
        z: 120,
        rot: 90,
        w: 60,
        h: 80,
        d: 60,
        finish: "white",
        countertop: true,
        countertopMaterial: "stone",
        backsplash: true,
        faucet: true,
        appliances: [{ id: "sink-return", type: "sink", y: 4 }],
      },
      {
        x: -370,
        z: 180,
        rot: 90,
        w: 60,
        h: 80,
        d: 60,
        finish: "white",
        countertop: true,
        countertopMaterial: "stone",
        backsplash: true,
      },
      {
        x: -250,
        z: 30,
        w: 60,
        h: 80,
        d: 60,
        finish: "white",
        countertop: true,
        countertopMaterial: "stone",
        backsplash: true,
        appliances: [{ id: "dishwasher-2", type: "dishwasher", y: 4 }],
      },
      {
        x: -190,
        z: 30,
        w: 60,
        h: 80,
        d: 60,
        finish: "white",
        countertop: true,
        countertopMaterial: "stone",
        backsplash: true,
        appliances: [
          { id: "oven-2", type: "oven", y: 4 },
          { id: "hob-2", type: "hob", y: 4 },
        ],
      },
      {
        x: -130,
        z: 30,
        w: 60,
        h: 80,
        d: 60,
        finish: "white",
        front: "drawers",
        drawers: 3,
        countertop: true,
        countertopMaterial: "stone",
        backsplash: true,
      },
      {
        x: 250,
        z: 30,
        w: 60,
        h: 220,
        d: 60,
        finish: "white",
        mount: "tall",
        appliances: [{ id: "fridge-2", type: "fridge", y: 4 }],
      },
      ...[-250, -190, -130, -70, -10].map((x, index) => ({
        x,
        z: 17.5,
        w: 60,
        h: 80,
        d: 35,
        y: 140,
        mount: "wall" as const,
        finish: "white" as const,
        front: index === 1 ? ("glass" as const) : ("door" as const),
      })),
    ],
  },
];

const KEY = "cabinet-presets";
const KITCHEN_KEY = "kitchen-layout-presets";

export function loadKitchenLayouts(): SavedKitchenLayout[] {
  try {
    const raw = localStorage.getItem(KITCHEN_KEY);
    return raw ? (JSON.parse(raw) as SavedKitchenLayout[]) : [];
  } catch {
    return [];
  }
}

export function saveKitchenLayout(config: Config, name: string): SavedKitchenLayout[] {
  const next = [
    ...loadKitchenLayouts(),
    {
      id: `kitchen-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      units: config.units.map(({ id: _id, ...unit }) => unit),
      config: JSON.parse(JSON.stringify(config)) as Config,
    },
  ];
  localStorage.setItem(KITCHEN_KEY, JSON.stringify(next));
  return next;
}

export function removeKitchenLayout(id: string): SavedKitchenLayout[] {
  const next = loadKitchenLayouts().filter((layout) => layout.id !== id);
  localStorage.setItem(KITCHEN_KEY, JSON.stringify(next));
  return next;
}

export function loadPresets(): CabinetPreset[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as CabinetPreset[]) : [];
  } catch {
    return [];
  }
}

function persist(list: CabinetPreset[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function savePreset(unit: Unit, name: string, category: PresetCategory): CabinetPreset[] {
  const { id: _id, x: _x, z: _z, ...rest } = unit;
  const list = [
    ...loadPresets(),
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || "Cabinet",
      category,
      unit: rest,
    },
  ];
  persist(list);
  return list;
}

export function removePreset(id: string): CabinetPreset[] {
  const list = loadPresets().filter((p) => p.id !== id);
  persist(list);
  return list;
}

/** Instantiate a preset as a fresh unit at a given plan position. */
export function unitFromPreset(p: CabinetPreset, x: number, z: number): Unit {
  return newUnit({ ...p.unit, x, z, name: p.name });
}
