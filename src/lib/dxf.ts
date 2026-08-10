import type { CncCutlist, NestedPart } from "@/lib/cnc";

const clean = (value: string) =>
  value.replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "") || "project";
const pair = (code: number, value: string | number) => `${code}\n${value}`;
const text = (x: number, y: number, value: string, height: number, layer = "LABELS") =>
  [
    pair(0, "TEXT"),
    pair(8, layer),
    pair(10, x.toFixed(3)),
    pair(20, y.toFixed(3)),
    pair(40, height.toFixed(3)),
    pair(1, value),
  ].join("\n");
const rectangle = (x: number, y: number, width: number, height: number, layer: string) =>
  [
    pair(0, "POLYLINE"),
    pair(8, layer),
    pair(66, 1),
    pair(70, 1),
    pair(0, "VERTEX"),
    pair(8, layer),
    pair(10, x.toFixed(3)),
    pair(20, y.toFixed(3)),
    pair(0, "VERTEX"),
    pair(8, layer),
    pair(10, (x + width).toFixed(3)),
    pair(20, y.toFixed(3)),
    pair(0, "VERTEX"),
    pair(8, layer),
    pair(10, (x + width).toFixed(3)),
    pair(20, (y + height).toFixed(3)),
    pair(0, "VERTEX"),
    pair(8, layer),
    pair(10, x.toFixed(3)),
    pair(20, (y + height).toFixed(3)),
    pair(0, "SEQEND"),
    pair(8, layer),
  ].join("\n");

export function createDxf(cutlist: CncCutlist, projectName = "Project"): string {
  const entities: string[] = [];
  const gap = 300;
  cutlist.sheets.forEach((sheet) => {
    const offsetX = (sheet.number - 1) * (sheet.width + gap);
    entities.push(rectangle(offsetX, 0, sheet.width, sheet.height, "SHEET"));
    entities.push(
      text(
        offsetX + 20,
        sheet.height - 30,
        `${projectName} — sheet ${sheet.number} (${sheet.width}x${sheet.height} mm, kerf ${cutlist.settings.kerf} mm)`,
        14,
        "NOTES",
      ),
    );
    sheet.parts.forEach((item: NestedPart) => {
      const width = item.rotated ? item.height : item.width;
      const height = item.rotated ? item.width : item.height;
      const x = offsetX + item.x;
      entities.push(rectangle(x, item.y, width, height, "PANELS"));
      const label = `${item.cabinet} · ${item.label} — ${width.toFixed(1)}x${height.toFixed(1)}x${item.thickness.toFixed(1)}mm`;
      const textHeight = Math.max(6, Math.min(18, Math.min(width, height) / 8));
      entities.push(text(x + width / 2, item.y + height / 2, label, textHeight));
    });
  });
  const layers = ["PANELS", "LABELS", "SHEET", "NOTES"]
    .map((name, index) =>
      [pair(0, "LAYER"), pair(2, name), pair(70, 0), pair(62, [7, 3, 8, 1][index]!)].join("\n"),
    )
    .join("\n");
  const tables = [
    pair(0, "SECTION"),
    pair(2, "TABLES"),
    pair(0, "TABLE"),
    pair(2, "LAYER"),
    pair(70, 4),
    layers,
    pair(0, "ENDTAB"),
    pair(0, "ENDSEC"),
  ].join("\n");
  return [
    pair(0, "SECTION"),
    pair(2, "HEADER"),
    pair(9, "$INSUNITS"),
    pair(70, 4),
    pair(9, "$MEASUREMENT"),
    pair(70, 1),
    pair(0, "ENDSEC"),
    tables,
    pair(0, "SECTION"),
    pair(2, "ENTITIES"),
    entities.join("\n"),
    pair(0, "ENDSEC"),
    pair(0, "EOF"),
  ].join("\n");
}

export const dxfFileName = (projectName: string) => `${clean(projectName)}-panels.dxf`;
