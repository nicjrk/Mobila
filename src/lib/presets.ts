import { newUnit, type Config, type ModularRoom, type Unit } from "./wardrobe";

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
  /** Room envelope read from the sketch, applied when the layout replaces the design. */
  room?: Partial<ModularRoom>;
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
const BUILT_IN_KITCHEN_LAYOUT_PRESETS: KitchenLayoutPreset[] = [
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
  {
    id: "kitchen-5-sketch",
    name: "Kitchen 5 · Schiță 350 × 294",
    description:
      "Reproducere editabilă după schiță: L = 350 cm, l = 294 cm, h = 294 cm; module principale 610/750/800 mm și retur 800/600/600 mm.",
    room: {
      width: 350,
      depth: 294,
      height: 294,
      wallThickness: 12,
      entryWidth: 90,
    },
    units: [
      // Main elevation from the sketch: 610 mm tall fridge column + 750 mm drawers + 800 mm hob.
      {
        name: "Coloană frigider · 610 mm",
        x: -84.5,
        z: 30,
        w: 61,
        h: 294,
        d: 60,
        finish: "white",
        mount: "tall",
        front: "door",
        frontSections: 3,
        shelves: 2,
        appliances: [{ id: "k5-fridge", type: "fridge", y: 4 }],
      },
      {
        name: "Sertare · 750 mm",
        x: -16.5,
        z: 30,
        w: 75,
        h: 80,
        d: 60,
        finish: "white",
        front: "drawers",
        drawers: 3,
        drawerHeight: 22,
        countertop: true,
        countertopMaterial: "stone",
        backsplash: true,
      },
      {
        name: "Cuptor + plită · 800 mm",
        x: 61,
        z: 30,
        w: 80,
        h: 80,
        d: 60,
        finish: "white",
        countertop: true,
        countertopMaterial: "stone",
        backsplash: true,
        appliances: [
          { id: "k5-oven", type: "oven", y: 4 },
          { id: "k5-hob", type: "hob", y: 4 },
        ],
      },
      // Return elevation from the sketch: 800 mm sink + 600 mm washing machine + 600 mm oven.
      {
        name: "Chiuvetă retur · 800 mm",
        x: -145,
        z: 100,
        rot: 90,
        w: 80,
        h: 80,
        d: 60,
        finish: "white",
        countertop: true,
        countertopMaterial: "stone",
        backsplash: true,
        faucet: true,
        appliances: [{ id: "k5-sink", type: "sink", y: 4 }],
      },
      {
        name: "Mașină de spălat · 600 mm",
        x: -145,
        z: 170,
        rot: 90,
        w: 60,
        h: 80,
        d: 60,
        finish: "white",
        countertop: true,
        countertopMaterial: "stone",
        backsplash: true,
        appliances: [{ id: "k5-washer", type: "washer", y: 4 }],
      },
      // Return appliance module below the hood.
      {
        name: "Cuptor retur · 600 mm",
        x: -145,
        z: 230,
        rot: 90,
        w: 60,
        h: 80,
        d: 60,
        finish: "white",
        countertop: true,
        countertopMaterial: "stone",
        backsplash: true,
        appliances: [
          { id: "k5-return-oven", type: "oven", y: 4 },
          { id: "k5-return-hob", type: "hob", y: 4 },
        ],
      },
      // Open display shelves echo the two open rows drawn above the main run.
      {
        name: "Etajeră · 750 mm",
        x: -16.5,
        z: 17.5,
        w: 75,
        h: 70,
        d: 35,
        y: 145,
        finish: "white",
        mount: "wall",
        front: "none",
        shelves: 2,
        light: true,
      },
      {
        name: "Etajeră · 800 mm",
        x: 61,
        z: 17.5,
        w: 80,
        h: 70,
        d: 35,
        y: 145,
        finish: "white",
        mount: "wall",
        front: "none",
        shelves: 2,
        light: true,
      },
      {
        name: "Etajeră superioară · 800 mm",
        x: 61,
        z: 17.5,
        w: 80,
        h: 70,
        d: 35,
        y: 220,
        finish: "white",
        mount: "wall",
        front: "none",
        shelves: 2,
        light: true,
      },
      // Storage and hood above the return, as in the right-hand sketch.
      {
        name: "Corp suspendat retur · 900 mm",
        x: -157.5,
        z: 110,
        rot: 90,
        w: 90,
        h: 75,
        d: 35,
        y: 165,
        finish: "white",
        mount: "wall",
        front: "door",
      },
      {
        name: "Hotă · 400 mm",
        x: -157.5,
        z: 230,
        rot: 90,
        w: 40,
        h: 75,
        d: 35,
        y: 165,
        finish: "white",
        mount: "wall",
        front: "none",
        appliances: [{ id: "k5-extractor", type: "extractor", y: 4 }],
      },
    ],
  },
];

/**
 * Legacy Kitchen 5 reference kept for source compatibility. The active preset
 * is replaced by KITCHEN_5_IMAGE_REFERENCE below before the presets are exported.
 */
const KITCHEN_5_REFERENCE_LEGACY: KitchenLayoutPreset = {
  id: "kitchen-5-sketch",
  name: "Kitchen 5 · Schiță exactă",
  description:
    "Ansamblu separat după schiță: 610/750/800 mm în stânga, CORP L central, 900/800/600/600 mm în dreapta, plus corpurile cu 3 sertare și 3 uși.",
  room: {
    width: 350,
    depth: 294,
    height: 340,
    wallThickness: 12,
    entryWidth: 90,
  },
  units: [
    {
      name: "Corp vertical lateral · 610 mm",
      x: -143.5,
      z: 30,
      w: 61,
      h: 340,
      d: 60,
      finish: "white",
      mount: "tall",
      front: "door",
      frontSections: 3,
      frontSectionRatios: [100, 140, 100],
      shelves: 0,
      drawers: 0,
      rail: false,
      snap: false,
    },
    {
      name: "Corp inferior intermediar · 750 mm",
      x: -72,
      z: 30,
      w: 75,
      h: 80,
      d: 60,
      finish: "white",
      mount: "base",
      front: "drawers",
      drawers: 3,
      shelves: 0,
      rail: false,
      countertop: true,
      countertopMaterial: "stone",
      snap: false,
    },
    {
      name: "Corp inferior · plită + cuptor · 800 mm",
      x: 6.5,
      z: 30,
      w: 80,
      h: 80,
      d: 60,
      finish: "white",
      mount: "base",
      front: "none",
      shelves: 0,
      drawers: 0,
      rail: false,
      countertop: true,
      countertopMaterial: "stone",
      appliances: [
        { id: "k5-left-oven", type: "oven", y: 4 },
        { id: "k5-left-hob", type: "hob", y: 4 },
      ],
      snap: false,
    },
    {
      name: "Corp suspendat stânga · polițe · 750 mm",
      x: -72,
      z: 17.5,
      w: 75,
      h: 100,
      d: 35,
      y: 220,
      finish: "white",
      mount: "wall",
      front: "none",
      shelves: 2,
      drawers: 0,
      rail: false,
      snap: false,
    },
    {
      name: "Corp suspendat stânga · ușă · 750 mm",
      x: -72,
      z: 17.5,
      w: 75,
      h: 70,
      d: 35,
      y: 145,
      finish: "white",
      mount: "wall",
      front: "door",
      shelves: 0,
      drawers: 0,
      rail: false,
      snap: false,
    },
    {
      name: "Corp suspendat stânga · polițe · 800 mm",
      x: 6.5,
      z: 17.5,
      w: 80,
      h: 100,
      d: 35,
      y: 220,
      finish: "white",
      mount: "wall",
      front: "none",
      shelves: 2,
      drawers: 0,
      rail: false,
      snap: false,
    },
    {
      name: "Corp suspendat stânga · uși · 800 mm",
      x: 6.5,
      z: 17.5,
      w: 80,
      h: 70,
      d: 35,
      y: 145,
      finish: "white",
      mount: "wall",
      front: "double",
      shelves: 0,
      drawers: 0,
      rail: false,
      snap: false,
    },
    {
      name: "CORP L · corp vertical separat",
      x: 72,
      z: 170,
      w: 40,
      h: 340,
      d: 60,
      finish: "white",
      mount: "tall",
      front: "door",
      shelves: 0,
      drawers: 0,
      rail: false,
      snap: false,
    },
    {
      name: "Corp suspendat superior · polițe · 900 mm",
      x: 140,
      z: 50,
      rot: 90,
      w: 90,
      h: 100,
      d: 35,
      y: 220,
      finish: "white",
      mount: "wall",
      front: "none",
      shelves: 2,
      drawers: 0,
      rail: false,
      snap: false,
    },
    {
      name: "Corp suspendat superior · uși · 900 mm",
      x: 140,
      z: 50,
      rot: 90,
      w: 90,
      h: 70,
      d: 35,
      y: 145,
      finish: "white",
      mount: "wall",
      front: "double",
      shelves: 0,
      drawers: 0,
      rail: false,
      snap: false,
    },
    {
      name: "Corp inferior cu chiuvetă · 800 mm",
      x: 140,
      z: 50,
      rot: 90,
      w: 80,
      h: 80,
      d: 60,
      finish: "white",
      mount: "base",
      front: "double",
      shelves: 0,
      drawers: 0,
      rail: false,
      countertop: true,
      countertopMaterial: "stone",
      faucet: true,
      appliances: [{ id: "k5-right-sink", type: "sink", y: 4 }],
      snap: false,
    },
    {
      name: "Corp inferior · mașină de spălat · 600 mm",
      x: 140,
      z: 120,
      rot: 90,
      w: 60,
      h: 80,
      d: 60,
      finish: "white",
      mount: "base",
      front: "none",
      shelves: 0,
      drawers: 0,
      rail: false,
      countertop: true,
      countertopMaterial: "stone",
      appliances: [{ id: "k5-right-washer", type: "washer", y: 4 }],
      snap: false,
    },
    {
      name: "Corp înalt · două cuptoare + plită · 600 mm",
      x: 140,
      z: 180,
      rot: 90,
      w: 60,
      h: 220,
      d: 60,
      finish: "white",
      mount: "tall",
      front: "none",
      shelves: 0,
      drawers: 0,
      rail: false,
      countertop: true,
      countertopMaterial: "stone",
      appliances: [
        { id: "k5-right-oven-lower", type: "oven", y: 4 },
        { id: "k5-right-oven-upper", type: "oven", y: 68 },
        { id: "k5-right-hob", type: "hob", y: 4 },
      ],
      snap: false,
    },
    {
      name: "Corp suspendat · 3 sertare · cotă estimată",
      x: 140,
      z: 160,
      rot: 90,
      w: 60,
      h: 55,
      d: 35,
      y: 250,
      finish: "white",
      mount: "wall",
      front: "drawers",
      drawers: 3,
      shelves: 0,
      rail: false,
      snap: false,
    },
    {
      name: "Corp separat · 3 uși · 1250 × 600 × 600 mm",
      x: 100,
      z: 255,
      w: 125,
      h: 60,
      d: 60,
      y: 250,
      finish: "white",
      mount: "wall",
      front: "door",
      frontLeaves: 3,
      shelves: 0,
      drawers: 0,
      rail: false,
      snap: false,
    },
  ],
};

// Kitchen 5 placement is derived from each preceding module, not from the
// apparent pixel positions in the isometric reference.
const K5_A1_WIDTH = 61;
const K5_A2_WIDTH = 75;
const K5_A3_WIDTH = 80;
const K5_CORNER_WIDTH = 60;
const K5_B1_WIDTH = 80;
const K5_B2_WIDTH = 60;
const K5_WALL_A_X = -370;
const K5_WALL_A_START = 324;
const K5_A1_Z = K5_WALL_A_START + K5_A1_WIDTH / 2;
const K5_A2_Z = K5_A1_Z + (K5_A1_WIDTH + K5_A2_WIDTH) / 2;
const K5_A3_Z = K5_A2_Z + (K5_A2_WIDTH + K5_A3_WIDTH) / 2;
const K5_CORNER_Z = K5_A3_Z + (K5_A3_WIDTH + K5_CORNER_WIDTH) / 2;
const K5_WALL_B_Z = K5_CORNER_Z;
const K5_B1_X = K5_WALL_A_X + (K5_CORNER_WIDTH + K5_B1_WIDTH) / 2;
const K5_B2_X = K5_B1_X + (K5_B1_WIDTH + K5_B2_WIDTH) / 2;

/** Kitchen 5: the requested A1-A3 + corner + B1-B2 L-shaped assembly. */
const KITCHEN_5_IMAGE_REFERENCE: KitchenLayoutPreset = {
  id: "kitchen-5-sketch",
  name: "Kitchen 5 · L-shape A1–A3 + B1–B2",
  description:
    "Ansamblu L conectat la 90°: A1 corp înalt 610 mm, A2 sertare 750 mm, A3 cuptor + plită 800 mm, corp de colț real și B1 chiuvetă 800 mm + B2 mașină de spălat 600 mm.",
  room: {
    width: 800,
    depth: 600,
    height: 300,
    wallThickness: 12,
    entryWidth: 110,
  },
  units: [
    {
      name: "Corp vertical lateral · 610 mm",
      x: K5_WALL_A_X,
      z: K5_A1_Z,
      rot: 90,
      w: 61,
      h: 220,
      d: 60,
      finish: "white",
      mount: "tall",
      front: "door",
      frontSections: 2,
      shelves: 0,
      drawers: 0,
      rail: false,
      snap: false,
    },
    {
      name: "Corp inferior cu 3 sertare · 750 mm",
      x: K5_WALL_A_X,
      z: K5_A2_Z,
      rot: 90,
      w: 75,
      h: 80,
      d: 60,
      finish: "white",
      mount: "base",
      front: "drawers",
      drawers: 3,
      shelves: 0,
      rail: false,
      countertop: true,
      countertopMaterial: "stone",
      snap: false,
    },
    {
      name: "Corp inferior cu plită și cuptor · 800 mm",
      x: K5_WALL_A_X,
      z: K5_A3_Z,
      rot: 90,
      w: 80,
      h: 80,
      d: 60,
      finish: "white",
      mount: "base",
      front: "none",
      shelves: 0,
      drawers: 0,
      rail: false,
      countertop: true,
      countertopMaterial: "stone",
      appliances: [
        { id: "k5-left-oven", type: "oven", y: 4 },
        { id: "k5-left-hob", type: "hob", y: 4 },
      ],
      snap: false,
    },
    {
      name: "Corp de colț funcțional · 600 × 600 mm",
      x: K5_WALL_A_X,
      z: K5_CORNER_Z,
      w: 60,
      h: 80,
      d: 60,
      finish: "white",
      mount: "base",
      front: "double",
      shelves: 0,
      drawers: 0,
      rail: false,
      corner: true,
      countertop: true,
      countertopMaterial: "stone",
      snap: false,
    },
    {
      name: "Corp suspendat deschis · polițe · 750 mm",
      x: -382.5,
      z: K5_A2_Z,
      rot: 90,
      w: 75,
      h: 70,
      d: 35,
      y: 150,
      finish: "white",
      mount: "wall",
      front: "none",
      shelves: 2,
      drawers: 0,
      rail: false,
      snap: false,
    },
    {
      name: "Corp suspendat inferior cu uși · 750 mm",
      x: -382.5,
      z: K5_A2_Z,
      rot: 90,
      w: 75,
      h: 70,
      d: 35,
      y: 80,
      finish: "white",
      mount: "wall",
      front: "double",
      shelves: 0,
      drawers: 0,
      rail: false,
      snap: false,
    },
    {
      name: "Corp suspendat deschis · polițe · 800 mm",
      x: -382.5,
      z: K5_A3_Z,
      rot: 90,
      w: 80,
      h: 70,
      d: 35,
      y: 150,
      finish: "white",
      mount: "wall",
      front: "none",
      shelves: 2,
      drawers: 0,
      rail: false,
      snap: false,
    },
    {
      name: "Corp suspendat inferior cu uși · 800 mm",
      x: -382.5,
      z: K5_A3_Z,
      rot: 90,
      w: 80,
      h: 70,
      d: 35,
      y: 80,
      finish: "white",
      mount: "wall",
      front: "double",
      shelves: 0,
      drawers: 0,
      rail: false,
      snap: false,
    },
    {
      name: "Corp inferior cu chiuvetă · 800 mm",
      x: K5_B1_X,
      z: K5_WALL_B_Z,
      rot: 180,
      w: 80,
      h: 80,
      d: 60,
      finish: "white",
      mount: "base",
      front: "double",
      shelves: 0,
      drawers: 0,
      rail: false,
      countertop: true,
      countertopMaterial: "stone",
      faucet: true,
      appliances: [{ id: "k5-right-sink", type: "sink", y: 4 }],
      snap: false,
    },
    {
      name: "Corp inferior cu mașină de spălat · 600 mm",
      x: K5_B2_X,
      z: K5_WALL_B_Z,
      rot: 180,
      w: 60,
      h: 80,
      d: 60,
      finish: "white",
      mount: "base",
      front: "none",
      shelves: 0,
      drawers: 0,
      rail: false,
      countertop: true,
      countertopMaterial: "stone",
      appliances: [{ id: "k5-right-washer", type: "washer", y: 4 }],
      snap: false,
    },
  ],
};

/** Kitchen 5 was retired and must not be offered as an available layout. */
export const KITCHEN_LAYOUT_PRESETS = BUILT_IN_KITCHEN_LAYOUT_PRESETS
  .filter((layout) => layout.id !== "kitchen-5-sketch");

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
