export type CatalogCategory =
  "carcass" | "front" | "hardware" | "interior" | "appliance" | "service";

export type CatalogProduct = {
  sku: string;
  name: string;
  category: CatalogCategory;
  subCategory?: string;
  dimensions?: { width?: number; height?: number; depth?: number };
  unitPrice: number;
  material?: string;
  finish?: string;
  image?: string;
  thumbnail?: string;
  model3D?: string;
  compatibleWith?: string[];
  technicalMetadata?: Record<string, string | number | boolean>;
};

/** Local catalog contract. It can be replaced by an API adapter without changing BOM consumers. */
export const CATALOG: CatalogProduct[] = [
  { sku: "WW-CAB-MODULAR", name: "Modular cabinet", category: "carcass", unitPrice: 0 },
  {
    sku: "WW-CAB-BASE-60",
    name: "Base cabinet 60",
    category: "carcass",
    dimensions: { width: 60, height: 80, depth: 60 },
    unitPrice: 165,
    material: "Panel board",
    finish: "Greige",
  },
  {
    sku: "WW-CAB-BASE-SINK-60",
    name: "Sink base cabinet 60",
    category: "carcass",
    dimensions: { width: 60, height: 80, depth: 60 },
    unitPrice: 185,
    material: "Panel board",
    finish: "Greige",
    technicalMetadata: { kitchenRole: "sink" },
  },
  {
    sku: "WW-CAB-BASE-HOB-60",
    name: "Hob + oven base cabinet 60",
    category: "carcass",
    dimensions: { width: 60, height: 80, depth: 60 },
    unitPrice: 210,
    material: "Panel board",
    finish: "Greige",
    technicalMetadata: { kitchenRole: "hob" },
  },
  {
    sku: "WW-CAB-BASE-DISHWASHER-60",
    name: "Dishwasher base cabinet 60",
    category: "carcass",
    dimensions: { width: 60, height: 80, depth: 60 },
    unitPrice: 205,
    material: "Panel board",
    finish: "Greige",
    technicalMetadata: { kitchenRole: "dishwasher" },
  },
  {
    sku: "WW-CAB-WALL-60",
    name: "Wall cabinet 60",
    category: "carcass",
    dimensions: { width: 60, height: 72, depth: 35 },
    unitPrice: 145,
    material: "Panel board",
    finish: "Greige",
  },
  {
    sku: "WW-CAB-WALL-80",
    name: "Wall cabinet 80",
    category: "carcass",
    dimensions: { width: 80, height: 72, depth: 35 },
    unitPrice: 175,
    material: "Panel board",
    finish: "Greige",
  },
  {
    sku: "WW-CAB-TALL-60",
    name: "Tall cabinet 60",
    category: "carcass",
    dimensions: { width: 60, height: 220, depth: 60 },
    unitPrice: 290,
    material: "Panel board",
    finish: "Greige",
  },
  {
    sku: "WW-CAB-TALL-OVEN-60",
    name: "Oven tower cabinet 60",
    category: "carcass",
    dimensions: { width: 60, height: 220, depth: 60 },
    unitPrice: 325,
    material: "Panel board",
    finish: "Greige",
    technicalMetadata: { kitchenRole: "ovenTower" },
  },
  {
    sku: "WW-CAB-STAIRS-60",
    name: "Under-stairs cabinet 60",
    category: "carcass",
    dimensions: { width: 60, height: 168, depth: 60 },
    unitPrice: 220,
    material: "Panel board",
    finish: "Greige",
    technicalMetadata: { sloped: true },
  },
  { sku: "WW-CARCASS-STD", name: "Custom cabinet frame", category: "carcass", unitPrice: 0 },
  { sku: "WW-CARCASS-CELL", name: "Grid carcass cell", category: "carcass", unitPrice: 62 },
  { sku: "WW-FRONT-FLAT", name: "Flat panel front", category: "front", unitPrice: 55 },
  { sku: "WW-FRONT-GLASS", name: "Glass front", category: "front", unitPrice: 89 },
  { sku: "WW-FRONT-FRAMED", name: "Framed front", category: "front", unitPrice: 72 },
  {
    sku: "WW-FRONT-PULLOUT",
    name: "Pull-out front and runners",
    category: "hardware",
    unitPrice: 58,
  },
  { sku: "WW-CUT-SLOPE-TOP", name: "Sloped top cut", category: "service", unitPrice: 68 },
  { sku: "WW-CUT-SLOPE-DOOR", name: "Sloped door mitre cut", category: "service", unitPrice: 26 },
  {
    sku: "WW-CORNER-UNIT",
    name: "Smart corner unit",
    category: "carcass",
    dimensions: { width: 90, height: 80, depth: 60 },
    unitPrice: 180,
    technicalMetadata: { kitchenRole: "corner" },
  },
  { sku: "WW-APPL-FRIDGE", name: "Built-in refrigerator", category: "appliance", unitPrice: 240 },
  { sku: "WW-APPL-WASHER", name: "Washing machine", category: "appliance", unitPrice: 380 },
  { sku: "WW-APPL-OVEN", name: "Built-in oven", category: "appliance", unitPrice: 320 },
  { sku: "WW-APPL-MICROWAVE", name: "Built-in microwave", category: "appliance", unitPrice: 210 },
  {
    sku: "WW-APPL-DISHWASHER",
    name: "Integrated dishwasher",
    category: "appliance",
    unitPrice: 410,
  },
  { sku: "WW-APPL-HOB", name: "Induction hob", category: "appliance", unitPrice: 260 },
  { sku: "WW-APPL-SINK", name: "Built-in sink", category: "appliance", unitPrice: 180 },
  { sku: "WW-APPL-EXTRACTOR", name: "Extractor hood", category: "appliance", unitPrice: 230 },
  { sku: "WW-KITCHEN-COUNTERTOP", name: "Kitchen countertop", category: "carcass", unitPrice: 80 },
  { sku: "WW-KITCHEN-FAUCET", name: "Kitchen faucet", category: "service", unitPrice: 95 },
  { sku: "WW-INTERIOR-SHELF", name: "Shelf", category: "interior", unitPrice: 15 },
  { sku: "WW-INTERIOR-RAIL", name: "Hanging rail", category: "interior", unitPrice: 12 },
  { sku: "WW-INTERIOR-DRAWER", name: "Drawer", category: "interior", unitPrice: 45 },
  { sku: "WW-INTERIOR-BASKET", name: "Wire basket", category: "interior", unitPrice: 22 },
  { sku: "WW-INTERIOR-LIGHT", name: "Top light", category: "interior", unitPrice: 28 },
  { sku: "WW-INTERIOR-CARGO", name: "Pull-out cargo unit", category: "interior", unitPrice: 195 },
];

const bySku = new Map(CATALOG.map((product) => [product.sku, product]));

export function catalogProduct(sku: string): CatalogProduct | undefined {
  return bySku.get(sku);
}

/** Stable SKU mapping for the existing BOM keys. */
export function skuForBomKey(key: string): string {
  if (key.startsWith("frame-")) return "WW-CARCASS-STD";
  if (key.startsWith("grid-carcass-")) return "WW-CARCASS-CELL";
  if (key.startsWith("slope-top-")) return "WW-CUT-SLOPE-TOP";
  if (key.startsWith("slope-door-")) return "WW-CUT-SLOPE-DOOR";
  if (key === "pullout-fronts") return "WW-FRONT-PULLOUT";
  if (key === "corner") return "WW-CORNER-UNIT";
  if (key.startsWith("doors-flat")) return "WW-FRONT-FLAT";
  if (key.startsWith("doors-glass")) return "WW-FRONT-GLASS";
  if (key.startsWith("doors-framed")) return "WW-FRONT-FRAMED";
  if (key === "shelf") return "WW-INTERIOR-SHELF";
  if (key === "rail") return "WW-INTERIOR-RAIL";
  if (key === "drawer") return "WW-INTERIOR-DRAWER";
  if (key === "basket") return "WW-INTERIOR-BASKET";
  if (key === "light") return "WW-INTERIOR-LIGHT";
  if (key === "cargo") return "WW-INTERIOR-CARGO";
  if (key === "fridge") return "WW-APPL-FRIDGE";
  if (key === "washer") return "WW-APPL-WASHER";
  if (key === "oven") return "WW-APPL-OVEN";
  if (key === "microwave") return "WW-APPL-MICROWAVE";
  if (key === "dishwasher") return "WW-APPL-DISHWASHER";
  if (key === "hob") return "WW-APPL-HOB";
  if (key === "sink") return "WW-APPL-SINK";
  if (key === "extractor") return "WW-APPL-EXTRACTOR";
  return "WW-CARCASS-STD";
}
