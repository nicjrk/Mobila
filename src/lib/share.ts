import {
  defaultConfig,
  newId,
  type Config,
  type DoorMaterial,
  type DoorMode,
  type HandleAlign,
  type HandleSide,
  type HandleStyle,
  type InteriorItem,
  type ItemType,
  type ModuleType,
  type RoomShape,
  type Unit,
  type WallId,
  type WallSpec,
} from "./wardrobe";

/** URL-safe base64 of the JSON config. */
function toBase64Url(s: string) {
  const b64 = btoa(unescape(encodeURIComponent(s)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return decodeURIComponent(escape(atob(pad)));
}

export function encodeConfig(c: Config): string {
  return toBase64Url(
    JSON.stringify({
      rs: c.roomShape,
      w: c.width,
      wb: c.wallB,
      wc: c.wallC,
      ai: c.aisle,
      h: c.height,
      d: c.depth,
      f: c.finish,
      ds: c.doorStyle,
      sd: c.showDoors,
      dim: c.showDimensions,
      od: c.openDoors,
      dr: c.openDrawers ?? false,
      dm: c.doorMaterials,
      dh: c.doorHandles,
      dmo: c.doorModes,
      dsp: c.doorSplits,
      dsc: c.doorSections,
      ws: c.wallSpecs,
      um: c.usModules,
      cw: c.colWidths,
      sp: c.splits,
      ch: c.colHeights,
      cd: c.colDepths,
      md: c.modules,
      mr: c.modularRoom,
      un: c.units,
      it: c.items.map((i) => [i.bay, i.type, i.y, i.wall ?? "a"]),
    }),
  );
}

export function decodeConfig(code: string): Config | null {
  try {
    const raw = JSON.parse(fromBase64Url(code));
    const base = defaultConfig();
    const items: InteriorItem[] = Array.isArray(raw.it)
      ? raw.it.map((t: [number, ItemType, number, WallId?]) => ({
          id: newId(),
          wall: (t[3] === "b" || t[3] === "c" ? t[3] : "a") as WallId,
          bay: Number(t[0]) || 0,
          type: t[1],
          y: Number(t[2]) || 0,
        }))
      : base.items;
    const shapes: RoomShape[] = [
      "straight",
      "lshape",
      "ushape",
      "galley",
      "understairs",
      "modular",
    ];
    return {
      roomShape: shapes.includes(raw.rs) ? raw.rs : "straight",
      width: Number(raw.w) || base.width,
      wallB: Number(raw.wb) || base.wallB,
      wallC: Number(raw.wc) || base.wallC,
      aisle: Number(raw.ai) || base.aisle,
      height: Number(raw.h) || base.height,
      depth: Number(raw.d) || base.depth,
      finish: raw.f ?? base.finish,
      doorStyle: raw.ds ?? base.doorStyle,
      showDoors: typeof raw.sd === "boolean" ? raw.sd : base.showDoors,
      showDimensions: typeof raw.dim === "boolean" ? raw.dim : base.showDimensions,
      openDoors: typeof raw.od === "boolean" ? raw.od : base.openDoors,
      openDrawers: typeof raw.dr === "boolean" ? raw.dr : base.openDrawers,
      doorMaterials: (raw.dm && typeof raw.dm === "object" ? raw.dm : {}) as Record<
        string,
        DoorMaterial
      >,
      doorHandles: (raw.dh && typeof raw.dh === "object" ? raw.dh : {}) as Record<
        string,
        { side: HandleSide; align: HandleAlign; style?: HandleStyle; position?: number }
      >,
      doorModes: (raw.dmo && typeof raw.dmo === "object" ? raw.dmo : {}) as Record<
        string,
        DoorMode
      >,
      doorSplits: (raw.dsp && typeof raw.dsp === "object" ? raw.dsp : {}) as Record<
        string,
        boolean
      >,
      doorSections: (raw.dsc && typeof raw.dsc === "object" ? raw.dsc : {}) as Record<
        string,
        number
      >,
      wallSpecs: (raw.ws && typeof raw.ws === "object" ? raw.ws : {}) as Partial<
        Record<WallId, Partial<WallSpec>>
      >,
      usModules: Number(raw.um) || base.usModules,
      colWidths: (raw.cw && typeof raw.cw === "object" ? raw.cw : {}) as Partial<
        Record<WallId, number[]>
      >,
      splits: (raw.sp && typeof raw.sp === "object" ? raw.sp : {}) as Record<string, number>,
      colHeights: (raw.ch && typeof raw.ch === "object" ? raw.ch : {}) as Record<string, number>,
      colDepths: (raw.cd && typeof raw.cd === "object" ? raw.cd : {}) as Record<string, number>,
      modules: (raw.md && typeof raw.md === "object" ? raw.md : {}) as Record<string, ModuleType>,
      modularRoom:
        raw.mr && typeof raw.mr === "object"
          ? {
              ...base.modularRoom,
              width: Number(raw.mr.width) || base.modularRoom.width,
              depth: Number(raw.mr.depth) || base.modularRoom.depth,
              height: Number(raw.mr.height) || base.modularRoom.height,
              wallThickness: Number(raw.mr.wallThickness) || base.modularRoom.wallThickness,
              entryWidth: Number(raw.mr.entryWidth) || base.modularRoom.entryWidth,
            }
          : base.modularRoom,
      units: (Array.isArray(raw.un) ? raw.un : []) as Unit[],
      items,
    };
  } catch {
    return null;
  }
}

export function buildShareUrl(c: Config): string {
  const url = new URL(window.location.href);
  url.search = `?d=${encodeConfig(c)}`;
  return url.toString();
}
