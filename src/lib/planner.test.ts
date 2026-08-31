import { describe, expect, it } from "vitest";
import {
  footprintSize,
  isUnitPlacementValid,
  nextUnitX,
  snapUnit,
  snapUnitToRoom,
} from "@/lib/units";
import {
  billOfMaterials,
  DEFAULT_MODULAR_ROOM,
  PRIMARY_WORKSPACES,
  defaultConfig,
  enterModular,
  applianceModuleSpec,
  frontSectionFractions,
  leafCount,
  newUnit,
  totalPrice,
} from "@/lib/wardrobe";
import { validateConfig } from "@/lib/validation";
import { catalogProduct, skuForBomKey } from "@/lib/catalog";
import { normalizeConfig, parseDesignFile } from "@/lib/design-file";
import { KITCHEN_LAYOUT_PRESETS } from "@/lib/presets";
import {
  buildCncCutlist,
  cncSettings,
  nestParts,
  partsForUnit,
  validateCncCutlist,
} from "@/lib/cnc";
import { createDxf } from "@/lib/dxf";
import { createCncManifestCsv } from "@/lib/cnc-manifest";
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
    expect(validateCncCutlist(cutlist)).toHaveLength(0);
    expect(cutlist.camReviewReasons.length).toBeGreaterThan(0);
  });

  it("keeps mixed drawer fronts at the drawer-stack height", () => {
    const config = enterModular(defaultConfig());
    const unit = newUnit({
      id: "mixed-drawers-cnc",
      w: 60,
      h: 200,
      d: 60,
      drawers: 2,
      drawerHeight: 20,
      front: "door",
    });
    const fronts = partsForUnit(unit, 0, cncSettings(config)).filter((item) =>
      item.id.includes("drawer-front"),
    );
    expect(fronts).toHaveLength(2);
    expect(fronts.every((item) => item.height < 250)).toBe(true);
  });

  it("flags drawer stacks that cannot fit below a door", () => {
    const config = enterModular(defaultConfig());
    const unit = newUnit({
      id: "too-tall-drawers",
      h: 80,
      drawers: 3,
      drawerHeight: 30,
      front: "door",
    });
    expect(
      validateConfig({ ...config, units: [unit] }).some((issue) =>
        issue.id.includes("drawer-door-clearance"),
      ),
    ).toBe(true);
  });

  it("blocks flat CNC output for sloped under-stairs profiles", () => {
    const config = enterModular(defaultConfig());
    const cutlist = buildCncCutlist({
      ...config,
      units: [newUnit({ id: "sloped-unit", underStairs: true, slopeMinHeight: 90 })],
    });
    expect(cutlist.unsupported).toHaveLength(1);
    expect(validateCncCutlist(cutlist).some((issue) => issue.id.includes("unsupported"))).toBe(
      true,
    );
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

  it("does not rotate panels with a fixed grain direction", () => {
    const settings = {
      panelThickness: 18,
      backThickness: 3,
      kerf: 4,
      sheetWidth: 1000,
      sheetHeight: 2200,
      sheetMargin: 10,
    };
    const panel = {
      id: "grain-panel",
      label: "Grain panel",
      cabinet: "Cabinet 1",
      width: 1800,
      height: 500,
      thickness: 18,
      grain: "vertical" as const,
      cnc: true,
    };
    expect(nestParts([panel], settings)).toHaveLength(0);
    expect(
      nestParts([{ ...panel, id: "free-panel", grain: "none" as const }], settings)[0]?.parts[0]
        ?.rotated,
    ).toBe(true);
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

  it("keeps advanced room and manufacturing settings in shared links", () => {
    const source = {
      ...defaultConfig(),
      roomShape: "understairs" as const,
      underStairsPlinth: 8,
      underStairsExtraRun: true,
      underStairsExtraUnits: 2,
      openCells: { "a0:0": true },
      cnc: {
        panelThickness: 19,
        backThickness: 4,
        kerf: 3,
        sheetWidth: 2500,
        sheetHeight: 1850,
        sheetMargin: 12,
      },
    };
    const decoded = decodeConfig(encodeConfig(source));
    expect(decoded?.underStairsPlinth).toBe(8);
    expect(decoded?.underStairsExtraRun).toBe(true);
    expect(decoded?.underStairsExtraUnits).toBe(2);
    expect(decoded?.openCells).toEqual({ "a0:0": true });
    expect(decoded?.cnc).toEqual(source.cnc);
  });

  it("creates an R12 DXF with millimetre header, layers and polylines", () => {
    const config = enterModular(defaultConfig());
    const cutlist = buildCncCutlist({ ...config, units: [newUnit({ id: "dxf-unit" })] });
    const dxf = createDxf(cutlist, "Kitchen / Test");
    expect(dxf).toContain("$INSUNITS");
    expect(dxf).toContain("PANELS");
    expect(dxf).toContain("CAM_REVIEW");
    expect(dxf).toContain("POLYLINE");
    expect(dxf).toContain("Kitchen / Test");
  });

  it("keeps the focused workspace list and carries cabinet names into CNC sheets", () => {
    expect(PRIMARY_WORKSPACES.map((workspace) => workspace.id)).toEqual(["understairs", "modular"]);
    const config = enterModular(defaultConfig());
    const cutlist = buildCncCutlist({
      ...config,
      units: [newUnit({ id: "named-cabinet", name: "Tall fridge housing" })],
    });
    expect(cutlist.parts.every((item) => item.cabinet === "Tall fridge housing")).toBe(true);
  });

  it("replaces Kitchen 5 with the separated sketch modules", () => {
    const layout = KITCHEN_LAYOUT_PRESETS.find((item) => item.id === "kitchen-5-sketch");
    expect(layout).toBeDefined();
    const units = layout!.units;
    expect(units.filter((unit) => unit.w === 61).length).toBe(1);
    expect(units.filter((unit) => unit.w === 75).length).toBe(3);
    expect(units.filter((unit) => unit.w === 80).length).toBe(4);
    expect(units.filter((unit) => unit.w === 90).length).toBe(2);
    expect(units.filter((unit) => unit.w === 60).length).toBe(3);
    const threeDoor = units.find((unit) => unit.frontLeaves === 3);
    expect(threeDoor?.w).toBe(125);
    expect(leafCount(newUnit(threeDoor ?? {}))).toBe(3);
    expect(frontSectionFractions(newUnit(units[0] ?? {}))).toEqual([
      100 / 340,
      140 / 340,
      100 / 340,
    ]);
    expect(units.find((unit) => unit.name?.includes("mașină de spălat"))?.appliances).toEqual([
      expect.objectContaining({ type: "washer" }),
    ]);
    expect(units.find((unit) => unit.name?.toLowerCase().includes("corp l"))?.name).toContain(
      "CORP L",
    );
  });

  it("keeps the Aspire manifest traceable to a plate, cabinet and part", () => {
    const config = enterModular(defaultConfig());
    const cutlist = buildCncCutlist({
      ...config,
      units: [newUnit({ id: "manifest-unit", name: "Unit 1" })],
    });
    const manifest = createCncManifestCsv(cutlist, "Kitchen Test");
    expect(manifest).toContain('"project","plate","cabinet","part_id"');
    expect(manifest).toContain('"Kitchen Test"');
    expect(manifest).toContain('"Unit 1"');
    expect(manifest).toContain('"NESTED"');
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

  it("creates individual appliance modules with a real wooden housing", () => {
    const spec = applianceModuleSpec("oven");
    const module = newUnit({
      id: "built-in-oven-module",
      w: spec.w,
      h: spec.h,
      d: spec.d,
      y: spec.y,
      mount: spec.mount,
      front: spec.front,
      countertop: spec.countertop,
      appliances: spec.applianceTypes.map((type, index) => ({
        id: `appliance-${index}`,
        type,
        y: 4,
      })),
    });
    const cutlist = buildCncCutlist({ ...enterModular(defaultConfig()), units: [module] });
    const errors = validateCncCutlist(cutlist).filter((issue) => issue.severity === "error");

    expect(module.standaloneAppliance).toBeUndefined();
    expect(module.appliances?.map((appliance) => appliance.type)).toEqual(["oven", "hob"]);
    expect(cutlist.parts.some((part) => part.id === "built-in-oven-module-left-side")).toBe(true);
    expect(cutlist.parts.some((part) => part.id.includes("door"))).toBe(false);
    expect(errors).toHaveLength(0);
  });

  it("migrates legacy appliance-only units to housing modules on import", () => {
    const legacy = newUnit({ id: "legacy-oven", standaloneAppliance: "oven" });
    const imported = parseDesignFile(
      JSON.stringify({
        config: { ...defaultConfig(), roomShape: "modular", units: [legacy], items: [] },
      }),
    ).config.units[0];

    expect(imported?.standaloneAppliance).toBeUndefined();
    expect(imported?.appliances?.map((appliance) => appliance.type)).toEqual(["oven", "hob"]);
    expect(imported?.front).toBe("none");
  });

  it("keeps standard under-counter appliance modules valid", () => {
    const config = enterModular(defaultConfig());
    const module = newUnit({
      id: "dishwasher-module",
      h: 80,
      countertop: true,
      front: "none",
      appliances: [{ id: "dishwasher", type: "dishwasher", y: 4 }],
    });
    const issues = validateConfig({ ...config, units: [module] });
    expect(issues.some((issue) => issue.id.includes("dishwasher-bounds"))).toBe(false);
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

  it("warns when built-in appliances lack a safe service depth", () => {
    const config = enterModular(defaultConfig());
    const unit = newUnit({
      id: "shallow-appliance",
      d: 50,
      appliances: [{ id: "oven-1", type: "oven", y: 4 }],
    });
    const issues = validateConfig({ ...config, units: [unit] });
    expect(
      issues.some((issue) => issue.id === "shallow-appliance-appliance-oven-1-service-depth"),
    ).toBe(true);
  });

  it("snaps new cabinets to the nearest wall in the room envelope", () => {
    const cabinet = newUnit({ id: "room-cabinet", x: 0, z: 0, w: 60, d: 60 });
    const atBack = snapUnitToRoom(cabinet, [], DEFAULT_MODULAR_ROOM);
    expect(atBack.z).toBe(30);
    const nearLeft = snapUnitToRoom({ ...cabinet, x: -385, z: 100 }, [], DEFAULT_MODULAR_ROOM);
    expect(nearLeft.x).toBe(-370);
    expect(nearLeft.rot).toBe(cabinet.rot);
  });

  it("keeps free-placement cabinets free from magnetic wall snapping", () => {
    const free = newUnit({ id: "free", snap: false, x: 0, z: 36 });
    const placed = snapUnitToRoom(free, [], DEFAULT_MODULAR_ROOM);
    expect(placed.z).toBe(36);
  });

  it("uses the rotated footprint when placing the next cabinet", () => {
    const rotated = newUnit({ id: "rotated", rot: 90, x: 0, w: 40, d: 80 });
    expect(footprintSize(rotated)).toEqual({ width: 80, depth: 40 });
    expect(nextUnitX([rotated], 60)).toBe(70);
  });

  it("can distinguish a valid preview from a colliding preview", () => {
    const first = newUnit({ id: "first", x: 0, z: 30 });
    const moving = newUnit({ id: "moving", x: 0, z: 30 });
    const preview = snapUnitToRoom(moving, [first], DEFAULT_MODULAR_ROOM, false);
    expect(isUnitPlacementValid(preview, [first], DEFAULT_MODULAR_ROOM)).toBe(false);
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
    expect(KITCHEN_LAYOUT_PRESETS).toHaveLength(3);
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
