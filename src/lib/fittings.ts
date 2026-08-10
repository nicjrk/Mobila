import type { Fitting, FittingType, Unit } from "./wardrobe";

/** Standard 32 mm shelf-hole matrix. */
export const HOLE_PITCH = 3.2; // cm
const PANEL = 1.8; // cm carcase panel thickness

export const FITTING_META: Record<FittingType, { name: string; height: number; price: number }> = {
  shelf: { name: "Shelf", height: 2, price: 18 },
  rail: { name: "Clothes rail", height: 4, price: 24 },
  drawer: { name: "Drawer", height: 20, price: 46 },
  basket: { name: "Wire basket", height: 16, price: 26 },
  shoerack: { name: "Shoe rack", height: 14, price: 32 },
  cargo: { name: "Pull-out cargo", height: 120, price: 195 },
};

const newFittingId = () => `f${Math.random().toString(36).slice(2, 9)}`;

/** Height of the plinth under a floor-standing unit. */
const plinth = (u: Unit) => ((u.y ?? 0) > 0 ? 0 : 6);

/**
 * Exterior drawer fronts occupy the lower part of a bay.  Keeping this
 * calculation in the shared fittings module makes every renderer use the
 * same collision boundary instead of re-deriving it from UI state.
 */
export const drawerStackHeight = (u: Unit) =>
  u.front === "drawers" || !u.drawers
    ? 0
    : Math.min(
        Math.max(0, u.drawers) *
          Math.min(60, Math.max(8, u.drawerHeight ?? FITTING_META.drawer.height)),
        Math.max(0, u.h - plinth(u) - 2),
      );

/** Inner base height (cm, from the unit bottom) of the usable interior. */
export const innerBase = (u: Unit) => plinth(u) + PANEL;

/** Usable interior height in cm. */
export const innerHeight = (u: Unit) => Math.max(0, u.h - innerBase(u) - PANEL);

/** Snap a height to the nearest 32 mm hole. */
export const snapHole = (y: number) => Math.round(y / HOLE_PITCH) * HOLE_PITCH;

const span = (f: Fitting) => [f.y, f.y + FITTING_META[f.type].height] as const;

const overlaps = (a: Fitting, b: Fitting) => {
  const [a0, a1] = span(a);
  const [b0, b1] = span(b);
  return a0 < b1 - 0.01 && b0 < a1 - 0.01;
};

/** Fittings derived from the legacy shelves / rail / drawers counters. */
export function defaultFittings(u: Unit): Fitting[] {
  const H = innerHeight(u);
  const list: Fitting[] = [];
  const n = Math.max(0, u.shelves ?? 0);
  for (let i = 0; i < n; i++) {
    list.push({ id: newFittingId(), type: "shelf", y: snapHole(((i + 1) * H) / (n + 1)) });
  }
  if (u.rail) list.push({ id: newFittingId(), type: "rail", y: snapHole(H - 12) });
  return sortFittings(list);
}

export const sortFittings = (list: Fitting[]) => [...list].sort((a, b) => a.y - b.y);

/** Fittings of a unit, migrating older units on the fly. */
export const fittingsOf = (u: Unit): Fitting[] =>
  u.fittings ? sortFittings(u.fittings) : defaultFittings(u);

/**
 * Clamp a fitting inside the carcase and away from its neighbours.
 * Returns null when there is no free slot near the requested height.
 */
export function resolve(
  u: Unit,
  candidate: Fitting,
  others: Fitting[],
  exact = false,
): Fitting | null {
  const H = innerHeight(u);
  const h = FITTING_META[candidate.type].height;
  const max = H - h;
  if (max < 0) return null;
  const wanted = Math.min(max, Math.max(0, exact ? candidate.y : snapHole(candidate.y)));
  const free = (y: number) =>
    y >= -0.01 && y <= max + 0.01 && !others.some((o) => overlaps({ ...candidate, y }, o));
  if (free(wanted)) return { ...candidate, y: wanted };
  // walk outwards along the hole matrix for the nearest legal slot
  const steps = Math.ceil(H / HOLE_PITCH) + 1;
  for (let i = 1; i <= steps; i++) {
    const d = i * HOLE_PITCH;
    for (const y of [wanted - d, wanted + d]) {
      const clamped = Math.min(max, Math.max(0, y));
      if (free(clamped)) return { ...candidate, y: clamped };
    }
  }
  return null;
}

/** Add a fitting, snapped to the hole matrix and collision-free. */
export function addFitting(u: Unit, type: FittingType, atY?: number, id?: string): Unit {
  const list = fittingsOf(u);
  const preferred =
    atY ??
    (type === "rail"
      ? innerHeight(u) - 12
      : Math.min(20, Math.max(0, innerHeight(u) - FITTING_META[type].height)));
  const placed = resolve(u, { id: id ?? newFittingId(), type, y: preferred }, list);
  if (!placed) return u;
  return withFittings(u, sortFittings([...list, placed]));
}

export function removeFitting(u: Unit, id: string): Unit {
  return withFittings(
    u,
    fittingsOf(u).filter((f) => f.id !== id),
  );
}

/**
 * Move a fitting vertically; collisions block the move.
 * With `exact`, the height is used as typed instead of snapping to the 32 mm matrix.
 */
export function moveFitting(u: Unit, id: string, y: number, exact = false): Unit {
  const list = fittingsOf(u);
  const target = list.find((f) => f.id === id);
  if (!target) return u;
  const others = list.filter((f) => f.id !== id);
  const placed = resolve(u, { ...target, y }, others, exact);
  if (!placed) return withFittings(u, list);
  return withFittings(u, sortFittings([...others, placed]));
}

/** Sync the counter-driven sliders with the positioned fittings. */
export function setFittingCount(u: Unit, type: FittingType, n: number): Unit {
  let next = u;
  let list = fittingsOf(u).filter((f) => f.type === type);
  while (list.length > n) {
    const last = list[list.length - 1]!;
    next = removeFitting(next, last.id);
    list = list.slice(0, -1);
  }
  while (list.length < n) {
    const before = fittingsOf(next).length;
    next = addFitting(next, type);
    if (fittingsOf(next).length === before) break; // no room left
    list = fittingsOf(next).filter((f) => f.type === type);
  }
  return next;
}

/** Keep the legacy counters in sync so pricing and the BOM stay correct. */
export function withFittings(u: Unit, list: Fitting[]): Unit {
  const kept = sortFittings(list);
  return {
    ...u,
    fittings: kept,
    shelves: kept.filter((f) => f.type === "shelf").length,
    rail: kept.some((f) => f.type === "rail"),
  };
}

/** Re-seat every fitting after the carcase was resized. */
export function reflowFittings(u: Unit): Unit {
  const out: Fitting[] = [];
  for (const f of fittingsOf(u)) {
    const placed = resolve(u, f, out);
    if (placed) out.push(placed);
  }
  return withFittings(u, out);
}
