import { describe, expect, it } from "vitest";
import { buildCncCutlist, cncSettings, validateCncCutlist } from "@/lib/cnc";
import { createDxf } from "@/lib/dxf";
import { buildUnitConstruction } from "@/lib/construction";
import { defaultConfig, enterModular, newUnit, unitPrice } from "@/lib/wardrobe";
import { fittingsOf } from "@/lib/fittings";

describe("technical construction model", () => {
  it("builds carcass panels with edge bands, 32 mm holes and joinery pilots", () => {
    const settings = cncSettings(defaultConfig());
    const assembly = buildUnitConstruction(newUnit({ id: "technical-cabinet" }), 0, settings);
    const left = assembly.parts.find((part) => part.id === "technical-cabinet-left-side");
    const back = assembly.parts.find((part) => part.kind === "back");

    expect(left?.kind).toBe("side");
    expect(left?.edgeBand?.sides).toContain("front");
    const systemHoles = (left?.operations ?? []).filter(
      (operation) => operation.kind === "drill" && operation.purpose === "32 mm system hole",
    );
    expect(systemHoles.length).toBeGreaterThan(20);
    expect(
      new Set(
        systemHoles
          .map((operation) => (operation.kind === "drill" ? operation.diameter : null))
          .filter((diameter): diameter is number => diameter !== null),
      ),
    ).toEqual(
      new Set([settings.holeDiameter]),
    );
    expect(back?.operations?.some((operation) => operation.kind === "route")).toBe(true);
    expect(assembly.hardware.some((item) => item.category === "connector")).toBe(true);
    expect(assembly.hardware.some((item) => item.category === "hinge")).toBe(true);
    expect(assembly.hardware.some((item) => item.category === "leg")).toBe(true);
  });

  it("models shelves, runners, drawer fronts and handles as separate technical records", () => {
    const settings = cncSettings(defaultConfig());
    const unit = newUnit({
      id: "drawer-cabinet",
      drawers: 2,
      front: "door",
      fittings: [
        { id: "shelf-1", type: "shelf", y: 40 },
        { id: "drawer-1", type: "drawer", y: 80 },
      ],
    });
    const assembly = buildUnitConstruction(unit, 0, settings);

    expect(assembly.parts.some((part) => part.kind === "shelf")).toBe(true);
    expect(assembly.parts.filter((part) => part.kind === "drawer-box-side")).toHaveLength(2);
    expect(assembly.parts.filter((part) => part.kind === "drawer-front")).toHaveLength(2);
    expect(assembly.parts.some((part) => (part.operations ?? []).some((operation) => operation.kind === "drill" && operation.purpose === "Drawer runner fixing"))).toBe(true);
    expect(assembly.hardware.some((item) => item.category === "runner")).toBe(true);
  });

  it("builds a sink base with double fronts, adjustable legs and rear plumbing clearance", () => {
    const settings = cncSettings(defaultConfig());
    const assembly = buildUnitConstruction(
      newUnit({
        id: "sink-base",
        front: "door",
        countertop: true,
        appliances: [{ id: "sink-1", type: "sink", x: 0, y: 4 }],
      }),
      0,
      settings,
    );
    const back = assembly.parts.find((part) => part.kind === "back");

    expect(assembly.parts.filter((part) => part.kind === "door")).toHaveLength(2);
    expect(assembly.hardware.some((item) => item.category === "leg" && item.quantity === 4)).toBe(true);
    expect(assembly.hardware.some((item) => item.label === "Sink plumbing service kit")).toBe(true);
    expect(
      back?.operations?.some(
        (operation) => operation.kind === "cutout" && operation.face === "back" && operation.purpose.includes("plumbing"),
      ),
    ).toBe(true);
    expect(assembly.warnings.some((warning) => warning.includes("Sink rear plumbing"))).toBe(true);
  });

  it("adds wall fixing metadata for suspended, tall and drawer-heavy cabinets", () => {
    const settings = cncSettings(defaultConfig());
    const wall = buildUnitConstruction(
      newUnit({ id: "wall-cabinet", mount: "wall", y: 140, h: 80 }),
      0,
      settings,
    );
    const drawers = buildUnitConstruction(
      newUnit({ id: "drawer-cabinet", drawers: 2 }),
      1,
      settings,
    );

    expect(wall.hardware.find((item) => item.category === "wall-fixing")).toMatchObject({
      quantity: 2,
      specs: { mount: "wall", position: "rear top" },
    });
    expect(drawers.hardware.find((item) => item.category === "wall-fixing")).toMatchObject({
      quantity: 1,
      specs: { mount: "base" },
    });
  });

  it("exports operation geometry in the DXF while keeping CAM review warnings", () => {
    const config = enterModular(defaultConfig());
    const cutlist = buildCncCutlist({
      ...config,
      units: [
        newUnit({
          id: "dxf-technical",
          handleStyle: "knob",
          countertop: true,
          countertopMaterial: "wood",
          appliances: [{ id: "sink-1", type: "sink", x: 0, y: 4 }],
        }),
      ],
    });
    const dxf = createDxf(cutlist, "Technical cabinet");

    expect(cutlist.assemblies).toHaveLength(1);
    expect(cutlist.hardware.length).toBeGreaterThan(0);
    expect(cutlist.parts.some((part) => (part.operations?.length ?? 0) > 0)).toBe(true);
    expect(dxf).toContain("DRILLING");
    expect(dxf).toContain("ROUTING");
    expect(dxf).toContain("CUTOUTS");
    expect(dxf).toContain("CIRCLE");
    expect(dxf).toContain("OP_LABELS");
    expect(cutlist.camReviewReasons.length).toBeGreaterThan(0);
  });

  it("keeps migrated fitting ids stable and prices explicit accessories", () => {
    const unit = newUnit({ id: "legacy-fitting", shelves: 2, rail: true });
    expect(fittingsOf(unit).map((fitting) => fitting.id)).toEqual([
      "legacy-fitting-legacy-shelf-0",
      "legacy-fitting-legacy-shelf-1",
      "legacy-fitting-legacy-rail",
    ]);
    const plain = newUnit({ id: "plain-price" });
    const withCargo = newUnit({
      id: "cargo-price",
      fittings: [{ id: "cargo-1", type: "cargo", y: 40 }],
    });
    expect(unitPrice(withCargo)).toBeGreaterThan(unitPrice(plain));
  });

  it("validates operation coordinates and flags nominal appliance cutouts", () => {
    const config = enterModular(defaultConfig());
    const source = buildCncCutlist({
      ...config,
      units: [
        newUnit({
          id: "validated-cutout",
          countertop: true,
          countertopMaterial: "wood",
          appliances: [{ id: "hob-1", type: "hob", x: 0, y: 4 }],
        }),
      ],
    });
    const invalid = {
      ...source,
      parts: source.parts.map((part) =>
        part.kind === "side"
          ? {
              ...part,
              operations: [
                ...(part.operations ?? []),
                {
                  id: "outside-hole",
                  kind: "drill" as const,
                  face: "inner" as const,
                  x: -20,
                  y: 20,
                  diameter: 5,
                  depth: 12,
                  purpose: "invalid test hole",
                },
              ],
            }
          : part,
      ),
    };
    const issues = validateCncCutlist(invalid);
    expect(issues.some((issue) => issue.id.includes("operation-outside"))).toBe(true);
    expect(issues.some((issue) => issue.id.includes("cutout-unverified"))).toBe(true);
  });
});
