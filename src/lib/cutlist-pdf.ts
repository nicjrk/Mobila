import type { CncCutlist } from "@/lib/cnc";

const esc = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export function createCutlistPdfHtml(cutlist: CncCutlist, projectName = "Project"): string {
  const sheets = cutlist.sheets
    .map((sheet) => {
      const scale = Math.min(0.25, 260 / sheet.width, 170 / sheet.height);
      const cabinets = [...new Set(sheet.parts.map((item) => item.cabinet))].join(" · ");
      const parts = sheet.parts
        .map((item) => {
          const width = item.rotated ? item.height : item.width;
          const height = item.rotated ? item.width : item.height;
          const label = `${item.cabinet} · ${item.label} · ${width.toFixed(1)} × ${height.toFixed(1)} × ${item.thickness.toFixed(1)} mm`;
          const textRotation = height > width * 2 ? "rotate(90deg)" : "rotate(0deg)";
          return `<div class="part" style="left:${item.x * scale}mm;top:${(sheet.height - item.y - height) * scale}mm;width:${width * scale}mm;height:${height * scale}mm"><span style="transform:${textRotation}">${esc(label)}</span></div>`;
        })
        .join("");
      return `<section class="sheet"><h2>Sheet ${sheet.number}</h2><p>Cabinets: ${esc(cabinets || "Unassigned")}<br>${sheet.width} × ${sheet.height} mm · panel ${cutlist.settings.panelThickness} mm · back ${cutlist.settings.backThickness} mm · kerf ${cutlist.settings.kerf} mm</p><div class="sheet-map" style="width:${sheet.width * scale}mm;height:${sheet.height * scale}mm">${parts}</div></section>`;
    })
    .join("");
  const grouped = new Map<
    string,
    { label: string; width: number; height: number; thickness: number; qty: number; note?: string }
  >();
  cutlist.parts.forEach((item) => {
    const key = `${item.cabinet}|${item.label}|${item.width}|${item.height}|${item.thickness}`;
    const current = grouped.get(key);
    if (current) current.qty += 1;
    else
      grouped.set(key, {
        label: `${item.cabinet} · ${item.label}`,
        width: item.width,
        height: item.height,
        thickness: item.thickness,
        qty: 1,
        ...(item.note ? { note: item.note } : {}),
      });
  });
  const rows = [...grouped.values()]
    .map(
      (item) =>
        `<tr><td>${esc(item.label)}${item.note ? `<small>${esc(item.note)}</small>` : ""}</td><td>${item.width.toFixed(1)}</td><td>${item.height.toFixed(1)}</td><td>${item.thickness.toFixed(1)}</td><td>${item.qty}</td></tr>`,
    )
    .join("");
  const unsupported = cutlist.unsupported.length
    ? `<section class="warning"><h2>Manual manufacturing review required</h2>${cutlist.unsupported.map((item) => `<p><strong>${esc(item.label)}</strong> — ${esc(item.reason)}</p>`).join("")}</section>`
    : "";
  const camReview = cutlist.camReviewReasons.length
    ? `<section class="warning"><h2>Verificare CAM înainte de prelucrare / Pre-CAM review</h2>${cutlist.camReviewReasons.map((reason) => `<p>${esc(reason.ro)}<small>${esc(reason.en)}</small></p>`).join("")}</section>`
    : "";
  return `<!doctype html><html><head><title>${esc(projectName)} cut list</title><style>@page{size:A4 landscape;margin:10mm}body{font:10px Arial;color:#303632}h1{margin:0 0 4px}.sheet{break-after:page}.sheet:last-of-type{break-after:auto}.sheet-map{position:relative;border:1px solid #555;background:#fafafa}.part{position:absolute;border:0.3px solid #555;box-sizing:border-box;display:flex;align-items:center;justify-content:center;overflow:hidden;text-align:center;font-size:6px}.part span{transform:rotate(0deg);word-break:break-word}table{width:100%;border-collapse:collapse;margin-top:8mm}th,td{border-bottom:1px solid #ccc;padding:3px;text-align:left}small{display:block;color:#8b5c1d}.warning{border:1px solid #b45309;background:#fff7ed;padding:5mm;margin-top:8mm;break-inside:avoid}</style></head><body><h1>${esc(projectName)} · CNC panels</h1>${sheets}${unsupported}${camReview}<section><h2>Aggregated cut list</h2><p>${cutlist.parts.length} parts · ${cutlist.sheets.length} sheets · ${cutlist.totalAreaM2.toFixed(2)} m² · joinery compensated for ${cutlist.settings.panelThickness} mm board</p><table><thead><tr><th>Part</th><th>Width mm</th><th>Height mm</th><th>Thk mm</th><th>Qty</th></tr></thead><tbody>${rows}</tbody></table></section></body></html>`;
}
