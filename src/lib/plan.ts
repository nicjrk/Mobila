import {
  bayOffsets,
  bayWidths,
  runWidth,
  wallSpec,
  walls,
  type Config,
  type WallId,
} from "@/lib/wardrobe";

export type PlanItemKind = "unit" | "cabinet";

export type PlanItem = {
  id: string;
  kind: PlanItemKind;
  label: string;
  wall?: WallId;
  bay?: number;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  selected: boolean;
};

type Placement = { x: number; z: number; rotation: number };

function placements(config: Config): Record<WallId, Placement> {
  const wa = runWidth(config, "a");
  const wb = runWidth(config, "b");
  const da = wallSpec(config, "a").depth;
  const db = wallSpec(config, "b").depth;
  const dc = wallSpec(config, "c").depth;

  if (config.roomShape === "understairs" && config.underStairsExtraRun) {
    return {
      a: { x: -(wa + wb) / 2 + wa / 2, z: 0, rotation: 0 },
      b: { x: -(wa + wb) / 2 + wa + wb / 2, z: 0, rotation: 0 },
      c: { x: 0, z: 0, rotation: 0 },
    };
  }
  if (config.roomShape === "lshape") {
    return {
      a: { x: db + wa / 2, z: da / 2, rotation: 0 },
      b: { x: db / 2, z: da + wb / 2, rotation: Math.PI / 2 },
      c: { x: 0, z: 0, rotation: 0 },
    };
  }
  if (config.roomShape === "ushape") {
    return {
      a: { x: 0, z: da / 2, rotation: 0 },
      b: { x: -wa / 2 + db / 2, z: da + wb / 2, rotation: Math.PI / 2 },
      c: {
        x: wa / 2 - dc / 2,
        z: da + runWidth(config, "c") / 2,
        rotation: -Math.PI / 2,
      },
    };
  }
  if (config.roomShape === "galley") {
    return {
      a: { x: 0, z: da / 2, rotation: 0 },
      b: { x: 0, z: da + config.aisle + db / 2, rotation: Math.PI },
      c: { x: 0, z: 0, rotation: 0 },
    };
  }
  return {
    a: { x: 0, z: 0, rotation: 0 },
    b: { x: 0, z: 0, rotation: 0 },
    c: { x: 0, z: 0, rotation: 0 },
  };
}

/** Shared top-view projection. Wall items are derived from the same layout data as 3D. */
export function planItems(
  config: Config,
  selectedUnitId: string | null,
  wall: WallId,
  bay: number,
) {
  if (config.roomShape === "modular") {
    return config.units.map<PlanItem>((unit, index) => ({
      id: unit.id,
      kind: "unit",
      label: unit.name ?? `Unit ${index + 1}`,
      x: unit.x,
      z: unit.z,
      width: unit.w,
      depth: unit.d,
      height: unit.h,
      rotation: unit.rot,
      selected: unit.id === selectedUnitId,
    }));
  }

  const place = placements(config);
  return walls(config).flatMap<PlanItem>((currentWall) => {
    const width = runWidth(config, currentWall);
    const spec = wallSpec(config, currentWall);
    const offsets = bayOffsets(config, currentWall);
    const widths = bayWidths(config, currentWall);
    const p = place[currentWall];
    return widths.map((bayWidth, index) => {
      const localX = (offsets[index] ?? 0) + bayWidth / 2 - width / 2;
      const cos = Math.cos(p.rotation);
      const sin = Math.sin(p.rotation);
      return {
        id: `${currentWall}${index}`,
        kind: "cabinet" as const,
        label: `${currentWall.toUpperCase()} · ${index + 1}`,
        wall: currentWall,
        bay: index,
        x: p.x + cos * localX,
        z: p.z + sin * localX,
        width: bayWidth,
        depth: spec.depth,
        height: spec.height,
        rotation: p.rotation,
        selected: currentWall === wall && index === bay,
      };
    });
  });
}

export function planBounds(items: PlanItem[]) {
  if (!items.length) return { minX: -150, maxX: 150, minZ: -150, maxZ: 150 };
  const corners: Array<[number, number]> = items.flatMap((item) => {
    const c = Math.cos(item.rotation);
    const s = Math.sin(item.rotation);
    const localCorners: Array<[number, number]> = [
      [-item.width / 2, -item.depth / 2],
      [item.width / 2, -item.depth / 2],
      [item.width / 2, item.depth / 2],
      [-item.width / 2, item.depth / 2],
    ];
    return localCorners.map(
      ([x, z]) => [item.x + c * x - s * z, item.z + s * x + c * z] as [number, number],
    );
  });
  const xs = corners.map(([x]) => x);
  const zs = corners.map(([, z]) => z);
  const padding = 60;
  return {
    minX: Math.min(...xs) - padding,
    maxX: Math.max(...xs) + padding,
    minZ: Math.min(...zs) - padding,
    maxZ: Math.max(...zs) + padding,
  };
}
