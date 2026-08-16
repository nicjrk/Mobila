import { fittingsOf, FITTING_META, innerHeight } from "@/lib/fittings";
import {
  bayCountOf,
  bayHeights,
  bayWidths,
  runWidth,
  wallSpec,
  walls,
  UNIT_LIMITS,
  ITEM_META,
  type Config,
  type Fitting,
  type Unit,
} from "@/lib/wardrobe";

export type ValidationIssue = {
  id: string;
  severity: "error" | "warning";
  message: string;
  unitId?: string;
};

const overlap = (a: Fitting, b: Fitting) => {
  const ah = FITTING_META[a.type].height;
  const bh = FITTING_META[b.type].height;
  return a.y < b.y + bh - 0.01 && b.y < a.y + ah - 0.01;
};

function rectangleCorners(unit: Unit): [number, number][] {
  const angle = (unit.rot * Math.PI) / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const localCorners: [number, number][] = [
    [-unit.w / 2, -unit.d / 2],
    [unit.w / 2, -unit.d / 2],
    [unit.w / 2, unit.d / 2],
    [-unit.w / 2, unit.d / 2],
  ];
  return localCorners.map(
    ([x, z]) => [unit.x + c * x - s * z, unit.z + s * x + c * z] as [number, number],
  );
}

function polygonsOverlap(a: [number, number][], b: [number, number][]) {
  const polygons = [a, b];
  for (const polygon of polygons) {
    for (let i = 0; i < polygon.length; i++) {
      const current = polygon[i];
      const next = polygon[(i + 1) % polygon.length];
      if (!current || !next) continue;
      const axis: [number, number] = [-(next[1] - current[1]), next[0] - current[0]];
      const project = (points: [number, number][]) =>
        points.map(([x, z]) => x * axis[0] + z * axis[1]);
      const first = project(a);
      const second = project(b);
      if (
        Math.max(...first) <= Math.min(...second) + 0.5 ||
        Math.max(...second) <= Math.min(...first) + 0.5
      )
        return false;
    }
  }
  return true;
}

const unitOverlap = (a: Unit, b: Unit) =>
  polygonsOverlap(rectangleCorners(a), rectangleCorners(b)) &&
  (a.y ?? 0) < (b.y ?? 0) + b.h - 0.5 &&
  (b.y ?? 0) < (a.y ?? 0) + a.h - 0.5;

/** Pure editor validation used by the UI, save and export flows. */
export function validateConfig(config: Config): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  const add = (issue: ValidationIssue) => issues.push(issue);

  config.units.forEach((unit, index) => {
    if (ids.has(unit.id)) {
      add({
        id: `duplicate-${unit.id}`,
        severity: "error",
        message: `Duplicate cabinet id at Unit ${index + 1}.`,
        unitId: unit.id,
      });
    }
    ids.add(unit.id);
    (Object.entries(UNIT_LIMITS) as [keyof typeof UNIT_LIMITS, readonly number[]][]).forEach(
      ([key, limits]) => {
        const [min, max] = limits;
        if (min === undefined || max === undefined) return;
        const value = key === "y" ? (unit.y ?? 0) : unit[key];
        if (value < min || value > max) {
          add({
            id: `${unit.id}-${key}`,
            severity: "error",
            message: `Unit ${index + 1}: ${key} must be between ${min} and ${max} cm.`,
            unitId: unit.id,
          });
        }
      },
    );
    if (config.roomShape === "modular") {
      const corners = rectangleCorners(unit);
      const outside = corners.some(
        ([x, z]) =>
          x < -config.modularRoom.width / 2 - 0.5 ||
          x > config.modularRoom.width / 2 + 0.5 ||
          z < -0.5 ||
          z > config.modularRoom.depth + 0.5,
      );
      if (outside) {
        add({
          id: `${unit.id}-outside-room`,
          severity: "error",
          message: `Unit ${index + 1}: the cabinet footprint is outside the room walls.`,
          unitId: unit.id,
        });
      }
    }

    const fittings = fittingsOf(unit);
    const height = innerHeight(unit);
    fittings.forEach((fitting) => {
      const fittingHeight = FITTING_META[fitting.type].height;
      if (fitting.y < 0 || fitting.y + fittingHeight > height + 0.01) {
        add({
          id: `${unit.id}-fit-${fitting.id}-bounds`,
          severity: "error",
          message: `${FITTING_META[fitting.type].name} exceeds the usable cabinet height.`,
          unitId: unit.id,
        });
      }
      fittings
        .filter((other) => other.id !== fitting.id && other.id > fitting.id)
        .forEach((other) => {
          if (overlap(fitting, other))
            add({
              id: `${unit.id}-fit-overlap-${fitting.id}-${other.id}`,
              severity: "error",
              message: `${FITTING_META[fitting.type].name} overlaps another interior fitting.`,
              unitId: unit.id,
            });
        });
    });
    (unit.appliances ?? []).forEach((appliance) => {
      const applianceHeight = ITEM_META[appliance.type].height;
      const needsWideBay = ["fridge", "washer", "oven", "dishwasher"].includes(appliance.type);
      if (needsWideBay && unit.w < 60) {
        add({
          id: `${unit.id}-appliance-${appliance.id}-width`,
          severity: "error",
          message: `${ITEM_META[appliance.type].name} needs a cabinet at least 60 cm wide.`,
          unitId: unit.id,
        });
      }
      // A standard integrated dishwasher is 82 cm including the worktop zone.
      // In a base cabinet with a countertop, it sits beneath that top instead
      // of being treated as an over-height tower.
      const standardIntegratedDishwasher =
        appliance.type === "dishwasher" &&
        unit.mount === "base" &&
        unit.countertop &&
        appliance.y <= 4;
      if (
        !standardIntegratedDishwasher &&
        (appliance.y < 0 || appliance.y + applianceHeight > innerHeight(unit) + 0.01)
      ) {
        add({
          id: `${unit.id}-appliance-${appliance.id}-bounds`,
          severity: "error",
          message: `${ITEM_META[appliance.type].name} exceeds the usable cabinet height.`,
          unitId: unit.id,
        });
      }
      fittings.forEach((fitting) => {
        const fittingHeight = FITTING_META[fitting.type].height;
        const intersects =
          fitting.y < appliance.y + applianceHeight - 0.01 &&
          appliance.y < fitting.y + fittingHeight - 0.01;
        if (intersects) {
          add({
            id: `${unit.id}-interior-overlap-${fitting.id}-${appliance.id}`,
            severity: "error",
            message: `${FITTING_META[fitting.type].name} overlaps ${ITEM_META[appliance.type].name}.`,
            unitId: unit.id,
          });
        }
      });
    });
    const fullHeightAppliances = (unit.appliances ?? []).filter((appliance) =>
      ["fridge", "washer", "oven", "dishwasher", "microwave"].includes(appliance.type),
    );
    const applianceWidth = (type: string) =>
      ["fridge", "washer", "oven", "dishwasher"].includes(type) ? 60 : 45;
    for (let i = 0; i < fullHeightAppliances.length; i++) {
      for (let j = i + 1; j < fullHeightAppliances.length; j++) {
        const first = fullHeightAppliances[i];
        const second = fullHeightAppliances[j];
        if (!first || !second) continue;
        const firstX = first.x ?? 0;
        const secondX = second.x ?? 0;
        const horizontalOverlap =
          Math.abs(firstX - secondX) <
          (applianceWidth(first.type) + applianceWidth(second.type)) / 2 - 0.5;
        const verticalOverlap =
          first.y < second.y + ITEM_META[second.type].height - 0.01 &&
          second.y < first.y + ITEM_META[first.type].height - 0.01;
        if (horizontalOverlap && verticalOverlap) {
          add({
            id: `${unit.id}-appliance-overlap-${first.id}-${second.id}`,
            severity: "error",
            message: `${ITEM_META[first.type].name} overlaps ${ITEM_META[second.type].name} inside this cabinet.`,
            unitId: unit.id,
          });
        }
      }
    }
    const hasSink = (unit.appliances ?? []).some((appliance) => appliance.type === "sink");
    const hasHob = (unit.appliances ?? []).some((appliance) => appliance.type === "hob");
    if (unit.faucet && !hasSink) {
      add({
        id: `${unit.id}-faucet-without-sink`,
        severity: "warning",
        message: `Unit ${index + 1}: a faucet is selected but this cabinet has no sink yet.`,
        unitId: unit.id,
      });
    }
    if ((hasSink || hasHob) && !unit.countertop) {
      add({
        id: `${unit.id}-kitchen-appliance-without-countertop`,
        severity: "warning",
        message: `Unit ${index + 1}: add a countertop so the kitchen sink or hob has a proper work surface.`,
        unitId: unit.id,
      });
    }
    if ((hasSink || hasHob) && unit.mount !== "base") {
      add({
        id: `${unit.id}-kitchen-appliance-on-non-base`,
        severity: "warning",
        message: `Unit ${index + 1}: sinks and hobs are normally installed in a base unit.`,
        unitId: unit.id,
      });
    }
    if (unit.backsplash && !unit.countertop) {
      add({
        id: `${unit.id}-backsplash-without-countertop`,
        severity: "warning",
        message: `Unit ${index + 1}: a backsplash is selected but this cabinet has no countertop.`,
        unitId: unit.id,
      });
    }
    if (
      unit.backsplash &&
      ((unit.backsplashHeight ?? 60) < 10 || (unit.backsplashHeight ?? 60) > 120)
    ) {
      add({
        id: `${unit.id}-backsplash-height`,
        severity: "error",
        message: `Unit ${index + 1}: backsplash height must be between 10 and 120 cm.`,
        unitId: unit.id,
      });
    }
    if (unit.drawers > 0 && unit.front !== "drawers" && unit.h < 20 * unit.drawers + 10) {
      add({
        id: `${unit.id}-drawer-door-clearance`,
        severity: "error",
        message: `Unit ${index + 1}: the drawer stack is too tall for a door above it.`,
        unitId: unit.id,
      });
    }
  });

  for (let i = 0; i < config.units.length; i++) {
    for (let j = i + 1; j < config.units.length; j++) {
      const first = config.units[i];
      const second = config.units[j];
      if (!first || !second) continue;
      if (unitOverlap(first, second))
        add({
          id: `unit-overlap-${first.id}-${second.id}`,
          severity: "error",
          message: `Unit ${i + 1} overlaps Unit ${j + 1}.`,
          unitId: first.id,
        });
      const axisAligned = Math.abs(first.rot % 180) < 0.01 && Math.abs(second.rot % 180) < 0.01;
      const firstDepth = first.rot % 180 === 90 ? first.w : first.d;
      const secondDepth = second.rot % 180 === 90 ? second.w : second.d;
      const firstWidth = first.rot % 180 === 90 ? first.d : first.w;
      const secondWidth = second.rot % 180 === 90 ? second.d : second.w;
      const sameDepthLane = Math.abs(first.z - second.z) < (firstDepth + secondDepth) / 2 + 2;
      const gap = Math.abs(first.x - second.x) - (firstWidth + secondWidth) / 2;
      const frontNeedsClearance = first.front !== "none" || second.front !== "none";
      // Flush-mounted cabinets are expected to have 0 cm between carcasses.
      // Only a small positive gap is suspicious; an actual overlap is handled
      // separately by the unit-overlap error above.
      if (axisAligned && sameDepthLane && gap > 0 && gap < 8 && frontNeedsClearance) {
        add({
          id: `front-clearance-${first.id}-${second.id}`,
          severity: "warning",
          message: `Units ${i + 1} and ${j + 1} have only ${Math.round(gap)} cm between fronts; opening doors or drawers may collide.`,
          unitId: first.id,
        });
      }
    }
  }

  if (config.roomShape !== "modular") {
    for (const wall of walls(config)) {
      const width = runWidth(config, wall);
      const spec = wallSpec(config, wall);
      if (width < 30) {
        add({
          id: `wall-${wall}-width`,
          severity: "error",
          message: `${wall.toUpperCase()} is too narrow for a cabinet run (minimum 30 cm).`,
        });
      }
      if (spec.depth < 35 || spec.depth > 80) {
        add({
          id: `wall-${wall}-depth`,
          severity: "error",
          message: `${wall.toUpperCase()} depth must be between 35 and 80 cm.`,
        });
      }
      const widths = bayWidths(config, wall);
      if (widths.length !== bayCountOf(config, wall)) {
        add({
          id: `wall-${wall}-bay-count`,
          severity: "error",
          message: `${wall.toUpperCase()} has an invalid bay layout.`,
        });
      }
      widths.forEach((bayWidth, bay) => {
        if (bayWidth < 30) {
          add({
            id: `wall-${wall}-bay-${bay}-width`,
            severity: "error",
            message: `${wall.toUpperCase()} bay ${bay + 1} is only ${Math.round(bayWidth)} cm wide.`,
          });
        }
      });
    }

    config.items.forEach((item) => {
      const width = bayWidths(config, item.wall)[item.bay] ?? 0;
      const ceiling = bayHeights(config, item.wall, item.bay).min;
      const itemHeight = item.height ?? ITEM_META[item.type].height;
      const appliance = [
        "fridge",
        "washer",
        "oven",
        "microwave",
        "dishwasher",
        "hob",
        "sink",
        "extractor",
      ].includes(item.type);
      const wideAppliance = ["fridge", "washer", "oven", "dishwasher"].includes(item.type);
      if (appliance && wideAppliance && width < 60) {
        add({
          id: `${item.id}-width`,
          severity: "error",
          message: `${ITEM_META[item.type].name} needs a 60 cm bay.`,
        });
      }
      if (item.y < 0 || item.y + itemHeight > ceiling + 0.01) {
        add({
          id: `${item.id}-height`,
          severity: "error",
          message: `Interior equipment in ${item.wall.toUpperCase()} bay ${item.bay + 1} exceeds the available height.`,
        });
      }
    });
  }
  if (config.roomShape === "modular" && config.units.length === 0) {
    add({
      id: "empty-room",
      severity: "warning",
      message: "Add a cabinet to start building the room.",
    });
  }
  return issues;
}
