import { clampUnit, type ModularRoom, type Unit } from "./wardrobe";

const GRID = 1; // cm
const SNAP = 10; // cm magnet radius (IKEA-style flush snapping)
/** Back wall plane (z = 0 in plan coordinates). */
export const WALL_Z = 0;

const round = (v: number, step = GRID) => Math.round(v / step) * step;

/** World-space footprint. A quarter-turn swaps the cabinet's X/Z dimensions. */
export function footprintSize(u: Pick<Unit, "w" | "d" | "rot">) {
  const quarterTurn = Math.abs(Math.round(u.rot / 90)) % 2 === 1;
  return quarterTurn ? { width: u.d, depth: u.w } : { width: u.w, depth: u.d };
}

/** Units only snap to each other when they overlap vertically. */
const overlapsY = (a: Unit, b: Unit) => a.y < (b.y ?? 0) + b.h && (b.y ?? 0) < a.y + a.h;

/**
 * Smart edge snapping: side panels glue to neighbouring cabinets, backs align
 * to the wall line, and elevations of wall units line up with each other.
 */
export function snapUnit(moving: Unit, all: Unit[], resolveCollisions = true): Unit {
  const x = round(moving.x);
  let z = round(moving.z);
  if (moving.snap === false) {
    const freePlacement = clampUnit({ ...moving, x, z });
    return resolveCollisions ? avoidOverlap(freePlacement, all) : freePlacement;
  }

  const movingFootprint = footprintSize(moving);

  // flush the back panel against the wall line
  const backZ = WALL_Z + movingFootprint.depth / 2;
  if (Math.abs(z - backZ) < SNAP) z = backZ;

  let snappedX = x;
  let snappedDistance = SNAP;
  for (const o of all) {
    if (o.id === moving.id) continue;
    if (!overlapsY({ ...moving, z }, o)) continue;
    const otherFootprint = footprintSize(o);
    const alignedZ =
      Math.abs(z - o.z) < SNAP * 1.6 ? o.z + (otherFootprint.depth - movingFootprint.depth) / 2 : z;

    const right = o.x + otherFootprint.width / 2 + movingFootprint.width / 2;
    const left = o.x - otherFootprint.width / 2 - movingFootprint.width / 2;
    const rightDistance = Math.abs(x - right);
    const leftDistance = Math.abs(x - left);
    if (rightDistance < snappedDistance) {
      snappedDistance = rightDistance;
      snappedX = right;
      z = alignedZ;
    }
    if (leftDistance < snappedDistance) {
      snappedDistance = leftDistance;
      snappedX = left;
      z = alignedZ;
    }
  }
  const snapped = clampUnit({ ...moving, x: round(snappedX), z: round(z) });
  return resolveCollisions ? avoidOverlap(snapped, all) : snapped;
}

/** Snap a cabinet to the nearest room wall as well as neighbouring cabinets. */
export function snapUnitToRoom(
  moving: Unit,
  all: Unit[],
  room: ModularRoom,
  resolveCollisions = true,
): Unit {
  const snapped = snapUnit(moving, all, resolveCollisions);
  // `snap: false` means free placement: containment and collision protection
  // still apply, but the cabinet must not magnetically jump to a room wall.
  if (moving.snap === false) {
    return resolveCollisions
      ? keepUnitInRoom(snapped, all, room)
      : containUnit(clampUnit(snapped), room);
  }
  const footprint = footprintSize(snapped);
  const candidates = [
    { axis: "z" as const, value: footprint.depth / 2 },
    { axis: "z" as const, value: room.depth - footprint.depth / 2 },
    { axis: "x" as const, value: -room.width / 2 + footprint.width / 2 },
    { axis: "x" as const, value: room.width / 2 - footprint.width / 2 },
  ];
  let best = snapped;
  // New units start at z=0 while their back edge is d/2; allow that
  // initial placement to land on the back wall automatically.
  let bestDistance = 64;
  for (const candidate of candidates) {
    const distance = Math.abs(snapped[candidate.axis] - candidate.value);
    if (distance >= bestDistance) continue;
    bestDistance = distance;
    best = { ...best, [candidate.axis]: candidate.value };
  }
  return resolveCollisions ? keepUnitInRoom(best, all, room) : containUnit(best, room);
}

/* ---------------- Collision guard ---------------- */

const intersects = (a: Unit, b: Unit) => {
  const gap = 0.5; // cm tolerance so flush-snapped panels still count as legal
  const af = footprintSize(a);
  const bf = footprintSize(b);
  const ox = Math.abs(a.x - b.x) < (af.width + bf.width) / 2 - gap;
  const oz = Math.abs(a.z - b.z) < (af.depth + bf.depth) / 2 - gap;
  const oy = (a.y ?? 0) < (b.y ?? 0) + b.h - gap && (b.y ?? 0) < (a.y ?? 0) + a.h - gap;
  return ox && oz && oy;
};

/** Return true when a candidate can be committed without leaving the room or overlapping. */
export function isUnitPlacementValid(moving: Unit, all: Unit[], room: ModularRoom): boolean {
  const contained = containUnit(moving, room);
  const staysInside =
    Math.abs(contained.x - moving.x) < 0.01 && Math.abs(contained.z - moving.z) < 0.01;
  return staysInside && !all.some((other) => other.id !== moving.id && intersects(moving, other));
}

/** Keep the complete world-space footprint inside the room envelope. */
export function containUnit(u: Unit, room: ModularRoom): Unit {
  const footprint = footprintSize(u);
  const minX = -room.width / 2 + footprint.width / 2;
  const maxX = room.width / 2 - footprint.width / 2;
  const minZ = footprint.depth / 2;
  const maxZ = room.depth - footprint.depth / 2;
  const xMin = u.x - footprint.width / 2;
  const xMax = u.x + footprint.width / 2;
  const entryMin = -room.entryWidth / 2;
  const entryMax = room.entryWidth / 2;
  const blocksEntry =
    xMax > entryMin && xMin < entryMax && u.z + footprint.depth / 2 > room.depth - 1;
  const safeMaxZ = blocksEntry ? Math.min(maxZ, room.depth - footprint.depth / 2 - 1) : maxZ;
  return {
    ...u,
    x: Math.max(minX, Math.min(maxX, round(u.x))),
    z: Math.max(minZ, Math.min(safeMaxZ, round(u.z))),
  };
}

/** Contain a unit and resolve collisions by trying all four free directions. */
export function keepUnitInRoom(moving: Unit, all: Unit[], room: ModularRoom): Unit {
  const previous = all.find((other) => other.id === moving.id);
  let current = containUnit(clampUnit(moving), room);
  for (let pass = 0; pass < 16; pass++) {
    const hit = all.find((other) => other.id !== current.id && intersects(current, other));
    if (!hit) return current;
    const hf = footprintSize(hit);
    const cf = footprintSize(current);
    const candidates = [
      { x: hit.x + hf.width / 2 + cf.width / 2, z: current.z },
      { x: hit.x - hf.width / 2 - cf.width / 2, z: current.z },
      { x: current.x, z: hit.z + hf.depth / 2 + cf.depth / 2 },
      { x: current.x, z: hit.z - hf.depth / 2 - cf.depth / 2 },
    ]
      .map((position) => containUnit({ ...current, ...position }, room))
      .filter(
        (candidate) =>
          !all.some((other) => other.id !== current.id && intersects(candidate, other)),
      );
    if (!candidates.length) {
      // During a drag, restore the last valid location instead of committing an overlap.
      if (
        previous &&
        !all.some((other) => other.id !== previous.id && intersects(previous, other))
      ) {
        return previous;
      }
      // New units get a deterministic nearest free cell when all obvious directions are busy.
      const footprint = footprintSize(current);
      const minX = -room.width / 2 + footprint.width / 2;
      const maxX = room.width / 2 - footprint.width / 2;
      const minZ = footprint.depth / 2;
      const maxZ = room.depth - footprint.depth / 2;
      for (let z = minZ; z <= maxZ; z += 20) {
        for (let x = minX; x <= maxX; x += 20) {
          const candidate = containUnit({ ...current, x, z }, room);
          if (!all.some((other) => other.id !== current.id && intersects(candidate, other))) {
            return candidate;
          }
        }
      }
      return current;
    }
    current = candidates.reduce((best, candidate) => {
      const candidateDistance = Math.hypot(candidate.x - current.x, candidate.z - current.z);
      const bestDistance = Math.hypot(best.x - current.x, best.z - current.z);
      return candidateDistance < bestDistance ? candidate : best;
    });
  }
  return current;
}

/**
 * Never let two cabinets share the same volume: push the moving unit sideways
 * to the closest free position next to whatever it collides with.
 */
export function avoidOverlap(moving: Unit, all: Unit[]): Unit {
  let u = moving;
  for (let pass = 0; pass < 12; pass++) {
    const hit = all.find((o) => o.id !== u.id && intersects(u, o));
    if (!hit) return u;
    const hitFootprint = footprintSize(hit);
    const movingFootprint = footprintSize(u);
    const right = hit.x + hitFootprint.width / 2 + movingFootprint.width / 2;
    const left = hit.x - hitFootprint.width / 2 - movingFootprint.width / 2;
    u = { ...u, x: round(Math.abs(right - u.x) <= Math.abs(u.x - left) ? right : left) };
  }
  return u;
}

/** Vertical snapping: align a unit's bottom to a neighbour's top/bottom edge. */
export function snapElevation(moving: Unit, all: Unit[]): number {
  if (moving.snap === false) return round(moving.y);
  const y = round(moving.y);
  if (Math.abs(y) < 8) return 0;
  for (const o of all) {
    if (o.id === moving.id) continue;
    const overlapX = Math.abs(moving.x - o.x) < (moving.w + o.w) / 2 + 4;
    if (!overlapX) continue;
    const top = (o.y ?? 0) + o.h;
    if (Math.abs(y - top) < 10) return top;
    if (Math.abs(y - (o.y ?? 0)) < 10) return o.y ?? 0;
  }
  return y;
}

/** Push a unit flush against the nearest wall line (back wall). */
export function alignToWall(u: Unit): Unit {
  return clampUnit({ ...u, z: WALL_Z + u.d / 2 });
}

/** Place a brand-new unit flush to the right of the current assembly. */
export function nextUnitX(units: Unit[], w: number): number {
  if (units.length === 0) return 0;
  const rightMost = units.reduce((a, b) => {
    const aRight = a.x + footprintSize(a).width / 2;
    const bRight = b.x + footprintSize(b).width / 2;
    return aRight > bRight ? a : b;
  });
  return rightMost.x + footprintSize(rightMost).width / 2 + w / 2;
}

/** Place a brand-new unit flush to the left of the current assembly. */
export function previousUnitX(units: Unit[], w: number): number {
  if (units.length === 0) return 0;
  const leftMost = units.reduce((a, b) => {
    const aLeft = a.x - footprintSize(a).width / 2;
    const bLeft = b.x - footprintSize(b).width / 2;
    return aLeft < bLeft ? a : b;
  });
  return leftMost.x - footprintSize(leftMost).width / 2 - w / 2;
}
