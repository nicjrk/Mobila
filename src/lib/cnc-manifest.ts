import type { CncCutlist, CncPart, NestedPart } from "@/lib/cnc";

const csvCell = (value: string | number | boolean | null | undefined) => {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
};

const nestedByPartId = (cutlist: CncCutlist) => {
  const result = new Map<string, NestedPart>();
  cutlist.sheets.forEach((sheet) => sheet.parts.forEach((item) => result.set(item.id, item)));
  return result;
};

function row(projectName: string, item: CncPart, nested: NestedPart | undefined) {
  const placedWidth = nested ? (nested.rotated ? item.height : item.width) : "";
  const placedHeight = nested ? (nested.rotated ? item.width : item.height) : "";
  const edgeBand = item.edgeBand
    ? `${item.edgeBand.sides.join("+")} @ ${item.edgeBand.thickness.toFixed(1)} mm`
    : "";
  const operations = (item.operations ?? [])
    .map((operation) => operation.kind)
    .reduce((counts, kind) => ({ ...counts, [kind]: (counts[kind] ?? 0) + 1 }), {} as Record<string, number>);
  const operationSummary = Object.entries(operations)
    .map(([kind, count]) => `${kind}:${count}`)
    .join(" ");
  return [
    projectName,
    nested?.sheet ?? "",
    item.cabinet,
    item.id,
    item.label,
    item.width.toFixed(1),
    item.height.toFixed(1),
    item.thickness.toFixed(1),
    item.grain,
    item.kind ?? "",
    item.material ?? "",
    edgeBand,
    operationSummary,
    nested?.x.toFixed(1) ?? "",
    nested?.y.toFixed(1) ?? "",
    placedWidth === "" ? "" : Number(placedWidth).toFixed(1),
    placedHeight === "" ? "" : Number(placedHeight).toFixed(1),
    nested?.rotated ? "yes" : nested ? "no" : "",
    nested ? "NESTED" : item.cnc ? "OVERSIZED / NOT NESTED" : "NON-CNC / SUPPLIED SEPARATELY",
    item.note ?? "",
  ]
    .map(csvCell)
    .join(",");
}

/**
 * Creates a production manifest beside the DXF files. Aspire does not use
 * this as toolpath code; it is the traceability map used to verify imported
 * vectors against the correct plate, cabinet and part.
 */
export function createCncManifestCsv(cutlist: CncCutlist, projectName = "Project") {
  const nested = nestedByPartId(cutlist);
  const headers = [
    "project",
    "plate",
    "cabinet",
    "part_id",
    "part_label",
    "design_width_mm",
    "design_height_mm",
    "thickness_mm",
    "grain",
    "component_kind",
    "material",
    "edge_band",
    "operations",
    "x_mm",
    "y_mm",
    "placed_width_mm",
    "placed_height_mm",
    "rotated",
    "nesting_status",
    "note",
  ];
  const rows = cutlist.parts.map((item) => row(projectName, item, nested.get(item.id)));
  return `\ufeff${headers.map(csvCell).join(",")}\n${rows.join("\n")}\n`;
}
