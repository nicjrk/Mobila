import {
  DEFAULT_CNC_SETTINGS,
  frontSectionFractions,
  leafCount,
  sectionSpec,
  type CncSettings,
  type Unit,
} from "@/lib/wardrobe";
import { drawerStackHeight, FITTING_META, fittingsOf } from "@/lib/fittings";

/** The manufacturing role of a physical panel in a cabinet assembly. */
export type ConstructionPartKind =
  | "side"
  | "top"
  | "bottom"
  | "back"
  | "plinth"
  | "shelf"
  | "drawer-front"
  | "drawer-box-front"
  | "drawer-box-back"
  | "drawer-box-side"
  | "drawer-box-bottom"
  | "door"
  | "countertop"
  | "custom";

export type EdgeBandSide = "front" | "back" | "left" | "right" | "top" | "bottom";

export type EdgeBandSpec = {
  sides: EdgeBandSide[];
  thickness: number;
  material?: string;
};

export type ConstructionPoint = { x: number; y: number };
export type ConstructionFace = "front" | "back" | "inner" | "outer" | "top" | "bottom";

export type DrillOperation = {
  id: string;
  kind: "drill";
  face: ConstructionFace;
  x: number;
  y: number;
  diameter: number;
  depth: number;
  purpose: string;
};

export type RouteOperation = {
  id: string;
  kind: "route";
  face: ConstructionFace;
  path: ConstructionPoint[];
  toolDiameter: number;
  depth: number;
  purpose: string;
};

export type CutoutOperation = {
  id: string;
  kind: "cutout";
  face: ConstructionFace;
  x: number;
  y: number;
  width: number;
  height: number;
  depth?: number;
  purpose: string;
  verified: boolean;
};

export type ConstructionOperation = DrillOperation | RouteOperation | CutoutOperation;

export type ConstructionPart = {
  id: string;
  label: string;
  cabinet: string;
  unitId?: string;
  kind?: ConstructionPartKind;
  width: number;
  height: number;
  thickness: number;
  grain: "vertical" | "horizontal" | "none";
  material?: string;
  edgeBand?: EdgeBandSpec;
  operations?: ConstructionOperation[];
  note?: string;
  cnc: boolean;
  glass?: boolean;
};

export type HardwareValue = string | number | boolean;

/** A non-panel item that must be bought, installed or verified during assembly. */
export type ConstructionHardware = {
  id: string;
  cabinet: string;
  unitId: string;
  category:
    | "connector"
    | "shelf-support"
    | "hinge"
    | "runner"
    | "rail"
    | "handle"
    | "leg"
    | "plinth"
    | "wall-fixing"
    | "appliance"
    | "countertop"
    | "cutout"
    | "accessory";
  label: string;
  quantity: number;
  specs: Record<string, HardwareValue>;
  note?: string;
};

export type ConstructionAssembly = {
  id: string;
  unitId: string;
  cabinet: string;
  dimensions: { width: number; height: number; depth: number; elevation: number };
  joinery: NonNullable<CncSettings["joinery"]>;
  parts: ConstructionPart[];
  hardware: ConstructionHardware[];
  warnings: string[];
};

const roundMm = (cm: number) => Math.round(cm * 100) / 10;
const settingsValue = (value: number | undefined, fallback: number) => value ?? fallback;
const edge = (settings: CncSettings, ...sides: EdgeBandSide[]): EdgeBandSpec => ({
  sides,
  thickness: settingsValue(settings.edgeBandThickness, DEFAULT_CNC_SETTINGS.edgeBandThickness!),
  material: "ABS",
});

const drill = (
  id: string,
  face: ConstructionFace,
  x: number,
  y: number,
  diameter: number,
  depth: number,
  purpose: string,
): DrillOperation => ({ id, kind: "drill", face, x, y, diameter, depth, purpose });

const hardware = (
  unitId: string,
  cabinet: string,
  id: string,
  category: ConstructionHardware["category"],
  label: string,
  quantity: number,
  specs: Record<string, HardwareValue>,
  note?: string,
): ConstructionHardware => ({
  id,
  cabinet,
  unitId,
  category,
  label,
  quantity,
  specs,
  ...(note ? { note } : {}),
});

const panel = (
  unit: Unit,
  cabinet: string,
  settings: CncSettings,
  input: Omit<ConstructionPart, "cabinet" | "unitId" | "material"> & {
    material?: string;
  },
): ConstructionPart => ({
  ...input,
  cabinet,
  unitId: unit.id,
  material: input.material ?? unit.finish,
});

const positions = (length: number, offset: number, pitch: number) => {
  if (length <= offset * 2) return [length / 2];
  const result: number[] = [];
  for (let value = offset; value <= length - offset + 0.01; value += pitch) {
    result.push(Math.round(value * 10) / 10);
  }
  return result;
};

const carcassConnectorOperations = (
  id: string,
  width: number,
  height: number,
  settings: CncSettings,
): DrillOperation[] => {
  const diameter = settingsValue(settings.connectorDiameter, DEFAULT_CNC_SETTINGS.connectorDiameter!);
  const depth = settingsValue(settings.connectorDepth, DEFAULT_CNC_SETTINGS.connectorDepth!);
  const offset = settingsValue(settings.holeOffset, DEFAULT_CNC_SETTINGS.holeOffset!);
  const xs = positions(width, offset, width);
  const ys = positions(height, offset, height);
  return xs.flatMap((x, xIndex) =>
    ys.map((y, yIndex) =>
      drill(
        `${id}-connector-${xIndex}-${yIndex}`,
        "top",
        x,
        y,
        diameter,
        depth,
        "Carcass connector pilot",
      ),
    ),
  );
};

const sideOperations = (
  id: string,
  width: number,
  height: number,
  settings: CncSettings,
): DrillOperation[] => {
  const diameter = settingsValue(settings.holeDiameter, DEFAULT_CNC_SETTINGS.holeDiameter!);
  const depth = settingsValue(settings.holeDepth, DEFAULT_CNC_SETTINGS.holeDepth!);
  const pitch = settingsValue(settings.holePitch, DEFAULT_CNC_SETTINGS.holePitch!);
  const offset = settingsValue(settings.holeOffset, DEFAULT_CNC_SETTINGS.holeOffset!);
  const xs = positions(width, offset, width);
  const ys = positions(height, offset, pitch);
  const shelfHoles = xs.flatMap((x, row) =>
    ys.map((y, index) =>
      drill(`${id}-32mm-${row}-${index}`, "inner", x, y, diameter, depth, "32 mm system hole"),
    ),
  );
  const connectorDiameter = settingsValue(
    settings.connectorDiameter,
    DEFAULT_CNC_SETTINGS.connectorDiameter!,
  );
  const connectorDepth = settingsValue(settings.connectorDepth, DEFAULT_CNC_SETTINGS.connectorDepth!);
  const connectorYs = positions(height, offset, height);
  const connectorXs = positions(width, offset, width);
  const connectors = connectorXs.flatMap((x, xIndex) =>
    connectorYs.map((y, yIndex) =>
      drill(
        `${id}-confirmat-${xIndex}-${yIndex}`,
        "outer",
        x,
        y,
        connectorDiameter,
        connectorDepth,
        "Carcass connector pilot",
      ),
    ),
  );
  return [...shelfHoles, ...connectors];
};

const hingeCount = (height: number) => Math.max(2, Math.min(5, Math.ceil(height / 800)));

const handleOperations = (
  id: string,
  width: number,
  height: number,
  spec: ReturnType<typeof sectionSpec>,
  settings: CncSettings,
): ConstructionOperation[] => {
  const result: ConstructionOperation[] = [];
  const handleX = spec.handlePos === "left" ? 80 : spec.handlePos === "right" ? width - 80 : width / 2;
  const handleY = Math.min(height - 40, Math.max(40, roundMm(spec.handleY)));
  const diameter = settingsValue(settings.holeDiameter, DEFAULT_CNC_SETTINGS.holeDiameter!);
  if (spec.handleStyle === "bar") {
    const spacing = Math.min(160, Math.max(80, height / 4));
    result.push(
      drill(`${id}-handle-lower`, "front", handleX, Math.max(25, handleY - spacing / 2), diameter, 12, "Bar handle fixing"),
      drill(`${id}-handle-upper`, "front", handleX, Math.min(height - 25, handleY + spacing / 2), diameter, 12, "Bar handle fixing"),
    );
  } else if (spec.handleStyle === "knob") {
    result.push(drill(`${id}-handle-knob`, "front", handleX, handleY, diameter, 12, "Knob handle fixing"));
  } else if (spec.handleStyle === "profile") {
    result.push({
      id: `${id}-profile-handle`,
      kind: "route",
      face: "front",
      path: [
        { x: handleX, y: 20 },
        { x: handleX, y: Math.max(20, height - 20) },
      ],
      toolDiameter: 6,
      depth: 3,
      purpose: "Integrated profile handle route",
    });
  }
  return result;
};

const doorOperations = (
  id: string,
  width: number,
  height: number,
  spec: ReturnType<typeof sectionSpec>,
  settings: CncSettings,
): ConstructionOperation[] => {
  const result: ConstructionOperation[] = [];
  if (spec.mode === "hinged") {
    const hingeOffset = settingsValue(settings.hingeOffset, DEFAULT_CNC_SETTINGS.hingeOffset!);
    const hingeX = spec.hinge === "left" ? hingeOffset : width - hingeOffset;
    const cupDiameter = settingsValue(
      settings.hingeCupDiameter,
      DEFAULT_CNC_SETTINGS.hingeCupDiameter!,
    );
    const cupDepth = settingsValue(settings.hingeCupDepth, DEFAULT_CNC_SETTINGS.hingeCupDepth!);
    const count = hingeCount(height);
    const ys = Array.from({ length: count }, (_, index) =>
      count === 1 ? height / 2 : 100 + ((height - 200) * index) / (count - 1),
    );
    result.push(
      ...ys.map((y, index) =>
        drill(`${id}-hinge-cup-${index}`, "back", hingeX, y, cupDiameter, cupDepth, "35 mm hinge cup"),
      ),
    );
  }
  return [...result, ...handleOperations(id, width, height, spec, settings)];
};

const countertopCutout = (
  id: string,
  width: number,
  depth: number,
  appliance: NonNullable<Unit["appliances"]>[number],
  type: "sink" | "hob",
): CutoutOperation => {
  const nominalWidth = type === "sink" ? 500 : 560;
  const nominalHeight = type === "sink" ? 400 : 490;
  const cutoutWidth = Math.min(Math.max(40, width - 60), nominalWidth);
  const cutoutHeight = Math.min(Math.max(40, depth - 60), nominalHeight);
  const centerX = width / 2 + roundMm(appliance.x ?? 0);
  const requestedX = centerX - cutoutWidth / 2;
  const requestedY = depth / 2 - cutoutHeight / 2;
  const maxX = Math.max(30, width - cutoutWidth - 30);
  const maxY = Math.max(30, depth - cutoutHeight - 30);
  return {
    id,
    kind: "cutout",
    face: "top",
    x: Math.min(maxX, Math.max(30, requestedX)),
    y: Math.min(maxY, Math.max(30, requestedY)),
    width: cutoutWidth,
    height: cutoutHeight,
    purpose: `${type} countertop cutout`,
    verified: false,
  };
};

/** Centered rear service opening for the sink waste and water connections. */
const plumbingClearanceCutout = (id: string, width: number, height: number): CutoutOperation => {
  const clearanceWidth = Math.min(260, Math.max(160, width - 120));
  const clearanceHeight = Math.min(180, Math.max(120, height - 140));
  const margin = 40;
  const maxX = Math.max(margin, width - clearanceWidth - margin);
  const maxY = Math.max(margin, height - clearanceHeight - margin);
  return {
    id,
    kind: "cutout",
    face: "back",
    x: Math.min(maxX, Math.max(margin, (width - clearanceWidth) / 2)),
    y: Math.min(maxY, Math.max(margin, 80)),
    width: clearanceWidth,
    height: clearanceHeight,
    purpose: "Sink plumbing service clearance",
    verified: false,
  };
};

function fittingParts(
  unit: Unit,
  cabinet: string,
  settings: CncSettings,
  hardwareItems: ConstructionHardware[],
): ConstructionPart[] {
  const panelThickness = settings.panelThickness;
  const innerW = roundMm(unit.w) - 2 * panelThickness;
  const depth = roundMm(unit.d);
  const result: ConstructionPart[] = [];
  fittingsOf(unit).forEach((fitting, index) => {
    const meta = FITTING_META[fitting.type];
    if (fitting.type === "shelf") {
      result.push(
        panel(unit, cabinet, settings, {
          id: `${unit.id}-shelf-${index}`,
          label: `Shelf - at ${roundMm(fitting.y)} mm`,
          kind: "shelf",
          width: innerW - 1,
          height: depth - 20,
          thickness: panelThickness,
          grain: "horizontal",
          edgeBand: edge(settings, "front"),
          operations: [],
          cnc: true,
        }),
      );
      hardwareItems.push(
        hardware(unit.id, cabinet, `${unit.id}-shelf-support-${index}`, "shelf-support", "Shelf support pin", 4, {
          diameter: 5,
          system: "32 mm",
        }),
      );
      return;
    }
    if (fitting.type === "rail") {
      hardwareItems.push(
        hardware(unit.id, cabinet, `${unit.id}-rail-${index}`, "rail", "Clothes rail", 1, {
          length: Math.max(0, innerW),
          positionY: roundMm(fitting.y),
        }),
      );
      return;
    }
    if (!(["drawer", "basket", "shoerack"].includes(fitting.type))) {
      if (fitting.type === "cargo") {
        hardwareItems.push(
          hardware(unit.id, cabinet, `${unit.id}-cargo-${index}`, "accessory", meta.name, 1, {
            height: meta.height * 10,
            positionY: roundMm(fitting.y),
          }),
        );
      }
      return;
    }
    const boxW = innerW - 26;
    const boxH = meta.height * 10 - 40;
    const boxD = depth - 60;
    const runnerOps = (id: string): DrillOperation[] => {
      const diameter = settingsValue(settings.holeDiameter, DEFAULT_CNC_SETTINGS.holeDiameter!);
      return [
        drill(`${id}-runner-front`, "outer", 37, boxH / 2, diameter, 12, "Drawer runner fixing"),
        drill(`${id}-runner-back`, "outer", Math.max(37, boxD - 37), boxH / 2, diameter, 12, "Drawer runner fixing"),
      ];
    };
    result.push(
      panel(unit, cabinet, settings, {
        id: `${unit.id}-${fitting.type}-${index}-front`,
        label: `${meta.name} box front - at ${roundMm(fitting.y)} mm`,
        kind: "drawer-box-front",
        width: boxW,
        height: boxH,
        thickness: panelThickness,
        grain: "horizontal",
        edgeBand: edge(settings, "top", "bottom", "left", "right"),
        operations: [],
        cnc: true,
      }),
      panel(unit, cabinet, settings, {
        id: `${unit.id}-${fitting.type}-${index}-back`,
        label: `${meta.name} box back - at ${roundMm(fitting.y)} mm`,
        kind: "drawer-box-back",
        width: boxW,
        height: boxH,
        thickness: panelThickness,
        grain: "horizontal",
        operations: [],
        cnc: true,
      }),
      panel(unit, cabinet, settings, {
        id: `${unit.id}-${fitting.type}-${index}-left`,
        label: `${meta.name} box left - at ${roundMm(fitting.y)} mm`,
        kind: "drawer-box-side",
        width: boxD,
        height: boxH,
        thickness: panelThickness,
        grain: "vertical",
        operations: runnerOps(`${unit.id}-${fitting.type}-${index}-left`),
        cnc: true,
      }),
      panel(unit, cabinet, settings, {
        id: `${unit.id}-${fitting.type}-${index}-right`,
        label: `${meta.name} box right - at ${roundMm(fitting.y)} mm`,
        kind: "drawer-box-side",
        width: boxD,
        height: boxH,
        thickness: panelThickness,
        grain: "vertical",
        operations: runnerOps(`${unit.id}-${fitting.type}-${index}-right`),
        cnc: true,
      }),
      panel(unit, cabinet, settings, {
        id: `${unit.id}-${fitting.type}-${index}-bottom`,
        label: `${meta.name} HDF bottom - at ${roundMm(fitting.y)} mm`,
        kind: "drawer-box-bottom",
        width: boxW - 2 * panelThickness + 16,
        height: boxD - 2 * panelThickness + 16,
        thickness: settings.backThickness,
        grain: "none",
        material: "HDF",
        operations: [],
        cnc: true,
      }),
    );
    hardwareItems.push(
      hardware(unit.id, cabinet, `${unit.id}-${fitting.type}-${index}-runners`, "runner", `${meta.name} runners`, 2, {
        length: Math.max(0, boxD),
        positionY: roundMm(fitting.y),
      }),
    );
  });
  return result;
}

/**
 * Builds the technical cabinet graph used by CNC, cut-list and future assembly views.
 * Dimensions are millimetres; Unit itself remains backwards-compatible in centimetres.
 */
export function buildUnitConstruction(
  unit: Unit,
  index: number,
  settings: CncSettings,
): ConstructionAssembly {
  const cabinet = unit.name?.trim() || `Cabinet ${index + 1}`;
  const panelThickness = settings.panelThickness;
  const width = roundMm(unit.w);
  const height = roundMm(unit.h);
  const depth = roundMm(unit.d);
  const plinthHeight = (unit.y ?? 0) <= 0 ? 60 : 0;
  const bodyHeight = height - plinthHeight;
  const innerW = width - 2 * panelThickness;
  const commonMaterial = unit.finish;
  const hasSink = (unit.appliances ?? []).some((appliance) => appliance.type === "sink");
  const frontUnit: Unit =
    hasSink && unit.front !== "none" && unit.front !== "drawers"
      ? { ...unit, front: "double", frontLeaves: 2 }
      : unit;
  const parts: ConstructionPart[] = [];
  const hardwareItems: ConstructionHardware[] = [];
  const warnings: string[] = [];

  if (unit.standaloneAppliance) {
    hardwareItems.push(
      hardware(unit.id, cabinet, `${unit.id}-standalone-appliance`, "appliance", unit.standaloneAppliance, 1, {
        type: unit.standaloneAppliance,
      }),
    );
    return {
      id: `assembly-${unit.id}`,
      unitId: unit.id,
      cabinet,
      dimensions: { width, height, depth, elevation: roundMm(unit.y ?? 0) },
      joinery: settings.joinery ?? DEFAULT_CNC_SETTINGS.joinery!,
      parts,
      hardware: hardwareItems,
      warnings,
    };
  }

  parts.push(
    panel(unit, cabinet, settings, {
      id: `${unit.id}-left-side`,
      label: "Left side",
      kind: "side",
      width: depth,
      height: bodyHeight,
      thickness: panelThickness,
      grain: "vertical",
      edgeBand: edge(settings, "front"),
      operations: sideOperations(`${unit.id}-left-side`, depth, bodyHeight, settings),
      cnc: true,
    }),
    panel(unit, cabinet, settings, {
      id: `${unit.id}-right-side`,
      label: "Right side",
      kind: "side",
      width: depth,
      height: bodyHeight,
      thickness: panelThickness,
      grain: "vertical",
      edgeBand: edge(settings, "front"),
      operations: sideOperations(`${unit.id}-right-side`, depth, bodyHeight, settings),
      cnc: true,
    }),
    panel(unit, cabinet, settings, {
      id: `${unit.id}-top`,
      label: "Top",
      kind: "top",
      width: innerW,
      height: depth,
      thickness: panelThickness,
      grain: "horizontal",
      edgeBand: edge(settings, "front"),
      operations: carcassConnectorOperations(`${unit.id}-top`, innerW, depth, settings),
      cnc: true,
    }),
    panel(unit, cabinet, settings, {
      id: `${unit.id}-bottom`,
      label: "Bottom",
      kind: "bottom",
      width: innerW,
      height: depth,
      thickness: panelThickness,
      grain: "horizontal",
      edgeBand: edge(settings, "front"),
      operations: carcassConnectorOperations(`${unit.id}-bottom`, innerW, depth, settings),
      cnc: true,
    }),
  );
  hardwareItems.push(
    hardware(unit.id, cabinet, `${unit.id}-carcass-connectors`, "connector", "Carcass connector", 8, {
      system: settings.joinery ?? DEFAULT_CNC_SETTINGS.joinery ?? "confirmat",
      diameter: settingsValue(settings.connectorDiameter, DEFAULT_CNC_SETTINGS.connectorDiameter!),
    }),
  );

  const rebateWidth = settingsValue(settings.backRebateWidth, DEFAULT_CNC_SETTINGS.backRebateWidth!);
  const rebateDepth = settingsValue(settings.backRebateDepth, DEFAULT_CNC_SETTINGS.backRebateDepth!);
  const backWidth = innerW + 2 * rebateWidth;
  const backHeight = bodyHeight - 2 * panelThickness + 2 * rebateWidth;
  const backOperations: ConstructionOperation[] = [
    {
      id: `${unit.id}-back-rebate`,
      kind: "route",
      face: "front",
      path: [
        { x: rebateWidth, y: rebateWidth },
        { x: backWidth - rebateWidth, y: rebateWidth },
        { x: backWidth - rebateWidth, y: backHeight - rebateWidth },
        { x: rebateWidth, y: backHeight - rebateWidth },
        { x: rebateWidth, y: rebateWidth },
      ],
      toolDiameter: 6,
      depth: rebateDepth,
      purpose: "Back panel rebate",
    },
  ];
  if (hasSink) {
    backOperations.push(plumbingClearanceCutout(`${unit.id}-back-plumbing-clearance`, backWidth, backHeight));
  }
  parts.push(
    panel(unit, cabinet, settings, {
      id: `${unit.id}-back`,
      label: `Back - ${rebateWidth} mm rebate each side`,
      kind: "back",
      width: backWidth,
      height: backHeight,
      thickness: settings.backThickness,
      material: "HDF",
      grain: "vertical",
      operations: backOperations,
      note: hasSink
        ? `${rebateWidth} mm rebate each side / ${rebateDepth} mm deep; rear plumbing clearance is nominal`
        : `${rebateWidth} mm rebate each side / ${rebateDepth} mm deep`,
      cnc: true,
    }),
  );

  if (plinthHeight) {
    for (const position of ["front", "back"] as const) {
      parts.push(
        panel(unit, cabinet, settings, {
          id: `${unit.id}-plinth-${position}`,
          label: `Plinth ${position}`,
          kind: "plinth",
          width: innerW,
          height: plinthHeight,
          thickness: panelThickness,
          grain: "horizontal",
          edgeBand: edge(settings, "front"),
          operations: [],
          cnc: true,
        }),
      );
    }
    hardwareItems.push(
      hardware(unit.id, cabinet, `${unit.id}-legs`, "leg", "Adjustable cabinet leg", 4, {
        height: plinthHeight,
      }),
      hardware(unit.id, cabinet, `${unit.id}-plinth-clips`, "plinth", "Plinth clip", 4, {}),
    );
  }

  const requiresWallFixing =
    unit.mount === "wall" ||
    unit.mount === "tall" ||
    (unit.y ?? 0) > 0 ||
    (unit.mount === "base" && unit.drawers >= 2);
  if (requiresWallFixing) {
    const quantity = unit.mount === "wall" || unit.mount === "tall" ? 2 : 1;
    hardwareItems.push(
      hardware(
        unit.id,
        cabinet,
        `${unit.id}-wall-fixing`,
        "wall-fixing",
        "Wall fixing / anti-tip kit",
        quantity,
        {
          mount: unit.mount,
          position: "rear top",
          anchors: quantity,
          wallType: "site-specific",
        },
        "Choose anchors for the actual wall material and check for hidden pipes or cables before drilling.",
      ),
    );
  }

  parts.push(...fittingParts(unit, cabinet, settings, hardwareItems));

  const stack = roundMm(drawerStackHeight(unit));
  if (unit.drawers > 0) {
    const count = Math.max(1, unit.drawers);
    const frontStack = unit.front === "drawers" ? bodyHeight : stack;
    const frontH = frontStack / count - 3;
    const drawerSpec = sectionSpec(unit, 0, 0);
    for (let index = 0; index < count; index++) {
      const id = `${unit.id}-drawer-front-${index}`;
      parts.push(
        panel(unit, cabinet, settings, {
          id,
          label: `Drawer front ${index + 1}`,
          kind: "drawer-front",
          width: width - 6,
          height: frontH,
          thickness: panelThickness,
          grain: "vertical",
          edgeBand: edge(settings, "top", "bottom", "left", "right"),
          operations: handleOperations(id, width - 6, frontH, drawerSpec, settings),
          note: "3 mm reveal",
          cnc: true,
        }),
      );
      if (drawerSpec.handleStyle !== "push" && drawerSpec.handleStyle !== "profile") {
        hardwareItems.push(
          hardware(unit.id, cabinet, `${id}-handle`, "handle", "Drawer handle", 1, {
            style: drawerSpec.handleStyle,
          }),
        );
      }
    }
  }

  if (frontUnit.front !== "none" && frontUnit.front !== "drawers") {
    const leaves = leafCount(frontUnit);
    const sections = Math.max(1, Math.min(3, frontUnit.frontSections ?? 1));
    const fractions = frontSectionFractions(frontUnit);
    for (let leaf = 0; leaf < leaves; leaf++) {
      for (let section = 0; section < sections; section++) {
        const spec = sectionSpec(frontUnit, leaf, section);
        const doorHeight = bodyHeight - stack - 6;
        const sectionHeight = doorHeight * (fractions[section] ?? 1 / sections);
        const id = `${unit.id}-door-${leaf}-${section}`;
        const glass = spec.material !== "solid";
        parts.push(
          panel(unit, cabinet, settings, {
            id,
            label:
              leaves === 2
                ? `${leaf === 0 ? "Left" : "Right"} door - section ${section + 1}`
                : spec.mode === "pullout"
                  ? "Pull-out front"
                  : "Door",
            kind: "door",
            width: width / leaves - 6,
            height: sectionHeight,
            thickness: panelThickness,
            grain: "vertical",
            material: glass ? spec.material : commonMaterial,
            ...(glass ? {} : { edgeBand: edge(settings, "top", "bottom", "left", "right") }),
            operations: glass ? [] : doorOperations(id, width / leaves - 6, sectionHeight, spec, settings),
            glass,
            note: glass
              ? "supplied as glass - do not send to CNC"
              : spec.side === "push"
                ? "push-to-open"
              : `handle ${spec.handlePos} @ ${roundMm(spec.handleY ?? 100)} mm`,
            cnc: !glass,
          }),
        );
        if (spec.mode === "hinged") {
          hardwareItems.push(
            hardware(unit.id, cabinet, `${id}-hinges`, "hinge", "Concealed hinge", hingeCount(sectionHeight), {
              cupDiameter: settingsValue(settings.hingeCupDiameter, DEFAULT_CNC_SETTINGS.hingeCupDiameter!),
              side: spec.hinge,
            }),
          );
        }
        if (spec.handleStyle !== "push" && spec.handleStyle !== "profile") {
          hardwareItems.push(
            hardware(unit.id, cabinet, `${id}-handle`, "handle", "Front handle", 1, {
              style: spec.handleStyle,
              position: spec.handlePos,
            }),
          );
        }
      }
    }
  }

  if (unit.countertop) {
    const countertopMaterial = unit.countertopMaterial ?? "stone";
    const countertopOperations = (unit.appliances ?? [])
      .filter((appliance) => appliance.type === "sink" || appliance.type === "hob")
      .map((appliance, index) =>
        countertopCutout(
          `${unit.id}-countertop-cutout-${index}`,
          width,
          depth,
          appliance,
          appliance.type as "sink" | "hob",
        ),
      );
    const countertopCnc = countertopMaterial !== "stone";
    parts.push(
      panel(unit, cabinet, settings, {
        id: `${unit.id}-countertop`,
        label: "Kitchen worktop",
        kind: "countertop",
        width,
        height: depth,
        thickness: settingsValue(
          settings.countertopThickness,
          DEFAULT_CNC_SETTINGS.countertopThickness!,
        ),
        grain: "none",
        material: countertopMaterial,
        ...(countertopCnc ? { edgeBand: edge(settings, "front", "left", "right") } : {}),
        operations: countertopOperations,
        note: countertopCnc
          ? "Cutouts are nominal - verify the appliance drawing."
          : "Stone worktop: send to a specialist fabricator with the appliance drawings.",
        cnc: countertopCnc,
      }),
    );
    hardwareItems.push(
      hardware(unit.id, cabinet, `${unit.id}-countertop`, "countertop", "Kitchen worktop", 1, {
        width,
        depth,
        material: countertopMaterial,
      }),
    );
  }
  if (hasSink) {
    hardwareItems.push(
      hardware(
        unit.id,
        cabinet,
        `${unit.id}-sink-plumbing-kit`,
        "accessory",
        "Sink plumbing service kit",
        1,
        { rearClearance: "nominal", clearanceWidth: 260, clearanceHeight: 180 },
        "Verify the trap, waste and water-supply positions on site before cutting or installing.",
      ),
    );
    warnings.push("Sink rear plumbing clearance is nominal and must be verified on site.");
  }
  if (unit.backsplash) {
    hardwareItems.push(
      hardware(unit.id, cabinet, `${unit.id}-backsplash`, "accessory", "Backsplash panel", 1, {
        width,
        height: roundMm(unit.backsplashHeight ?? 60),
      }),
    );
  }
  (unit.appliances ?? []).forEach((appliance, index) => {
    hardwareItems.push(
      hardware(unit.id, cabinet, `${unit.id}-appliance-${index}`, "appliance", appliance.type, 1, {
        x: roundMm(appliance.x ?? 0),
        y: roundMm(appliance.y ?? 0),
      }),
    );
    if (appliance.type === "sink" || appliance.type === "hob") {
      hardwareItems.push(
        hardware(
          unit.id,
          cabinet,
          `${unit.id}-${appliance.type}-cutout-${index}`,
          "cutout",
          `${appliance.type} countertop cutout`,
          1,
          { appliance: appliance.type, verified: false },
          "Nominal placeholder: verify the manufacturer's installation drawing before cutting.",
        ),
      );
      warnings.push(
        `${appliance.type} countertop cutout is nominal and must be verified against the manufacturer's drawing.`,
      );
    }
  });

  if (unit.underStairs) {
    warnings.push("Sloped top profile still needs a profile-aware panel contour before machining.");
  }
  if (unit.front === "glass" || (unit.doorMaterial && unit.doorMaterial !== "solid")) {
    warnings.push("Glass or framed fronts are supplied/assembled separately and are not CNC nested as board panels.");
  }

  return {
    id: `assembly-${unit.id}`,
    unitId: unit.id,
    cabinet,
    dimensions: { width, height, depth, elevation: roundMm(unit.y ?? 0) },
    joinery: settings.joinery ?? DEFAULT_CNC_SETTINGS.joinery!,
    parts,
    hardware: hardwareItems,
    warnings,
  };
}

export function buildConstructionAssemblies(
  units: Unit[],
  settings: CncSettings,
): ConstructionAssembly[] {
  return units.map((unit, index) => buildUnitConstruction(unit, index, settings));
}
