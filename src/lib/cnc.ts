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

export type CncPart = {
  id: string;
  label: string;
  cabinet: string;
  width: number;
  height: number;
  thickness: number;
  grain: "vertical" | "horizontal" | "none";
  note?: string;
  cnc: boolean;
  glass?: boolean;
};

export type NestedPart = CncPart & { x: number; y: number; rotated: boolean; sheet: number };
export type CncSheet = { number: number; width: number; height: number; parts: NestedPart[] };
export type CncCutlist = {
  settings: CncSettings;
  parts: CncPart[];
  sheets: CncSheet[];
  oversized: CncPart[];
  totalAreaM2: number;
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

export function partsForUnit(unit: Unit, index: number, settings: CncSettings): CncPart[] {
  if (unit.standaloneAppliance) return [];
  const cabinet = `Cabinet ${index + 1}`;
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
    const frontH = (bodyH - stack + stack) / n - 0.3;
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
  const parts = [
    ...config.units.flatMap((unit, index) => partsForUnit(unit, index, settings)),
    ...partsForWallRuns(config, settings),
  ];
  const sheets = nestParts(
    parts.filter((item) => item.cnc),
    settings,
  );
  const nestedIds = new Set(sheets.flatMap((sheet) => sheet.parts.map((item) => item.id)));
  const oversized = parts.filter((item) => item.cnc && !nestedIds.has(item.id));
  const totalAreaM2 = parts.reduce((sum, item) => sum + (item.width * item.height) / 1_000_000, 0);
  return { settings, parts, sheets, oversized, totalAreaM2 };
}

export function nestParts(parts: CncPart[], settings: CncSettings): CncSheet[] {
  const usableW = settings.sheetWidth - 2 * settings.sheetMargin;
  const usableH = settings.sheetHeight - 2 * settings.sheetMargin;
  const free = new Map<number, Array<{ x: number; y: number; width: number; height: number }>>();
  const sheets: CncSheet[] = [];
  const ordered = [...parts].sort((a, b) => b.width * b.height - a.width * a.height);
  ordered.forEach((item) => {
    const fitsNormal = item.width <= usableW && item.height <= usableH;
    const fitsRotated = item.height <= usableW && item.width <= usableH;
    if (!fitsNormal && !fitsRotated) return;
    let placed: NestedPart | null = null;
    for (const sheet of sheets) {
      const spaces = free.get(sheet.number) ?? [];
      let bestIndex = -1;
      let bestWaste = Number.POSITIVE_INFINITY;
      let bestRotated = false;
      for (let i = 0; i < spaces.length; i++) {
        const space = spaces[i]!;
        for (const rotated of [false, true]) {
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
        (item.height <= usableW && item.width <= usableH))
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
