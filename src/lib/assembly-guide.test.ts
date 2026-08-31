import { describe, expect, it } from "vitest";
import { buildAssemblyGuide, createAssemblyGuideHtml } from "@/lib/assembly-guide";
import { buildUnitConstruction } from "@/lib/construction";
import { cncSettings } from "@/lib/cnc";
import { defaultConfig, newUnit } from "@/lib/wardrobe";

describe("assembly guide generator", () => {
  it("creates a complete sequence from the technical construction graph", () => {
    const assembly = buildUnitConstruction(
      newUnit({
        id: "guide-kitchen",
        drawers: 2,
        countertop: true,
        faucet: true,
        fittings: [
          { id: "shelf-1", type: "shelf", y: 40 },
          { id: "drawer-1", type: "drawer", y: 80 },
        ],
        appliances: [{ id: "sink-1", type: "sink", x: 0, y: 4 }],
      }),
      0,
      cncSettings(defaultConfig()),
    );
    const guide = buildAssemblyGuide(assembly);

    expect(guide.schema).toBe("mobila-assembly-guide-v1");
    expect(guide.estimatedMinutes).toBeGreaterThan(15);
    expect(guide.steps.map((step) => step.kind)).toEqual([
      "prepare",
      "carcass",
      "back",
      "base",
      "interior",
      "drawers",
      "fronts",
      "services",
      "final",
    ]);
    expect(guide.steps.find((step) => step.kind === "drawers")?.hardwareIds).toEqual(
      expect.arrayContaining(["guide-kitchen-drawer-1-runners"]),
    );
    expect(guide.steps.find((step) => step.kind === "services")?.hardwareIds).toEqual(
      expect.arrayContaining(["guide-kitchen-sink-plumbing-kit"]),
    );
    expect(guide.steps.find((step) => step.kind === "final")?.hardwareIds).toEqual(
      expect.arrayContaining(["guide-kitchen-wall-fixing"]),
    );
  });

  it("renders printable instructions with referenced parts and warnings", () => {
    const assembly = buildUnitConstruction(
      newUnit({
        id: "print-guide",
        countertop: true,
        appliances: [{ id: "hob-1", type: "hob", x: 0, y: 4 }],
      }),
      0,
      cncSettings(defaultConfig()),
    );
    const guide = buildAssemblyGuide(assembly);
    const html = createAssemblyGuideHtml([guide], [assembly], "Demo project");

    expect(html).toContain("Demo project");
    expect(html).toContain("Build and square the cabinet carcass");
    expect(html).toContain("Kitchen worktop");
    expect(html).toContain("Technical warnings");
  });
});
