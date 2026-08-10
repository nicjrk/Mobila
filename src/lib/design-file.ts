import { dedupeUnitIds, defaultConfig, ROOM_SHAPES, type Config } from "@/lib/wardrobe";

export type DesignFile = {
  config: Config;
  projectName?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isFiniteNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value);

/** Parse the JSON format produced by the planner's export action. */
export function parseDesignFile(raw: string): DesignFile {
  const parsed: unknown = JSON.parse(raw);
  const envelope = parsed && typeof parsed === "object" ? parsed : null;
  const candidate = envelope && "config" in envelope ? envelope.config : parsed;
  if (!candidate || typeof candidate !== "object") throw new Error("Invalid design file");
  const incoming = candidate as Partial<Config>;
  if (!Array.isArray(incoming.units) || !Array.isArray(incoming.items)) {
    throw new Error("The file does not contain a valid wardrobe configuration");
  }
  if (
    incoming.roomShape !== undefined &&
    !ROOM_SHAPES.some((shape) => shape.id === incoming.roomShape)
  ) {
    throw new Error("The file contains an unsupported room layout");
  }
  if (
    incoming.units.some(
      (unit) =>
        !isRecord(unit) ||
        typeof unit.id !== "string" ||
        !isFiniteNumber(unit.x) ||
        !isFiniteNumber(unit.z) ||
        !isFiniteNumber(unit.w) ||
        !isFiniteNumber(unit.h) ||
        !isFiniteNumber(unit.d),
    )
  ) {
    throw new Error("One or more cabinets are missing valid dimensions");
  }
  if (
    incoming.items.some(
      (item) => !isRecord(item) || typeof item.id !== "string" || typeof item.type !== "string",
    )
  ) {
    throw new Error("One or more interior items are invalid");
  }
  const projectName = envelope && "projectName" in envelope ? envelope.projectName : undefined;
  return {
    config: {
      ...defaultConfig(),
      ...incoming,
      units: dedupeUnitIds(incoming.units),
      items: incoming.items,
    },
    ...(typeof projectName === "string" && projectName.trim() ? { projectName } : {}),
  };
}

/** Validate and normalize an already decoded configuration from any source. */
export function normalizeConfig(raw: unknown): Config {
  return parseDesignFile(JSON.stringify({ config: raw })).config;
}
