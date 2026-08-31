import {
  DEFAULT_CNC_SETTINGS,
  leafCount,
  sectionSpec,
  type CncSettings,
  type Config,
  type Fitting,
  type Unit,
  bayCountOf,
  bayHeights,
  bayWidths,
  doorModeOf,
  doorMaterialOf,
  doorPartsOf,
  handleOf,
  wallLabel,
  wallSpec,
  walls,
} from "@/lib/wardrobe";
import { drawerStackHeight, FITTING_META, fittingsOf } from "@/lib/fittings";
import {
  buildConstructionAssemblies,
  buildUnitConstruction,
  type ConstructionAssembly,
  type ConstructionHardware,
  type ConstructionPart,
} from "@/lib/construction";

export type CncPart = ConstructionPart;

export type NestedPart = CncPart & { x: number; y: number; rotated: boolean; sheet: number };
export type CncSheet = { number: number; width: number; height: number; parts: NestedPart[] };
export type CncCutlist = {
  settings: CncSettings;
  parts: CncPart[];
  assemblies: ConstructionAssembly[];
  hardware: ConstructionHardware[];
  sheets: CncSheet[];
  oversized: CncPart[];
  unsupported: CncUnsupported[];
  totalAreaM2: number;
  /** Informational limitations that require a CAM/technical review before machining. */
  camReviewReasons: CncReviewReason[];
};

export type CncReviewReason = { ro: string; en: string };

export type CncValidationIssue = {
  id: string;
  severity: "error" | "warning";
  message: string;
  messageRo?: string;
  partId?: string;
  sheet?: number;
};

export type CncUnsupported = {
  id: string;
  label: string;
  reason: string;
  reasonRo?: string;
};

export const cncSettings = (config: Config): CncSettings => {
  const raw: Partial<CncSettings> = config.cnc ?? {};
  const positive = (value: number | undefined, fallback: number) =>
    value && value > 0 ? value : fallback;
  return {
    panelThickness: positive(raw.panelThickness, DEFAULT_CNC_SETTINGS.panelThickness),
    backThickness: positive(raw.backThickness, DEFAULT_CNC_SETTINGS.backThickness),
    kerf: positive(raw.kerf, DEFAULT_CNC_SETTINGS.kerf),
    sheetWidth: positive(raw.sheetWidth, DEFAULT_CNC_SETTINGS.sheetWidth),
    sheetHeight: positive(raw.sheetHeight, DEFAULT_CNC_SETTINGS.sheetHeight),
    sheetMargin: positive(raw.sheetMargin, DEFAULT_CNC_SETTINGS.sheetMargin),
    edgeBandThickness: positive(raw.edgeBandThickness, DEFAULT_CNC_SETTINGS.edgeBandThickness!),
    holeDiameter: positive(raw.holeDiameter, DEFAULT_CNC_SETTINGS.holeDiameter!),
    holeDepth: positive(raw.holeDepth, DEFAULT_CNC_SETTINGS.holeDepth!),
    holePitch: positive(raw.holePitch, DEFAULT_CNC_SETTINGS.holePitch!),
    holeOffset: positive(raw.holeOffset, DEFAULT_CNC_SETTINGS.holeOffset!),
    backRebateWidth: positive(raw.backRebateWidth, DEFAULT_CNC_SETTINGS.backRebateWidth!),
    backRebateDepth: positive(raw.backRebateDepth, DEFAULT_CNC_SETTINGS.backRebateDepth!),
    hingeCupDiameter: positive(raw.hingeCupDiameter, DEFAULT_CNC_SETTINGS.hingeCupDiameter!),
    hingeCupDepth: positive(raw.hingeCupDepth, DEFAULT_CNC_SETTINGS.hingeCupDepth!),
    hingeOffset: positive(raw.hingeOffset, DEFAULT_CNC_SETTINGS.hingeOffset!),
    connectorDiameter: positive(raw.connectorDiameter, DEFAULT_CNC_SETTINGS.connectorDiameter!),
    connectorDepth: positive(raw.connectorDepth, DEFAULT_CNC_SETTINGS.connectorDepth!),
    countertopThickness: positive(
      raw.countertopThickness,
      DEFAULT_CNC_SETTINGS.countertopThickness!,
    ),
    joinery: raw.joinery ?? DEFAULT_CNC_SETTINGS.joinery ?? "confirmat",
  };
};

const mm = (cm: number) => Math.round(cm * 100) / 10;
const safePart = (part: CncPart) => part.width > 1 && part.height > 1;
const part = (
  id: string,
  cabinet: string,
  label: string,
  width: number,
  height: number,
  thickness: number,
  options: Pick<CncPart, "grain" | "note" | "cnc" | "glass"> = { grain: "none", cnc: true },
): CncPart => ({
  id,
  cabinet,
  label,
  width: mm(width),
  height: mm(height),
  thickness: Math.round(thickness * 10) / 10,
  ...options,
});

const fittingParts = (unit: Unit, cabinet: string, settings: CncSettings): CncPart[] => {
  const innerW = unit.w - (2 * settings.panelThickness) / 10;
  const depth = unit.d;
  const fittings = fittingsOf(unit);
  const result: CncPart[] = [];
  fittings.forEach((fitting: Fitting, index) => {
    const meta = FITTING_META[fitting.type];
    if (fitting.type === "shelf") {
      result.push(
        part(
          `${unit.id}-shelf-${index}`,
          cabinet,
          `Shelf · at ${mm(fitting.y)} mm`,
          innerW - 0.1,
          depth - 2,
          settings.panelThickness,
          { grain: "horizontal", cnc: true },
        ),
      );
      return;
    }
    if (!["drawer", "basket", "shoerack"].includes(fitting.type)) return;
    const boxW = innerW - 2.6;
    const boxH = meta.height - 4;
    const boxD = depth - 6;
    result.push(
      part(
        `${unit.id}-${fitting.type}-${index}-front`,
        cabinet,
        `${meta.name} box front · at ${mm(fitting.y)} mm`,
        boxW,
        boxH,
        settings.panelThickness,
        { grain: "horizontal", cnc: true },
      ),
      part(
        `${unit.id}-${fitting.type}-${index}-back`,
        cabinet,
        `${meta.name} box back · at ${mm(fitting.y)} mm`,
        boxW,
        boxH,
        settings.panelThickness,
        { grain: "horizontal", cnc: true },
      ),
      part(
        `${unit.id}-${fitting.type}-${index}-left`,
        cabinet,
        `${meta.name} box left · at ${mm(fitting.y)} mm`,
        boxD,
        boxH,
        settings.panelThickness,
        { grain: "vertical", cnc: true },
      ),
      part(
        `${unit.id}-${fitting.type}-${index}-right`,
        cabinet,
        `${meta.name} box right · at ${mm(fitting.y)} mm`,
        boxD,
        boxH,
        settings.panelThickness,
        { grain: "vertical", cnc: true },
      ),
      part(
        `${unit.id}-${fitting.type}-${index}-bottom`,
        cabinet,
        `${meta.name} HDF bottom · at ${mm(fitting.y)} mm`,
        boxW - (2 * settings.panelThickness) / 10 + 1.6,
        boxD - (2 * settings.panelThickness) / 10 + 1.6,
        settings.backThickness,
        { grain: "none", cnc: true },
      ),
    );
  });
  return result;
};

function legacyPartsForUnit(unit: Unit, index: number, settings: CncSettings): CncPart[] {
  if (unit.standaloneAppliance) return [];
  const cabinet = unit.name?.trim() || `Cabinet ${index + 1}`;
  const thickness = settings.panelThickness / 10;
  const plinth = (unit.y ?? 0) <= 0 ? 6 : 0;
  const innerW = unit.w - 2 * thickness;
  const bodyH = unit.h - plinth;
  const result: CncPart[] = [
    part(`${unit.id}-left-side`, cabinet, "Left side", unit.d, bodyH, settings.panelThickness, {
      grain: "vertical",
      cnc: true,
    }),
    part(`${unit.id}-right-side`, cabinet, "Right side", unit.d, bodyH, settings.panelThickness, {
      grain: "vertical",
      cnc: true,
    }),
    part(`${unit.id}-top`, cabinet, "Top", innerW, unit.d, settings.panelThickness, {
      grain: "horizontal",
      cnc: true,
    }),
    part(`${unit.id}-bottom`, cabinet, "Bottom", innerW, unit.d, settings.panelThickness, {
      grain: "horizontal",
      cnc: true,
    }),
    part(
      `${unit.id}-back`,
      cabinet,
      "Back · 8 mm rebate each side",
      innerW + 1.6,
      bodyH - 2 * thickness + 1.6,
      settings.backThickness,
      { grain: "vertical", cnc: true, note: "8 mm rebate each side" },
    ),
  ];
  if (plinth) {
    result.push(
      part(`${unit.id}-plinth-front`, cabinet, "Plinth front", innerW, 6, settings.panelThickness, {
        grain: "horizontal",
        cnc: true,
      }),
      part(`${unit.id}-plinth-back`, cabinet, "Plinth back", innerW, 6, settings.panelThickness, {
        grain: "horizontal",
        cnc: true,
      }),
    );
  }
  result.push(...fittingParts(unit, cabinet, settings));
  const stack = drawerStackHeight(unit);
  if (unit.drawers > 0) {
    const n = Math.max(1, unit.drawers);
    // A full drawer unit fills the carcass; drawers below a door only occupy
    // the configured lower stack. The old expression simplified to bodyH/n
    // in both cases and made mixed drawer fronts almost a metre tall.
    const frontStack = unit.front === "drawers" ? bodyH : stack;
    const frontH = frontStack / n - 0.3;
    for (let i = 0; i < n; i++) {
      result.push(
        part(
          `${unit.id}-drawer-front-${i}`,
          cabinet,
          `Drawer front ${i + 1}`,
          unit.w - 0.6,
          frontH,
          settings.panelThickness,
          { grain: "vertical", cnc: true, note: "3 mm reveal" },
        ),
      );
    }
  }
  if (unit.front !== "none" && unit.front !== "drawers") {
    const leaves = leafCount(unit);
    const sections = Math.max(1, Math.min(3, unit.frontSections ?? 1));
    for (let leaf = 0; leaf < leaves; leaf++) {
      for (let section = 0; section < sections; section++) {
        const spec = sectionSpec(unit, leaf, section);
        const doorH = bodyH - stack - 0.6;
        const sectionH = doorH / sections;
        const glass = spec.material !== "solid";
        result.push(
          part(
            `${unit.id}-door-${leaf}-${section}`,
            cabinet,
            leaves === 2
              ? `${leaf === 0 ? "Left" : "Right"} door · section ${section + 1}`
              : spec.mode === "pullout"
                ? "Pull-out front"
                : "Door",
            unit.w / leaves - 0.6,
            sectionH,
            settings.panelThickness,
            {
              grain: "vertical",
              cnc: !glass,
              glass,
              note: glass
                ? "supplied as glass — do not send to CNC"
                : spec.side === "push"
                  ? "push-to-open"
                  : `handle ${spec.handlePos} @ ${mm(spec.handleY)} mm`,
            },
          ),
        );
      }
    }
  }
  return result.filter(safePart);
}

export function partsForUnit(unit: Unit, index: number, settings: CncSettings): CncPart[] {
  return buildUnitConstruction(unit, index, settings).parts.filter(safePart);
}

export function partsForWallRuns(config: Config, settings: CncSettings): CncPart[] {
  if (config.roomShape === "modular") return [];
  const thickness = settings.panelThickness / 10;
  return walls(config)
    .flatMap((wall) => {
      const spec = wallSpec(config, wall);
      return Array.from({ length: bayCountOf(config, wall) }, (_, bay) => {
        const cabinet = `${wallLabel(config.roomShape, wall)} · Bay ${bay + 1}`;
        const width = bayWidths(config, wall)[bay] ?? 0;
        const heights = bayHeights(config, wall, bay);
        const minHeight = heights.min;
        const plinth = 6;
        const innerW = width - 2 * thickness;
        const topNote =
          Math.abs(heights.left - heights.right) > 0.1 ? "Angled top — sloped run" : undefined;
        const parts: CncPart[] = [
          part(
            `${wall}-${bay}-left-side`,
            cabinet,
            `Left side · x=${mm(
              bayWidths(config, wall)
                .slice(0, bay)
                .reduce((a, b) => a + b, 0),
            )} mm`,
            spec.depth,
            Math.max(0, heights.left - plinth),
            settings.panelThickness,
            { grain: "vertical", cnc: true },
          ),
          part(
            `${wall}-${bay}-right-side`,
            cabinet,
            "Right side",
            spec.depth,
            Math.max(0, heights.right - plinth),
            settings.panelThickness,
            { grain: "vertical", cnc: true },
          ),
          part(`${wall}-${bay}-top`, cabinet, "Top", innerW, spec.depth, settings.panelThickness, {
            grain: "horizontal",
            cnc: true,
            ...(topNote ? { note: topNote } : {}),
          }),
          part(
            `${wall}-${bay}-bottom`,
            cabinet,
            "Bottom",
            innerW,
            spec.depth,
            settings.panelThickness,
            { grain: "horizontal", cnc: true },
          ),
          part(
            `${wall}-${bay}-back`,
            cabinet,
            "Back · 8 mm rebate each side",
            innerW + 1.6,
            Math.max(0, minHeight - plinth - 2 * thickness + 1.6),
            settings.backThickness,
            { grain: "vertical", cnc: true, note: "8 mm rebate each side" },
          ),
          part(
            `${wall}-${bay}-plinth-front`,
            cabinet,
            "Plinth front",
            innerW,
            6,
            settings.panelThickness,
            { grain: "horizontal", cnc: true },
          ),
          part(
            `${wall}-${bay}-plinth-back`,
            cabinet,
            "Plinth back",
            innerW,
            6,
            settings.panelThickness,
            { grain: "horizontal", cnc: true },
          ),
        ];
        const bayItems = config.items.filter((item) => item.wall === wall && item.bay === bay);
        bayItems.forEach((item, itemIndex) => {
          if (item.type === "shelf") {
            parts.push(
              part(
                `${wall}-${bay}-shelf-${itemIndex}`,
                cabinet,
                `Shelf · at ${mm(item.y)} mm`,
                innerW - 0.1,
                spec.depth - 2,
                settings.panelThickness,
                { grain: "horizontal", cnc: true },
              ),
            );
            return;
          }
          if (item.type !== "drawer" && item.type !== "basket") return;
          const meta = FITTING_META[item.type];
          const boxW = innerW - 2.6;
          const boxH = meta.height - 4;
          const boxD = spec.depth - 6;
          parts.push(
            part(
              `${wall}-${bay}-${item.type}-${itemIndex}-front`,
              cabinet,
              `${meta.name} box front · at ${mm(item.y)} mm`,
              boxW,
              boxH,
              settings.panelThickness,
              { grain: "horizontal", cnc: true },
            ),
            part(
              `${wall}-${bay}-${item.type}-${itemIndex}-back`,
              cabinet,
              `${meta.name} box back · at ${mm(item.y)} mm`,
              boxW,
              boxH,
              settings.panelThickness,
              { grain: "horizontal", cnc: true },
            ),
            part(
              `${wall}-${bay}-${item.type}-${itemIndex}-left`,
              cabinet,
              `${meta.name} box left · at ${mm(item.y)} mm`,
              boxD,
              boxH,
              settings.panelThickness,
              { grain: "vertical", cnc: true },
            ),
            part(
              `${wall}-${bay}-${item.type}-${itemIndex}-right`,
              cabinet,
              `${meta.name} box right · at ${mm(item.y)} mm`,
              boxD,
              boxH,
              settings.panelThickness,
              { grain: "vertical", cnc: true },
            ),
            part(
              `${wall}-${bay}-${item.type}-${itemIndex}-bottom`,
              cabinet,
              `${meta.name} HDF bottom · at ${mm(item.y)} mm`,
              boxW - 2 * thickness + 1.6,
              boxD - 2 * thickness + 1.6,
              settings.backThickness,
              { grain: "none", cnc: true },
            ),
          );
        });
        if (config.showDoors) {
          const count = doorPartsOf(config, wall, bay);
          const mode = doorModeOf(config, wall, bay);
          const material = doorMaterialOf(config, wall, bay);
          const handle = handleOf(config, wall, bay);
          for (let leaf = 0; leaf < count; leaf++) {
            const glass = material !== "solid";
            parts.push(
              part(
                `${wall}-${bay}-door-${leaf}`,
                cabinet,
                count === 2
                  ? `${leaf === 0 ? "Left" : "Right"} door`
                  : mode === "pullout"
                    ? "Pull-out front"
                    : "Door",
                width / count - 0.6,
                minHeight - plinth - 0.6,
                settings.panelThickness,
                {
                  grain: "vertical",
                  cnc: !glass,
                  glass,
                  note: glass
                    ? "supplied as glass — do not send to CNC"
                    : handle.side === "push"
                      ? "push-to-open"
                      : `handle ${handle.side} @ ${handle.position ?? 50}%`,
                },
              ),
            );
          }
        }
        return parts.filter(safePart);
      });
    })
    .flat();
}

export function buildCncCutlist(config: Config): CncCutlist {
  const settings = cncSettings(config);
  const assemblies = buildConstructionAssemblies(config.units, settings);
  const parts = [
    ...assemblies.flatMap((assembly) => assembly.parts.filter(safePart)),
    ...partsForWallRuns(config, settings),
  ];
  const hardware = assemblies.flatMap((assembly) => assembly.hardware);
  const unsupported: CncUnsupported[] = [
    ...config.units
      .filter((unit) => unit.underStairs)
      .map((unit) => ({
        id: `unsupported-${unit.id}`,
        label: unit.name ?? `Cabinet ${unit.id}`,
        reason: "Sloped cabinet profiles need a profile-aware DXF before machining.",
        reasonRo: "Profilul înclinat al dulapului are nevoie de un DXF care știe să descrie panta.",
      })),
    ...(config.roomShape === "understairs"
      ? [
          {
            id: "unsupported-understairs-run",
            label: "Under-stairs wall run",
            reason: "Sloped wall-run profiles need a profile-aware DXF before machining.",
            reasonRo:
              "Profilul înclinat de sub scară are nevoie de un DXF care știe să descrie panta.",
          },
        ]
      : []),
  ];
  const sheets = nestParts(
    parts.filter((item) => item.cnc),
    settings,
  );
  const nestedIds = new Set(sheets.flatMap((sheet) => sheet.parts.map((item) => item.id)));
  const oversized = parts.filter((item) => item.cnc && !nestedIds.has(item.id));
  const totalAreaM2 = parts.reduce((sum, item) => sum + (item.width * item.height) / 1_000_000, 0);
  const hasApplianceInstallations = config.units.some((unit) => (unit.appliances?.length ?? 0) > 0);
  const camReviewReasons = parts.length
    ? [
        {
          ro: "DXF-ul conține contururi, marcaje de găurire și frezare; traseele de tăiere nu sunt generate.",
          en: "The DXF contains panel boundaries plus drilling/routing markers; cutting toolpaths are not generated.",
        },
        {
          ro: "Operațiile parametrice sunt nominale și trebuie verificate în CAM în funcție de scule, sensul feței și sistemul de îmbinare.",
          en: "Parametric operations are nominal and must be verified in CAM for tools, face orientation and joinery system.",
        },
        {
          ro: "Canturile și feroneria sunt livrate ca metadate de producție; aplicarea lor fizică rămâne etapă separată de debitare.",
          en: "Edge bands and hardware are exported as production metadata; physical application remains separate from cutting.",
        },
        ...(hasApplianceInstallations
          ? [
              {
                ro: "Decupajele pentru electrocasnice, ventilația și spațiile de service trebuie verificate după desenele producătorului.",
                en: "Appliance cut-outs, ventilation and service clearances must be checked against the manufacturer's drawings.",
              },
            ]
          : []),
      ]
    : [];
  return {
    settings,
    parts,
    assemblies,
    hardware,
    sheets,
    oversized,
    unsupported,
    totalAreaM2,
    camReviewReasons,
  };
}

export function nestParts(parts: CncPart[], settings: CncSettings): CncSheet[] {
  const usableW = settings.sheetWidth - 2 * settings.sheetMargin;
  const usableH = settings.sheetHeight - 2 * settings.sheetMargin;
  const free = new Map<number, Array<{ x: number; y: number; width: number; height: number }>>();
  const sheets: CncSheet[] = [];
  const ordered = [...parts].sort((a, b) => b.width * b.height - a.width * a.height);
  ordered.forEach((item) => {
    const fitsNormal = item.width <= usableW && item.height <= usableH;
    // Rotating a vertical/horizontal-grain panel would change the visible
    // grain direction on the finished cabinet. Only grain-free parts may turn.
    const fitsRotated = item.grain === "none" && item.height <= usableW && item.width <= usableH;
    if (!fitsNormal && !fitsRotated) return;
    let placed: NestedPart | null = null;
    for (const sheet of sheets) {
      const spaces = free.get(sheet.number) ?? [];
      let bestIndex = -1;
      let bestWaste = Number.POSITIVE_INFINITY;
      let bestRotated = false;
      for (let i = 0; i < spaces.length; i++) {
        const space = spaces[i]!;
        for (const rotated of item.grain === "none" ? [false, true] : [false]) {
          const width = rotated ? item.height : item.width;
          const height = rotated ? item.width : item.height;
          if (width + settings.kerf > space.width || height + settings.kerf > space.height)
            continue;
          const waste = space.width * space.height - width * height;
          if (waste < bestWaste) {
            bestWaste = waste;
            bestIndex = i;
            bestRotated = rotated;
          }
        }
      }
      if (bestIndex >= 0) {
        const space = spaces.splice(bestIndex, 1)[0]!;
        const width = bestRotated ? item.height : item.width;
        const height = bestRotated ? item.width : item.height;
        if (space.width - width - settings.kerf >= 20)
          spaces.push({
            x: space.x + width + settings.kerf,
            y: space.y,
            width: space.width - width - settings.kerf,
            height,
          });
        if (space.height - height - settings.kerf >= 20)
          spaces.push({
            x: space.x,
            y: space.y + height + settings.kerf,
            width: space.width,
            height: space.height - height - settings.kerf,
          });
        placed = {
          ...item,
          x: space.x + settings.sheetMargin,
          y: space.y + settings.sheetMargin,
          rotated: bestRotated,
          sheet: sheet.number,
        };
        sheet.parts.push(placed);
        free.set(sheet.number, spaces);
        break;
      }
    }
    if (
      !placed &&
      ((item.width <= usableW && item.height <= usableH) ||
        (item.grain === "none" && item.height <= usableW && item.width <= usableH))
    ) {
      const number = sheets.length + 1;
      sheets.push({ number, width: settings.sheetWidth, height: settings.sheetHeight, parts: [] });
      free.set(number, [{ x: 0, y: 0, width: usableW, height: usableH }]);
      const sheet = sheets[sheets.length - 1]!;
      const spaces = free.get(number)!;
      const rotated = !fitsNormal && fitsRotated;
      const width = rotated ? item.height : item.width;
      const height = rotated ? item.width : item.height;
      const space = spaces.shift()!;
      if (space.width - width - settings.kerf >= 20)
        spaces.push({
          x: width + settings.kerf,
          y: 0,
          width: space.width - width - settings.kerf,
          height,
        });
      if (space.height - height - settings.kerf >= 20)
        spaces.push({
          x: 0,
          y: height + settings.kerf,
          width: space.width,
          height: space.height - height - settings.kerf,
        });
      sheet.parts.push({
        ...item,
        x: space.x + settings.sheetMargin,
        y: space.y + settings.sheetMargin,
        rotated,
        sheet: number,
      });
    }
  });
  return sheets.filter((sheet) => sheet.parts.length > 0);
}

/**
 * Machine-safety checks for the generated nesting result.
 *
 * This does not replace a CAM simulation or a physical test cut. It catches
 * the errors the planner itself can prove: invalid dimensions, duplicate
 * identifiers, parts outside the usable sheet and overlapping toolpaths.
 */
export function validateCncCutlist(cutlist: CncCutlist): CncValidationIssue[] {
  const issues: CncValidationIssue[] = [];
  const { settings, parts, sheets } = cutlist;
  const usableW = settings.sheetWidth - 2 * settings.sheetMargin;
  const usableH = settings.sheetHeight - 2 * settings.sheetMargin;
  const partIds = new Set<string>();
  const nestedIds = new Set<string>();

  cutlist.unsupported.forEach((item) => {
    issues.push({
      id: `cnc-unsupported-${item.id}`,
      severity: "error",
      message: `${item.label}: ${item.reason}`,
      ...(item.reasonRo ? { messageRo: item.label + ": " + item.reasonRo } : {}),
    });
  });

  if (usableW <= 0 || usableH <= 0) {
    issues.push({
      id: "cnc-sheet-usable-area",
      severity: "error",
      message: `The ${settings.sheetMargin} mm sheet margin leaves no usable cutting area on a ${settings.sheetWidth} × ${settings.sheetHeight} mm sheet.`,
      messageRo: `Marginea de ${settings.sheetMargin} mm nu lasă suprafață utilă pentru tăiere pe placa de ${settings.sheetWidth} × ${settings.sheetHeight} mm.`,
    });
  }

  parts.forEach((item) => {
    if (partIds.has(item.id)) {
      issues.push({
        id: `cnc-duplicate-${item.id}`,
        severity: "error",
        message: `Part "${item.label}" in cabinet "${item.cabinet}" has a duplicate internal CNC identifier. Re-import or duplicate the cabinet again to generate a new identifier.`,
        messageRo: `Piesa „${item.label}” din dulapul „${item.cabinet}” are un identificator CNC intern duplicat. Reimportă sau duplică din nou dulapul pentru a genera un identificator nou.`,
        partId: item.id,
      });
    }
    partIds.add(item.id);
    if (
      !Number.isFinite(item.width) ||
      !Number.isFinite(item.height) ||
      !Number.isFinite(item.thickness) ||
      item.width <= 0 ||
      item.height <= 0 ||
      item.thickness <= 0
    ) {
      issues.push({
        id: `cnc-invalid-dimensions-${item.id}`,
        severity: "error",
        message: `Part "${item.label}" in cabinet "${item.cabinet}" has invalid CNC dimensions (${item.width} × ${item.height} × ${item.thickness} mm). Check the cabinet dimensions and board settings.`,
        messageRo: `Piesa „${item.label}” din dulapul „${item.cabinet}” are dimensiuni CNC invalide (${item.width} × ${item.height} × ${item.thickness} mm). Verifică dimensiunile dulapului și setările materialului.`,
        partId: item.id,
      });
    }
    const operationIds = new Set<string>();
    (item.operations ?? []).forEach((operation) => {
      if (operationIds.has(operation.id)) {
        issues.push({
          id: `cnc-operation-duplicate-${item.id}-${operation.id}`,
          severity: "error",
          message: `Part "${item.label}" contains the operation "${operation.id}" more than once. Regenerate the construction model before machining.`,
          messageRo: `Piesa „${item.label}” conține operația „${operation.id}” de mai multe ori. Regenerează modelul tehnic înainte de prelucrare.`,
          partId: item.id,
        });
      }
      operationIds.add(operation.id);
      if (operation.kind === "drill") {
        const validNumbers = [operation.x, operation.y, operation.diameter, operation.depth].every(
          Number.isFinite,
        );
        const radius = Math.max(0, operation.diameter / 2);
        const inside =
          operation.x >= radius - 0.1 &&
          operation.y >= radius - 0.1 &&
          operation.x <= item.width - radius + 0.1 &&
          operation.y <= item.height - radius + 0.1;
        if (!validNumbers || operation.diameter <= 0 || operation.depth <= 0) {
          issues.push({
            id: `cnc-operation-invalid-${item.id}-${operation.id}`,
            severity: "error",
            message: `Drilling operation "${operation.id}" on part "${item.label}" has invalid diameter, depth or coordinates.`,
            messageRo: `Operația de găurire „${operation.id}” de pe piesa „${item.label}” are diametru, adâncime sau coordonate invalide.`,
            partId: item.id,
          });
        } else if (!inside) {
          issues.push({
            id: `cnc-operation-outside-${item.id}-${operation.id}`,
            severity: "error",
            message: `Drilling operation "${operation.id}" on part "${item.label}" falls outside the panel boundary.`,
            messageRo: `Operația de găurire „${operation.id}” de pe piesa „${item.label}” cade în afara conturului panoului.`,
            partId: item.id,
          });
        }
      } else if (operation.kind === "route") {
        const validPath =
          operation.path.length >= 2 &&
          operation.path.every(
            (point) =>
              Number.isFinite(point.x) &&
              Number.isFinite(point.y) &&
              point.x >= -0.1 &&
              point.y >= -0.1 &&
              point.x <= item.width + 0.1 &&
              point.y <= item.height + 0.1,
          );
        if (!validPath || operation.toolDiameter <= 0 || operation.depth <= 0) {
          issues.push({
            id: `cnc-route-invalid-${item.id}-${operation.id}`,
            severity: "error",
            message: `Routing operation "${operation.id}" on part "${item.label}" has an invalid path or depth.`,
            messageRo: `Operația de frezare „${operation.id}” de pe piesa „${item.label}” are traseu sau adâncime invalide.`,
            partId: item.id,
          });
        }
      } else {
        const validCutout =
          Number.isFinite(operation.x) &&
          Number.isFinite(operation.y) &&
          Number.isFinite(operation.width) &&
          Number.isFinite(operation.height) &&
          operation.width > 0 &&
          operation.height > 0 &&
          operation.x >= -0.1 &&
          operation.y >= -0.1 &&
          operation.x + operation.width <= item.width + 0.1 &&
          operation.y + operation.height <= item.height + 0.1;
        if (!validCutout) {
          issues.push({
            id: `cnc-cutout-invalid-${item.id}-${operation.id}`,
            severity: "error",
            message: `Cutout "${operation.id}" on part "${item.label}" falls outside the panel boundary.`,
            messageRo: `Decupajul „${operation.id}” de pe piesa „${item.label}” cade în afara conturului panoului.`,
            partId: item.id,
          });
        } else if (!operation.verified) {
          issues.push({
            id: `cnc-cutout-unverified-${item.id}-${operation.id}`,
            severity: "warning",
            message: `Cutout "${operation.purpose}" on part "${item.label}" is nominal and needs manufacturer verification.`,
            messageRo: `Decupajul „${operation.purpose}” de pe piesa „${item.label}” este nominal și trebuie verificat după desenul producătorului.`,
            partId: item.id,
          });
        }
      }
    });
  });

  sheets.forEach((sheet) => {
    const sheetIds = new Set<string>();
    sheet.parts.forEach((item) => {
      const width = item.rotated ? item.height : item.width;
      const height = item.rotated ? item.width : item.height;
      const minX = settings.sheetMargin - 0.1;
      const minY = settings.sheetMargin - 0.1;
      const maxX = sheet.width - settings.sheetMargin + 0.1;
      const maxY = sheet.height - settings.sheetMargin + 0.1;
      nestedIds.add(item.id);
      if (sheetIds.has(item.id)) {
        issues.push({
          id: `cnc-sheet-duplicate-${sheet.number}-${item.id}`,
          severity: "error",
          message: `Sheet ${sheet.number} contains part "${item.label}" from cabinet "${item.cabinet}" twice. Remove the duplicate part before machining.`,
          messageRo: `Placa ${sheet.number} conține de două ori piesa „${item.label}” din dulapul „${item.cabinet}”. Elimină piesa duplicată înainte de prelucrare.`,
          partId: item.id,
          sheet: sheet.number,
        });
      }
      sheetIds.add(item.id);
      if (item.cnc === false) {
        issues.push({
          id: `cnc-non-machined-${item.id}`,
          severity: "error",
          message: `Part "${item.label}" from cabinet "${item.cabinet}" is marked as non-CNC but was placed on sheet ${sheet.number}. Remove it from CNC nesting or mark it machinable.`,
          messageRo: `Piesa „${item.label}” din dulapul „${item.cabinet}” este marcată ca neprelucrabilă CNC, dar a fost pusă pe placa ${sheet.number}. Scoate-o din nesting sau marcheaz-o ca prelucrabilă.`,
          partId: item.id,
          sheet: sheet.number,
        });
      }
      if (
        !Number.isFinite(item.x) ||
        !Number.isFinite(item.y) ||
        item.x < minX ||
        item.y < minY ||
        item.x + width > maxX ||
        item.y + height > maxY
      ) {
        issues.push({
          id: `cnc-outside-sheet-${item.id}`,
          severity: "error",
          message: `Part "${item.label}" from cabinet "${item.cabinet}" extends outside the usable area of sheet ${sheet.number}. Re-run nesting after changing the sheet or part dimensions.`,
          messageRo: `Piesa „${item.label}” din dulapul „${item.cabinet}” depășește suprafața utilă a plăcii ${sheet.number}. Refă nestingul după modificarea plăcii sau a dimensiunilor piesei.`,
          partId: item.id,
          sheet: sheet.number,
        });
      }
      if (item.rotated && item.grain !== "none") {
        issues.push({
          id: `cnc-grain-rotation-${item.id}`,
          severity: "error",
          message: `Part "${item.label}" from cabinet "${item.cabinet}" was rotated even though its grain direction is fixed. Keep the grain direction or use a grain-free material.`,
          messageRo: `Piesa „${item.label}” din dulapul „${item.cabinet}” a fost rotită, deși fibra este fixă. Păstrează direcția fibrei sau folosește un material fără fibră direcționată.`,
          partId: item.id,
          sheet: sheet.number,
        });
      }
    });

    for (let i = 0; i < sheet.parts.length; i++) {
      const first = sheet.parts[i];
      if (!first) continue;
      const firstW = first.rotated ? first.height : first.width;
      const firstH = first.rotated ? first.width : first.height;
      for (let j = i + 1; j < sheet.parts.length; j++) {
        const second = sheet.parts[j];
        if (!second) continue;
        const secondW = second.rotated ? second.height : second.width;
        const secondH = second.rotated ? second.width : second.height;
        const overlaps =
          first.x < second.x + secondW - 0.01 &&
          second.x < first.x + firstW - 0.01 &&
          first.y < second.y + secondH - 0.01 &&
          second.y < first.y + firstH - 0.01;
        if (overlaps) {
          issues.push({
            id: `cnc-overlap-${sheet.number}-${first.id}-${second.id}`,
            severity: "error",
            message: `Parts "${first.label}" from "${first.cabinet}" and "${second.label}" from "${second.cabinet}" overlap on sheet ${sheet.number}. Re-run nesting before machining.`,
            messageRo: `Piesele „${first.label}” din „${first.cabinet}” și „${second.label}” din „${second.cabinet}” se suprapun pe placa ${sheet.number}. Refă nestingul înainte de prelucrare.`,
            partId: first.id,
            sheet: sheet.number,
          });
        }
      }
    }
  });

  parts.forEach((item) => {
    if (
      item.cnc &&
      !nestedIds.has(item.id) &&
      !cutlist.oversized.some((part) => part.id === item.id)
    ) {
      issues.push({
        id: `cnc-unaccounted-${item.id}`,
        severity: "error",
        message: `Part "${item.label}" from cabinet "${item.cabinet}" is missing from the CNC sheets. Re-run nesting and check the sheet allocation.`,
        messageRo: `Piesa „${item.label}” din dulapul „${item.cabinet}” lipsește din plăcile CNC. Refă nestingul și verifică repartizarea pe plăci.`,
        partId: item.id,
      });
    }
  });
  return issues;
}
