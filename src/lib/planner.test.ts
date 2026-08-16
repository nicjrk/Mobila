import { describe, expect, it } from "vitest";
import { footprintSize, snapUnit, snapUnitToRoom } from "@/lib/units";
import {
  billOfMaterials,
  DEFAULT_MODULAR_ROOM,
  defaultConfig,
  enterModular,
  newUnit,
  totalPrice,
} from "@/lib/wardrobe";
import { validateConfig } from "@/lib/validation";
import { catalogProduct, skuForBomKey } from "@/lib/catalog";
import { normalizeConfig, parseDesignFile } from "@/lib/design-file";
import { KITCHEN_LAYOUT_PRESETS } from "@/lib/presets";
import { buildCncCutlist, cncSettings, nestParts, partsForUnit } from "@/lib/cnc";
import { createDxf } from "@/lib/dxf";
import { decodeConfig, encodeConfig } from "@/lib/share";

describe("modular planner core rules", () => {
  it("snaps a cabinet back to the wall line", () => {
    const moving = newUnit({ id: "moving", x: 0, z: 24, d: 60 });
    const snapped = snapUnit(moving, []);
    expect(snapped.z).toBe(30);
  });

  it("snaps a neighbouring cabinet flush and avoids overlap", () => {
    const first = newUnit({ id: "first", x: 0, z: 30, w: 60, d: 60 });
    const moving = newUnit({ id: "moving", x: 58, z: 30, w: 60, d: 60 });
    const snapped = snapUnit(moving, [first]);
    expect(snapped.x).toBe(60);
    expect(Math.abs(snapped.x - first.x)).toBeGreaterThanOrEqual(60);
  });

  it("reports cabinet collisions and clears them after moving apart", () => {
    const config = enterModular(defaultConfig());
    const first = newUnit({ id: "first", x: 0, z: 30 });
    const second = newUnit({ id: "second", x: 20, z: 30 });
    const issues = validateConfig({ ...config, units: [first, second] });
    expect(issues.some((issue) => issue.id.startsWith("unit-overlap"))).toBe(true);
    const valid = validateConfig({ ...config, units: [first, { ...second, x: 80 }] });
    expect(valid.some((issue) => issue.id.startsWith("unit-overlap"))).toBe(false);
  });

  it("allows flush-mounted cabinets without a front-clearance warning", () => {
    const config = enterModular(defaultConfig());
    const first = newUnit({ id: "first", x: 0, z: 30 });
    const flush = newUnit({ id: "flush", x: 60, z: 30 });
    const smallGap = newUnit({ id: "small-gap", x: 61, z: 30 });

    const flushIssues = validateConfig({ ...config, units: [first, flush] });
    expect(flushIssues.some((issue) => issue.id.startsWith("front-clearance"))).toBe(false);

    const gapIssues = validateConfig({ ...config, units: [first, smallGap] });
    expect(gapIssues.some((issue) => issue.id.startsWith("front-clearance"))).toBe(true);
  });

  it("calculates a BOM and total for modular units", () => {
    const config = enterModular(defaultConfig());
    const units = [newUnit({ id: "one" }), newUnit({ id: "two", x: 60 })];
    const bom = billOfMaterials({ ...config, units });
    expect(bom.length).toBe(1);
    expect(bom[0]?.qty).toBe(2);
    expect(bom[0]?.sku).toBe("WW-CAB-MODULAR");
    expect(totalPrice({ ...config, units })).toBeGreaterThan(0);
  });

  it("validates modular appliance height and includes its price", () => {
    const config = enterModular(defaultConfig());
    const unit = newUnit({
      id: "appliance-unit",
      appliances: [{ id: "fridge-1", type: "fridge", y: 100 }],
    });
    const issues = validateConfig({ ...config, units: [unit] });
    expect(issues.some((issue) => issue.id === "appliance-unit-appliance-fridge-1-bounds")).toBe(
      true,
    );
    const without = totalPrice({ ...config, units: [newUnit({ id: "plain" })] });
    const withAppliance = totalPrice({ ...config, units: [unit] });
    expect(withAppliance).toBeGreaterThan(without);
  });

  it("validates overlapping full-height appliances inside one cabinet", () => {
    const config = enterModular(defaultConfig());
    const unit = newUnit({
      id: "multi-appliance",
      appliances: [
        { id: "oven-a", type: "oven", x: 0, y: 4 },
        { id: "dishwasher-a", type: "dishwasher", x: 0, y: 4 },
      ],
    });
    expect(
      validateConfig({ ...config, units: [unit] }).some((issue) =>
        issue.id.includes("appliance-overlap"),
      ),
    ).toBe(true);
  });

  it("supports kitchen worktops and validates sink and faucet combinations", () => {
    const config = enterModular(defaultConfig());
    const kitchen = newUnit({
      id: "kitchen-base",
      countertop: true,
      countertopMaterial: "stone",
      faucet: true,
      appliances: [{ id: "sink-1", type: "sink", y: 4 }],
    });
    const valid = validateConfig({ ...config, units: [kitchen] });
    expect(valid.some((issue) => issue.id.includes("faucet-without-sink"))).toBe(false);
    expect(valid.some((issue) => issue.id.includes("without-countertop"))).toBe(false);

    const incomplete = newUnit({ id: "incomplete-kitchen", faucet: true });
    const warnings = validateConfig({ ...config, units: [incomplete] });
    expect(warnings.some((issue) => issue.id === "incomplete-kitchen-faucet-without-sink")).toBe(
      true,
    );
    expect(totalPrice({ ...config, units: [kitchen] })).toBeGreaterThan(
      totalPrice({ ...config, units: [newUnit({ id: "plain-kitchen" })] }),
    );
  });

  it("validates and prices a backsplash as a countertop accessory", () => {
    const config = enterModular(defaultConfig());
    const withoutTop = newUnit({ id: "splash-only", backsplash: true });
    expect(
      validateConfig({ ...config, units: [withoutTop] }).some(
        (issue) => issue.id === "splash-only-backsplash-without-countertop",
      ),
    ).toBe(true);
    const kitchen = newUnit({
      id: "splash-kitchen",
      z: 30,
      countertop: true,
      backsplash: true,
      backsplashHeight: 75,
    });
    expect(validateConfig({ ...config, units: [kitchen] })).toHaveLength(0);
    expect(totalPrice({ ...config, units: [kitchen] })).toBeGreaterThan(
      totalPrice({ ...config, units: [newUnit({ id: "plain" })] }),
    );
  });

  it("supports every catalog appliance type with stable BOM metadata", () => {
    const keys = ["oven", "microwave", "dishwasher", "hob", "sink", "extractor"];
    for (const key of keys) {
      const sku = skuForBomKey(key);
      expect(sku).toMatch(/^WW-APPL-/);
      expect(catalogProduct(sku)?.category).toBe("appliance");
    }
  });

  it("generates CNC panels with defaults and rejects phantom pieces", () => {
    const config = enterModular(defaultConfig());
    const unit = newUnit({ id: "cnc-unit", w: 60, h: 80, d: 60, drawers: 2, front: "door" });
    const settings = cncSettings({
      ...config,
      cnc: {
        panelThickness: 0,
        backThickness: 0,
        kerf: 0,
        sheetWidth: 0,
        sheetHeight: 0,
        sheetMargin: 0,
      },
    });
    expect(settings.panelThickness).toBe(18);
    const parts = partsForUnit(unit, 0, settings);
    expect(parts.length).toBeGreaterThan(5);
    expect(parts.every((item) => item.width > 1 && item.height > 1)).toBe(true);
    const cutlist = buildCncCutlist({ ...config, units: [unit] });
    expect(cutlist.sheets.length).toBeGreaterThan(0);
    expect(cutlist.sheets.every((sheet) => sheet.parts.length > 0)).toBe(true);
  });

  it("includes wall-run shelves and drawer boxes in the CNC cut list", () => {
    const config = {
      ...defaultConfig(),
      roomShape: "straight" as const,
      items: [{ id: "wall-shelf", wall: "a" as const, bay: 0, type: "shelf" as const, y: 40 }],
    };
    const cutlist = buildCncCutlist(config);
    expect(cutlist.parts.some((item) => item.label.includes("Shelf"))).toBe(true);
  });

  it("does not create a sheet for a part that fits in neither orientation", () => {
    const sheets = nestParts(
      [
        {
          id: "oversized",
          label: "Oversized",
          cabinet: "Cabinet 1",
          width: 3000,
          height: 2200,
          thickness: 18,
          grain: "none",
          cnc: true,
        },
      ],
      {
        panelThickness: 18,
        backThickness: 3,
        kerf: 4,
        sheetWidth: 2800,
        sheetHeight: 2070,
        sheetMargin: 10,
      },
    );
    expect(sheets).toHaveLength(0);
  });

  it("keeps glass fronts in the cut list without nesting them for CNC", () => {
    const config = enterModular(defaultConfig());
    const unit = newUnit({ id: "glass-unit", front: "glass", doorMaterial: "clear" });
    const cutlist = buildCncCutlist({ ...config, units: [unit] });
    const glass = cutlist.parts.find((item) => item.glass);
    expect(glass?.cnc).toBe(false);
    expect(glass?.note).toContain("glass");
    expect(cutlist.sheets.flatMap((sheet) => sheet.parts).some((item) => item.glass)).toBe(false);
  });

  it("keeps independent door and drawer preview states in shared links", () => {
    const source = { ...defaultConfig(), openDoors: true, openDrawers: false };
    const encoded = encodeConfig(source);
    const decoded = decodeConfig(encoded);
    expect(decoded?.openDoors).toBe(true);
    expect(decoded?.openDrawers).toBe(false);

    const drawersOnly = { ...source, openDoors: false, openDrawers: true };
    const decodedDrawers = decodeConfig(encodeConfig(drawersOnly));
    expect(decodedDrawers?.openDoors).toBe(false);
    expect(decodedDrawers?.openDrawers).toBe(true);
  });

  it("creates an R12 DXF with millimetre header, layers and polylines", () => {
    const config = enterModular(defaultConfig());
    const cutlist = buildCncCutlist({ ...config, units: [newUnit({ id: "dxf-unit" })] });
    const dxf = createDxf(cutlist, "Kitchen / Test");
    expect(dxf).toContain("$INSUNITS");
    expect(dxf).toContain("PANELS");
    expect(dxf).toContain("POLYLINE");
    expect(dxf).toContain("Kitchen / Test");
  });

  it("imports exported designs and repairs duplicate unit ids", () => {
    const source = {
      projectName: "Imported hall",
      config: { ...defaultConfig(), units: [newUnit({ id: "same" }), newUnit({ id: "same" })] },
    };
    const imported = parseDesignFile(JSON.stringify(source));
    expect(imported.projectName).toBe("Imported hall");
    expect(imported.config.units).toHaveLength(2);
    expect(new Set(imported.config.units.map((unit) => unit.id)).size).toBe(2);
  });

  it("rejects malformed cabinet and interior item records during import", () => {
    const base = defaultConfig();
    expect(() =>
      parseDesignFile(JSON.stringify({ config: { ...base, units: [{ id: "broken" }] } })),
    ).toThrow("missing valid dimensions");
    expect(() =>
      parseDesignFile(
        JSON.stringify({
          config: { ...base, items: [{ id: "broken", type: 42 }] },
        }),
      ),
    ).toThrow("interior items are invalid");
    expect(() =>
      parseDesignFile(JSON.stringify({ config: { ...base, roomShape: "unknown-layout" } })),
    ).toThrow("unsupported room layout");
  });

  it("normalizes an already decoded configuration through the same import rules", () => {
    const normalized = normalizeConfig(defaultConfig());
    expect(normalized.roomShape).toBe(defaultConfig().roomShape);
    expect(normalized.units).toEqual([]);
    expect(normalized.items).toEqual([]);
  });

  it("deduplicates nested fittings and appliances across imported cabinets", () => {
    const source = {
      ...defaultConfig(),
      units: [
        newUnit({ id: "one", fittings: [{ id: "same", type: "shelf", y: 20 }] }),
        newUnit({
          id: "two",
          appliances: [{ id: "same", type: "oven", y: 4 }],
        }),
      ],
    };
    const imported = parseDesignFile(JSON.stringify({ config: source })).config;
    const ids = [imported.units[0]?.fittings?.[0]?.id, imported.units[1]?.appliances?.[0]?.id];
    expect(new Set(ids).size).toBe(2);
  });

  it("keeps keyboard-style cabinet movement snapped and collision-free", () => {
    const first = newUnit({ id: "first", x: 0, z: 30, w: 60, d: 60 });
    const second = newUnit({ id: "second", x: 60, z: 30, w: 60, d: 60 });
    const nudgedIntoFirst = snapUnit({ ...second, x: 1 }, [first]);
    expect(nudgedIntoFirst.z).toBe(30);
    expect(nudgedIntoFirst.x).toBeGreaterThanOrEqual(60);
  });

  it("keeps modular BOM lines separate when interiors differ", () => {
    const config = enterModular(defaultConfig());
    const withShelf = newUnit({
      id: "shelf-unit",
      fittings: [{ id: "fitting-a", type: "shelf", y: 30 }],
    });
    const withOven = newUnit({
      id: "oven-unit",
      appliances: [{ id: "oven-a", type: "oven", y: 4 }],
    });
    const bom = billOfMaterials({ ...config, units: [withShelf, withOven] });
    expect(bom).toHaveLength(2);
    expect(bom.every((line) => line.sku === "WW-CAB-MODULAR")).toBe(true);
  });

  it("prices freestanding appliances as appliances instead of cabinets", () => {
    const config = enterModular(defaultConfig());
    const fridge = newUnit({ id: "freestanding-fridge", standaloneAppliance: "fridge" });
    const bom = billOfMaterials({ ...config, units: [fridge] });
    expect(bom).toHaveLength(1);
    expect(bom[0]?.sku).toBe("WW-APPL-FRIDGE");
    expect(bom[0]?.label).toContain("Freestanding");
  });

  it("does not generate CNC cabinet panels for freestanding appliances", () => {
    const config = enterModular(defaultConfig());
    const fridge = newUnit({ id: "free-cnc-fridge", standaloneAppliance: "fridge" });
    const cutlist = buildCncCutlist({ ...config, units: [fridge] });
    expect(cutlist.parts).toHaveLength(0);
    expect(cutlist.sheets).toHaveLength(0);
  });

  it("reports collisions between interior fittings and appliances", () => {
    const config = enterModular(defaultConfig());
    const unit = newUnit({
      id: "mixed-interior",
      fittings: [{ id: "shelf-1", type: "shelf", y: 30 }],
      appliances: [{ id: "oven-1", type: "oven", y: 30 }],
    });
    const issues = validateConfig({ ...config, units: [unit] });
    expect(
      issues.some((issue) => issue.id === "mixed-interior-interior-overlap-shelf-1-oven-1"),
    ).toBe(true);
  });

  it("rejects wide modular appliances in narrow cabinets", () => {
    const config = enterModular(defaultConfig());
    const unit = newUnit({
      id: "narrow-appliance",
      w: 40,
      appliances: [{ id: "fridge-1", type: "fridge", y: 4 }],
    });
    const issues = validateConfig({ ...config, units: [unit] });
    expect(issues.some((issue) => issue.id === "narrow-appliance-appliance-fridge-1-width")).toBe(
      true,
    );
  });

  it("snaps new cabinets to the nearest wall in the room envelope", () => {
    const cabinet = newUnit({ id: "room-cabinet", x: 0, z: 0, w: 60, d: 60 });
    const atBack = snapUnitToRoom(cabinet, [], DEFAULT_MODULAR_ROOM);
    expect(atBack.z).toBe(30);
    const nearLeft = snapUnitToRoom({ ...cabinet, x: -385, z: 100 }, [], DEFAULT_MODULAR_ROOM);
    expect(nearLeft.x).toBe(-370);
    expect(nearLeft.rot).toBe(cabinet.rot);
  });

  it("uses rotated world dimensions when aligning and avoiding side-wall units", () => {
    const side = newUnit({ id: "side", rot: 90, x: -170, z: 100, w: 60, d: 60 });
    expect(footprintSize(side)).toEqual({ width: 60, depth: 60 });
    const next = newUnit({ id: "next", rot: 90, x: -170, z: 158, w: 60, d: 60 });
    const snapped = snapUnit(next, [side]);
    expect(Math.abs(snapped.x - side.x)).toBeGreaterThanOrEqual(60);
  });

  it("keeps a cabinet inside the room and reports imported out-of-bounds data", () => {
    const config = enterModular(defaultConfig());
    const outside = newUnit({ id: "outside", x: 500, z: 700 });
    const issues = validateConfig({ ...config, units: [outside] });
    expect(issues.some((issue) => issue.id === "outside-outside-room")).toBe(true);
    const placed = snapUnitToRoom(outside, [], DEFAULT_MODULAR_ROOM);
    expect(placed.x).toBeLessThanOrEqual(DEFAULT_MODULAR_ROOM.width / 2 - placed.w / 2);
    expect(placed.z).toBeLessThanOrEqual(DEFAULT_MODULAR_ROOM.depth - placed.d / 2);
  });

  it("keeps the room entry clear when a cabinet is dragged to the front wall", () => {
    const front = newUnit({ id: "front-entry", x: 0, z: 334, w: 60, d: 60 });
    const placed = snapUnitToRoom(front, [], DEFAULT_MODULAR_ROOM);
    expect(placed.z).toBeLessThan(DEFAULT_MODULAR_ROOM.depth - placed.d / 2);
  });

  it("restores the previous valid position instead of committing a collision", () => {
    const existing = newUnit({ id: "existing", x: 0, z: 30 });
    const moving = newUnit({ id: "moving", x: 0, z: 30 });
    const placed = snapUnitToRoom(moving, [existing], DEFAULT_MODULAR_ROOM);
    expect(placed.x).not.toBe(existing.x);
    const restored = snapUnitToRoom({ ...existing, x: 0, z: 30 }, [existing], DEFAULT_MODULAR_ROOM);
    expect(restored.x).toBe(existing.x);
  });

  it("contains the built-in L kitchen layout without cabinet collisions", () => {
    const config = enterModular(defaultConfig());
    expect(KITCHEN_LAYOUT_PRESETS).toHaveLength(2);
    for (const [layoutIndex, layout] of KITCHEN_LAYOUT_PRESETS.entries()) {
      expect(layout.units.length).toBeGreaterThan(8);
      const units = layout.units.map((item, index) =>
        newUnit({
          ...item,
          id: `layout-${layoutIndex}-${index}`,
          appliances: item.appliances ?? [],
        }),
      );
      const issues = validateConfig({ ...config, units });
      expect(issues.some((issue) => issue.id.includes("unit-overlap"))).toBe(false);
    }
  });
});
