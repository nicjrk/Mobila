import type { ConstructionHardware, HardwareValue } from "@/lib/construction";

export type HardwareListLine = {
  key: string;
  category: ConstructionHardware["category"];
  label: string;
  quantity: number;
  cabinets: string[];
  specs: Record<string, HardwareValue>;
  notes: string[];
};

export const HARDWARE_CATEGORY_LABELS: Record<ConstructionHardware["category"], string> = {
  connector: "Connectors",
  "shelf-support": "Shelf supports",
  hinge: "Hinges",
  runner: "Runners",
  rail: "Rails",
  handle: "Handles",
  leg: "Adjustable legs",
  plinth: "Plinth hardware",
  "wall-fixing": "Wall fixing / anti-tip",
  appliance: "Appliances",
  countertop: "Countertop",
  cutout: "Cutouts",
  accessory: "Accessories",
};

const normalizedSpecs = (specs: Record<string, HardwareValue>) =>
  Object.fromEntries(Object.entries(specs).sort(([first], [second]) => first.localeCompare(second)));

const specsKey = (specs: Record<string, HardwareValue>) => JSON.stringify(normalizedSpecs(specs));

/** Aggregates identical hardware records across all cabinets without merging different specs. */
export function aggregateHardware(items: ConstructionHardware[]): HardwareListLine[] {
  const groups = new Map<string, HardwareListLine>();
  items.forEach((item) => {
    const specs = normalizedSpecs(item.specs);
    const key = `${item.category}|${item.label}|${specsKey(item.specs)}`;
    const current = groups.get(key);
    if (current) {
      current.quantity += item.quantity;
      if (!current.cabinets.includes(item.cabinet)) current.cabinets.push(item.cabinet);
      if (item.note && !current.notes.includes(item.note)) current.notes.push(item.note);
      return;
    }
    groups.set(key, {
      key,
      category: item.category,
      label: item.label,
      quantity: item.quantity,
      cabinets: [item.cabinet],
      specs,
      notes: item.note ? [item.note] : [],
    });
  });
  return [...groups.values()].sort(
    (first, second) =>
      HARDWARE_CATEGORY_LABELS[first.category].localeCompare(HARDWARE_CATEGORY_LABELS[second.category]) ||
      first.label.localeCompare(second.label),
  );
}

const csvCell = (value: string | number | boolean | null | undefined) => {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
};

const specsText = (specs: Record<string, HardwareValue>) =>
  Object.entries(specs)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");

export function createHardwareListCsv(
  items: HardwareListLine[],
  projectName = "Project",
): string {
  const headers = [
    "project",
    "category",
    "item",
    "quantity",
    "cabinets",
    "specifications",
    "notes",
  ];
  const rows = items.map((item) =>
    [
      projectName,
      HARDWARE_CATEGORY_LABELS[item.category],
      item.label,
      item.quantity,
      item.cabinets.join("; "),
      specsText(item.specs),
      item.notes.join("; "),
    ]
      .map(csvCell)
      .join(","),
  );
  return `\ufeff${headers.map(csvCell).join(",")}\n${rows.join("\n")}\n`;
}
