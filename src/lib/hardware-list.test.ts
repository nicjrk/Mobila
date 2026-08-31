import { describe, expect, it } from "vitest";
import {
  aggregateHardware,
  createHardwareListCsv,
  HARDWARE_CATEGORY_LABELS,
} from "@/lib/hardware-list";
import type { ConstructionHardware } from "@/lib/construction";

const hardware = (
  id: string,
  cabinet: string,
  label: string,
  quantity: number,
  specs: ConstructionHardware["specs"],
  category: ConstructionHardware["category"] = "connector",
): ConstructionHardware => ({
  id,
  cabinet,
  unitId: cabinet,
  category,
  label,
  quantity,
  specs,
});

describe("hardware shopping list", () => {
  it("aggregates identical hardware while preserving different specifications", () => {
    const list = aggregateHardware([
      hardware("a", "Base 1", "Carcass connector", 8, { diameter: 5 }),
      hardware("b", "Base 2", "Carcass connector", 8, { diameter: 5 }),
      hardware("c", "Tall 1", "Carcass connector", 8, { diameter: 6 }),
      hardware("d", "Base 1", "Adjustable cabinet leg", 4, { height: 6 }, "leg"),
    ]);

    const fiveMillimetre = list.find(
      (item) => item.label === "Carcass connector" && item.specs["diameter"] === 5,
    );
    expect(fiveMillimetre).toMatchObject({ quantity: 16, cabinets: ["Base 1", "Base 2"] });
    expect(list.filter((item) => item.label === "Carcass connector")).toHaveLength(2);
    expect(list.find((item) => item.category === "leg")?.quantity).toBe(4);
  });

  it("exports a traceable CSV with category, cabinets and specifications", () => {
    const list = aggregateHardware([
      hardware(
        "anchor",
        "Wall 1",
        "Wall fixing / anti-tip kit",
        2,
        { anchors: 2, wallType: "site-specific" },
        "wall-fixing",
      ),
    ]);
    const csv = createHardwareListCsv(list, "Kitchen demo");

    expect(list[0]?.category).toBe("wall-fixing");
    expect(csv).toContain('"Kitchen demo"');
    expect(csv).toContain(`"${HARDWARE_CATEGORY_LABELS["wall-fixing"]}"`);
    expect(csv).toContain('"Wall 1"');
    expect(csv).toContain('"anchors: 2; wallType: site-specific"');
  });
});
