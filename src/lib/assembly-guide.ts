import type {
  ConstructionAssembly,
  ConstructionHardware,
  ConstructionPart,
} from "@/lib/construction";

export type AssemblyStepKind =
  | "prepare"
  | "carcass"
  | "back"
  | "base"
  | "interior"
  | "drawers"
  | "fronts"
  | "services"
  | "final";

export type AssemblyStep = {
  id: string;
  number: number;
  kind: AssemblyStepKind;
  title: string;
  description: string;
  partIds: string[];
  hardwareIds: string[];
  checks: string[];
};

export type AssemblyGuide = {
  schema: "mobila-assembly-guide-v1";
  id: string;
  unitId: string;
  cabinet: string;
  dimensions: ConstructionAssembly["dimensions"];
  estimatedMinutes: number;
  steps: AssemblyStep[];
  warnings: string[];
};

const partIds = (parts: ConstructionPart[]) => parts.map((part) => part.id);
const hardwareIds = (items: ConstructionHardware[]) => items.map((item) => item.id);

const includesLabel = (item: ConstructionHardware, value: string) =>
  item.label.toLowerCase().includes(value.toLowerCase());

/**
 * Converts the technical construction graph into a deterministic, IKEA-style
 * assembly sequence. References stay attached to real part/hardware IDs so a
 * future illustrated step view can highlight the exact objects being used.
 */
export function buildAssemblyGuide(assembly: ConstructionAssembly): AssemblyGuide {
  const steps: AssemblyStep[] = [];
  let number = 1;
  const addStep = (
    kind: AssemblyStepKind,
    title: string,
    description: string,
    parts: ConstructionPart[] = [],
    hardware: ConstructionHardware[] = [],
    checks: string[] = [],
    force = false,
  ) => {
    if (!force && parts.length === 0 && hardware.length === 0) return;
    steps.push({
      id: `${assembly.id}-${kind}`,
      number,
      kind,
      title,
      description,
      partIds: partIds(parts),
      hardwareIds: hardwareIds(hardware),
      checks,
    });
    number += 1;
  };

  const parts = assembly.parts;
  const hardware = assembly.hardware;
  const serviceHardware = hardware.filter(
    (item) =>
      ["countertop", "cutout", "appliance"].includes(item.category) ||
      includesLabel(item, "sink") ||
      includesLabel(item, "backsplash"),
  );
  const interiorHardware = hardware.filter(
    (item) => !serviceHardware.some((serviceItem) => serviceItem.id === item.id),
  );

  addStep(
    "prepare",
    "Prepare and identify all parts",
    "Lay out the panels on a protected surface and match each label with the cut list. Keep finished faces and edge-banded sides visible before assembly.",
    parts,
    hardware,
    [
      "Confirm the cabinet dimensions and grain direction.",
      "Separate CNC panels from supplied parts such as glass, stone and appliances.",
      "Check that all connectors, hinges, runners and supports are available.",
    ],
    true,
  );

  const carcassParts = parts.filter((part) =>
    ["side", "top", "bottom"].includes(part.kind ?? ""),
  );
  const carcassHardware = hardware.filter((item) => item.category === "connector");
  addStep(
    "carcass",
    "Build and square the cabinet carcass",
    `Join the sides to the top and bottom with the selected ${assembly.joinery} system. Tighten progressively and keep the front edges flush.`,
    carcassParts,
    carcassHardware,
    [
      "Check that the two diagonals are equal before final tightening.",
      "Keep the finished front edge facing the same direction on every panel.",
    ],
  );

  const backParts = parts.filter((part) => part.kind === "back");
  addStep(
    "back",
    "Install the back panel",
    "Fit the back panel into its rebate or rear position, then use it to lock the cabinet square. Do not cover a marked service opening.",
    backParts,
    [],
    [
      "Confirm the rebate is fully seated on all sides.",
      "Leave plumbing or cable clearances accessible where they are marked.",
    ],
  );

  const baseParts = parts.filter((part) => part.kind === "plinth");
  const baseHardware = hardware.filter((item) => ["leg", "plinth"].includes(item.category));
  addStep(
    "base",
    "Fit legs and plinth",
    "Install the adjustable legs, level the cabinet and clip the front and rear plinth pieces into position.",
    baseParts,
    baseHardware,
    [
      "Level the cabinet before fitting doors, drawers or the worktop.",
      "Keep enough clearance for the plinth return and floor irregularities.",
    ],
  );

  const interiorParts = parts.filter((part) => part.kind === "shelf");
  const interiorHardwareForStep = interiorHardware.filter((item) =>
    ["shelf-support", "rail", "accessory"].includes(item.category),
  );
  addStep(
    "interior",
    "Install shelves and interior accessories",
    "Install shelf supports before placing shelves. Add rails and pull-out accessories at their recorded heights, keeping moving parts clear of the carcass.",
    interiorParts,
    interiorHardwareForStep,
    [
      "Use the same hole row on both sides of each shelf.",
      "Test the full travel of every rail, basket or pull-out accessory.",
    ],
  );

  const drawerParts = parts.filter((part) =>
    ["drawer-box-front", "drawer-box-back", "drawer-box-side", "drawer-box-bottom"].includes(
      part.kind ?? "",
    ),
  );
  const drawerHardware = hardware.filter((item) => item.category === "runner");
  addStep(
    "drawers",
    "Assemble and mount drawer boxes",
    "Build each drawer box, fix the runners at the marked positions and slide the boxes into the cabinet before attaching the visible fronts.",
    drawerParts,
    drawerHardware,
    [
      "Keep left and right runners parallel and at the same height.",
      "Verify the drawer opens fully without touching the door or plumbing.",
    ],
  );

  const frontParts = parts.filter((part) => ["door", "drawer-front"].includes(part.kind ?? ""));
  const frontHardware = hardware.filter((item) => ["hinge", "handle"].includes(item.category));
  addStep(
    "fronts",
    "Install fronts, hinges and handles",
    "Attach hinges or drawer fronts using the prepared references, then adjust reveals and fit the handles after the gaps are even.",
    frontParts,
    frontHardware,
    [
      "Set an even reveal around every door and drawer.",
      "Open every front fully and confirm that adjacent fronts do not collide.",
    ],
  );

  const serviceParts = parts.filter((part) => part.kind === "countertop");
  addStep(
    "services",
    "Install worktop, appliances and services",
    "Level and secure the worktop only after the cabinet is fixed. Use manufacturer templates for sink and hob cutouts, then connect appliances and plumbing.",
    serviceParts,
    serviceHardware,
    [
      "Nominal sink and hob cutouts must be checked against the supplied appliance drawings.",
      "Verify trap, waste, water and cable routes on site before closing the cabinet.",
      "Keep access to service connections for future maintenance.",
    ],
  );

  addStep(
    "final",
    "Final safety and movement check",
    "Recheck level, fixings and clearances, then operate every door, drawer and accessory several times before handover.",
    [],
    hardware.filter((item) => item.category === "wall-fixing"),
    [
      "Confirm the cabinet is anchored where required by the installation site.",
      "Confirm no panel, edge band or fitting is loose.",
      "Record any unresolved technical warning before delivery or installation.",
    ],
    true,
  );

  const estimatedMinutes = Math.max(
    15,
    Math.round(10 + parts.length * 0.7 + hardware.length * 0.45 + steps.length * 3),
  );

  return {
    schema: "mobila-assembly-guide-v1",
    id: `${assembly.id}-guide`,
    unitId: assembly.unitId,
    cabinet: assembly.cabinet,
    dimensions: assembly.dimensions,
    estimatedMinutes,
    steps,
    warnings: assembly.warnings,
  };
}

export function buildAssemblyGuides(assemblies: ConstructionAssembly[]): AssemblyGuide[] {
  return assemblies.map(buildAssemblyGuide);
}

const esc = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const partDescription = (part: ConstructionPart) =>
  `${part.label} - ${part.width.toFixed(0)} x ${part.height.toFixed(0)} x ${part.thickness.toFixed(1)} mm`;

const hardwareDescription = (item: ConstructionHardware) => {
  const specs = Object.entries(item.specs)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
  return `${item.label} x${item.quantity}${specs ? ` - ${specs}` : ""}`;
};

export function createAssemblyGuideHtml(
  guides: AssemblyGuide[],
  assemblies: ConstructionAssembly[],
  projectName = "Project",
): string {
  const assembliesById = new Map(assemblies.map((assembly) => [assembly.unitId, assembly]));
  const guideSections = guides
    .map((guide) => {
      const assembly = assembliesById.get(guide.unitId);
      const partsById = new Map((assembly?.parts ?? []).map((part) => [part.id, part]));
      const hardwareById = new Map((assembly?.hardware ?? []).map((item) => [item.id, item]));
      const steps = guide.steps
        .map((step) => {
          const partList = step.partIds
            .map((id) => partsById.get(id))
            .filter((part): part is ConstructionPart => Boolean(part))
            .map((part) => `<li>${esc(partDescription(part))}</li>`)
            .join("");
          const hardwareList = step.hardwareIds
            .map((id) => hardwareById.get(id))
            .filter((item): item is ConstructionHardware => Boolean(item))
            .map((item) => `<li>${esc(hardwareDescription(item))}</li>`)
            .join("");
          const checks = step.checks.map((check) => `<li>${esc(check)}</li>`).join("");
          return `<article class="step"><div class="step-number">${step.number}</div><div class="step-body"><h2>${esc(step.title)}</h2><p>${esc(step.description)}</p>${partList ? `<h3>Parts</h3><ul>${partList}</ul>` : ""}${hardwareList ? `<h3>Hardware</h3><ul>${hardwareList}</ul>` : ""}<h3>Checks</h3><ul>${checks}</ul></div></article>`;
        })
        .join("");
      const warnings = guide.warnings.length
        ? `<aside class="warning"><h2>Technical warnings</h2>${guide.warnings.map((warning) => `<p>${esc(warning)}</p>`).join("")}</aside>`
        : "";
      return `<section class="guide"><header><p class="eyebrow">Assembly guide</p><h1>${esc(guide.cabinet)}</h1><p>${guide.dimensions.width.toFixed(0)} x ${guide.dimensions.height.toFixed(0)} x ${guide.dimensions.depth.toFixed(0)} mm &middot; estimated ${guide.estimatedMinutes} min</p></header>${steps}${warnings}</section>`;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(projectName)} assembly guide</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font:11px Arial,sans-serif;color:#26332d;line-height:1.45;margin:0}.guide{break-after:page}.guide:last-child{break-after:auto}header{border-bottom:2px solid #78927f;padding-bottom:8mm;margin-bottom:7mm}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:9px;color:#78927f;font-weight:700;margin:0 0 3mm}h1{font-size:25px;margin:0 0 2mm}h2{font-size:15px;margin:0 0 2mm}h3{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#687970;margin:4mm 0 1mm}.step{display:flex;gap:5mm;border:1px solid #d5ddd8;border-radius:4mm;padding:5mm;margin-bottom:4mm;break-inside:avoid}.step-number{display:flex;align-items:center;justify-content:center;flex:0 0 10mm;height:10mm;border-radius:50%;background:#e5efe8;color:#315d43;font-size:15px;font-weight:700}.step-body{flex:1}.step-body p{margin:0 0 2mm}ul{margin:0;padding-left:5mm}li{margin:1mm 0}.warning{border:1px solid #d6a15a;background:#fff8ea;padding:4mm;border-radius:3mm;break-inside:avoid}.warning h2{color:#8a5b1a}.warning p{margin:1mm 0}</style></head><body><p class="eyebrow">${esc(projectName)} &middot; furniture assembly</p>${guideSections}</body></html>`;
}
