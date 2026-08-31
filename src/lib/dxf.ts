import type { CncCutlist, NestedPart } from "@/lib/cnc";
import type { ConstructionOperation, ConstructionPoint } from "@/lib/construction";

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

const circle = (x: number, y: number, diameter: number, layer: string) =>
  [
    pair(0, "CIRCLE"),
    pair(8, layer),
    pair(10, x.toFixed(3)),
    pair(20, y.toFixed(3)),
    pair(40, (diameter / 2).toFixed(3)),
  ].join("\n");

const polyline = (points: ConstructionPoint[], layer: string, closed = false) =>
  [
    pair(0, "POLYLINE"),
    pair(8, layer),
    pair(66, 1),
    pair(70, closed ? 1 : 0),
    ...points.flatMap((point) => [
      pair(0, "VERTEX"),
      pair(8, layer),
      pair(10, point.x.toFixed(3)),
      pair(20, point.y.toFixed(3)),
    ]),
    pair(0, "SEQEND"),
    pair(8, layer),
  ].join("\n");

const operationGeometry = (item: NestedPart, offsetX: number, operation: ConstructionOperation) => {
  const toSheetPoint = (point: ConstructionPoint): ConstructionPoint => {
    const local = item.rotated
      ? { x: item.height - point.y, y: point.x }
      : { x: point.x, y: point.y };
    return { x: offsetX + item.x + local.x, y: item.y + local.y };
  };
  if (operation.kind === "drill") {
    const point = toSheetPoint({ x: operation.x, y: operation.y });
    return [
      circle(point.x, point.y, operation.diameter, "DRILLING"),
      text(
        point.x + operation.diameter / 2 + 2,
        point.y,
        `${operation.purpose} ${operation.diameter}x${operation.depth}mm`,
        4,
        "OP_LABELS",
      ),
    ];
  }
  if (operation.kind === "route") {
    const points = operation.path.map(toSheetPoint);
    const first = points[0];
    return [
      polyline(points, "ROUTING"),
      ...(first
        ? [text(first.x, first.y, `${operation.purpose} ${operation.depth}mm deep`, 4, "OP_LABELS")]
        : []),
    ];
  }
  const points = [
    { x: operation.x, y: operation.y },
    { x: operation.x + operation.width, y: operation.y },
    { x: operation.x + operation.width, y: operation.y + operation.height },
    { x: operation.x, y: operation.y + operation.height },
    { x: operation.x, y: operation.y },
  ].map(toSheetPoint);
  return [
    polyline(points, "CUTOUTS", true),
    text(points[0]!.x, points[0]!.y, `${operation.purpose} - VERIFY`, 4, "OP_LABELS"),
  ];
};

export function createDxf(
  cutlist: CncCutlist,
  projectName = "Project",
  sheets = cutlist.sheets,
): string {
  const entities: string[] = [];
  const gap = 300;
  sheets.forEach((sheet, index) => {
    const offsetX = index * (sheet.width + gap);
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
    cutlist.camReviewReasons.forEach((reason, index) => {
      entities.push(
        text(
          offsetX + 20,
          sheet.height - 52 - index * 18,
          `CAM REVIEW RO: ${reason.ro} | EN: ${reason.en}`,
          8,
          "CAM_REVIEW",
        ),
      );
    });
    sheet.parts.forEach((item: NestedPart) => {
      const width = item.rotated ? item.height : item.width;
      const height = item.rotated ? item.width : item.height;
      const x = offsetX + item.x;
      entities.push(rectangle(x, item.y, width, height, "PANELS"));
      const label = `${item.cabinet} · ${item.label} — ${width.toFixed(1)}x${height.toFixed(1)}x${item.thickness.toFixed(1)}mm`;
      const textHeight = Math.max(6, Math.min(18, Math.min(width, height) / 8));
      entities.push(text(x + width / 2, item.y + height / 2, label, textHeight));
      (item.operations ?? []).forEach((operation) => {
        entities.push(...operationGeometry(item, offsetX, operation));
      });
    });
  });
  const layers = [
    "PANELS",
    "LABELS",
    "SHEET",
    "NOTES",
    "CAM_REVIEW",
    "DRILLING",
    "ROUTING",
    "CUTOUTS",
    "OP_LABELS",
  ]
    .map((name, index) =>
      [
        pair(0, "LAYER"),
        pair(2, name),
        pair(70, 0),
        pair(62, [7, 3, 8, 1, 1, 5, 6, 2, 30][index]!),
      ].join("\n"),
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

export const dxfSheetFileName = (projectName: string, sheetNumber: number) =>
  `${clean(projectName)}-plate-${String(sheetNumber).padStart(2, "0")}.dxf`;
