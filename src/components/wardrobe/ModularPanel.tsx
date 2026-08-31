import { useState } from "react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  FINISHES,
  DOOR_MATERIALS,
  DOOR_STYLES,
  HANDLE_SIDES,
  HANDLE_ALIGNS,
  HANDLE_POSITIONS,
  HANDLE_STYLES,
  PRIMARY_WORKSPACES,
  UNIT_FRONTS,
  UNIT_LIMITS,
  UNIT_MOUNTS,
  ITEM_META,
  applianceModuleSpec,
  enterModular,
  enterUnderStairs,
  newId,
  leafCount,
  sectionKey,
  sectionSpec,
  newUnit,
  unitPrice,
  type Config,
  type DoorMaterial,
  type ItemType,
  type DoorStyle,
  type HandlePos,
  type HandleStyle,
  type LeafSpec,
  type Unit,
  type UnitMount,
} from "@/lib/wardrobe";
import { APPLIANCE_TYPES } from "@/lib/wardrobe";
import type { ApplianceType, FittingType } from "@/lib/wardrobe";
import { CATALOG, type CatalogProduct } from "@/lib/catalog";
import { alignToWall, nextUnitX, previousUnitX, snapUnitToRoom } from "@/lib/units";
import type { ValidationIssue } from "@/lib/validation";
import { buildCncCutlist, cncSettings, validateCncCutlist } from "@/lib/cnc";
import { createDxf, dxfFileName, dxfSheetFileName } from "@/lib/dxf";
import { createCncManifestCsv } from "@/lib/cnc-manifest";
import { createCutlistPdfHtml } from "@/lib/cutlist-pdf";
import { downloadBlob } from "@/lib/download";
import {
  addFitting,
  fittingsOf,
  innerBase,
  moveFitting,
  reflowFittings,
  removeFitting,
} from "@/lib/fittings";
import InteriorEquipment from "@/components/wardrobe/InteriorEquipment";
import {
  PRESET_CATEGORIES,
  KITCHEN_LAYOUT_PRESETS,
  unitFromPreset,
  type CabinetPreset,
  type KitchenLayoutPreset,
  type PresetCategory,
  type SavedKitchenLayout,
} from "@/lib/presets";
import {
  AlignVerticalJustifyStart,
  Boxes,
  Copy,
  Layers,
  Library,
  Lock,
  Magnet,
  Palette,
  Plus,
  Rows3,
  Sparkles,
  SquareStack,
  Trash2,
  RotateCw,
} from "lucide-react";

/** Free-typed height in cm from the cabinet base — no leading zeros, commits on Enter/blur. */
function HeightField({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);
  const commit = () => {
    if (draft === null) return;
    const n = parseFloat(draft.replace(",", "."));
    setDraft(null);
    if (Number.isFinite(n)) onCommit(n);
  };
  return (
    <span className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5">
      <input
        value={shown}
        inputMode="decimal"
        aria-label="Height from base in cm"
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.,]/g, "");
          setDraft(raw.replace(/^0+(?=\d)/, ""));
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
        className="w-10 bg-transparent text-right text-[11px] tabular-nums text-foreground outline-none"
      />
      <span className="text-[10px] text-muted-foreground">cm</span>
    </span>
  );
}

function Row({
  label,
  value,
  min,
  max,
  onChange,
  unit = "cm",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {value}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={(v) => onChange(v[0] ?? value)}
      />
    </div>
  );
}

function KitchenLayoutPreview({
  layout,
  large = false,
}: {
  layout: KitchenLayoutPreset;
  large?: boolean;
}) {
  const width = large ? 300 : 190;
  const height = large ? 150 : 92;
  const roomWidth = layout.room?.width ?? 800;
  const roomDepth = layout.room?.depth ?? 600;
  const scaleX = width / roomWidth;
  const scaleZ = height / roomDepth;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-[#f7f4ef] p-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full"
        role="img"
        aria-label={`${layout.name} preview`}
      >
        <rect width={width} height={height} fill="#f7f4ef" />
        <path
          d={`M ${8} ${8} H ${width - 8} V ${height - 8} H 8 Z`}
          fill="none"
          stroke="#c8c0b5"
          strokeWidth="2"
        />
        <path
          d={`M 14 ${14} H ${width - 30} M 14 ${14} V ${height - 28}`}
          stroke="#6f927a"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.65"
        />
        {layout.units.map((unit, index) => {
          const rotated = Math.abs(Math.round((unit.rot ?? 0) / 90)) % 2 === 1;
          const w = (rotated ? (unit.d ?? 60) : (unit.w ?? 60)) * scaleX;
          const d = (rotated ? (unit.w ?? 60) : (unit.d ?? 60)) * scaleZ;
          const x = width / 2 + (unit.x ?? 0) * scaleX - w / 2;
          const z = 14 + (unit.z ?? 0) * scaleZ - d / 2;
          const applianceTypes = (unit.appliances ?? []).map((item) => item.type);
          const color = applianceTypes.includes("sink")
            ? "#6f9c82"
            : applianceTypes.includes("hob")
              ? "#b88d66"
              : applianceTypes.includes("fridge")
                ? "#7d8e9d"
                : unit.front === "drawers"
                  ? "#ad947d"
                  : unit.mount === "wall"
                    ? "#d2c4b1"
                    : "#c7b9a8";
          return (
            <rect
              key={`${layout.id}-${index}`}
              x={Math.max(1, x)}
              y={Math.max(1, z)}
              width={Math.max(3, w)}
              height={Math.max(3, d)}
              rx="1.5"
              fill={color}
              stroke="#655c53"
              strokeWidth="0.8"
            />
          );
        })}
      </svg>
    </div>
  );
}

function CabinetCatalogPreview({ product }: { product: CatalogProduct }) {
  const height = product.dimensions?.height ?? 200;
  const width = product.dimensions?.width ?? 60;
  const tall = product.sku.includes("TALL") || height > 190;
  const wall = product.sku.includes("WALL");
  const role = product.technicalMetadata?.["kitchenRole"];
  return (
    <div className="flex h-12 items-end justify-center rounded-lg border border-border/70 bg-[#f7f4ef] p-1">
      <div
        className={`relative w-7 rounded-[3px] border border-[#766c62]/60 ${wall ? "bg-[#d9cdbd]" : "bg-[#cfc4b4]"}`}
        style={{ height: `${Math.max(16, Math.min(40, (height / Math.max(1, width)) * 10))}px` }}
      >
        <span className="absolute top-1/2 left-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8b8178]" />
        {tall && <span className="absolute inset-x-0 top-1/2 border-t border-[#766c62]/50" />}
        {role === "sink" && (
          <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#657174]" />
        )}
        {role === "hob" && (
          <span className="absolute inset-x-1 top-1/2 border-t-2 border-[#303437]" />
        )}
        {role === "dishwasher" && (
          <span className="absolute inset-x-1 bottom-1 border-t-2 border-[#657174]" />
        )}
        {role === "corner" && (
          <span className="absolute inset-y-1 left-1/2 border-l border-[#766c62]/70" />
        )}
      </div>
    </div>
  );
}

export default function ModularPanel({
  config,
  projectName,
  setConfig,
  selectedId,
  setSelectedId,
  selectedUnitIds,
  setSelectedUnitIds,
  validationIssues,
  presets,
  onRemovePreset,
  savedKitchenLayouts,
  onSaveKitchenLayout,
  onRemoveKitchenLayout,
  onDuplicate,
  editInterior,
  onToggleEditInterior,
  selectedFitting,
  onSelectFitting,
}: {
  config: Config;
  projectName: string;
  setConfig: (fn: (c: Config) => Config) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  selectedUnitIds: string[];
  setSelectedUnitIds: (ids: string[]) => void;
  validationIssues: ValidationIssue[];
  presets: CabinetPreset[];
  onRemovePreset: (id: string) => void;
  savedKitchenLayouts: SavedKitchenLayout[];
  onSaveKitchenLayout: (name: string) => void;
  onRemoveKitchenLayout: (id: string) => void;
  onDuplicate: (id: string) => void;
  editInterior: boolean;
  onToggleEditInterior: () => void;
  selectedFitting: string | null;
  onSelectFitting: (id: string | null) => void;
}) {
  const units = config.units;
  const sel = units.find((u) => u.id === selectedId) ?? units[0] ?? null;
  const toggleUnitSelection = (id: string) =>
    setSelectedUnitIds(
      selectedUnitIds.includes(id)
        ? selectedUnitIds.filter((candidate) => candidate !== id)
        : [...selectedUnitIds, id],
    );
  const deleteSelectedUnits = () => {
    if (!selectedUnitIds.length) return;
    setConfig((c) => ({ ...c, units: c.units.filter((u) => !selectedUnitIds.includes(u.id)) }));
    setSelectedUnitIds([]);
    setSelectedId(null);
    toast.success("Selected cabinets removed");
  };
  const duplicateSelectedUnits = () => {
    if (!selectedUnitIds.length) return;
    const created: string[] = [];
    setConfig((c) => {
      const additions = c.units
        .filter((u) => selectedUnitIds.includes(u.id))
        .map((u) => {
          const copy = newUnit({ ...u, id: newId(), x: u.x + 20, z: u.z + 20 });
          created.push(copy.id);
          return copy;
        });
      return {
        ...c,
        units: additions.reduce(
          (placed, unit) => [...placed, snapUnitToRoom(unit, placed, c.modularRoom)],
          [...c.units] as Unit[],
        ),
      };
    });
    setSelectedUnitIds(created);
    if (created[0]) setSelectedId(created[0]);
    toast.success("Selected cabinets duplicated");
  };
  const nudgeSelectedUnits = (dx: number) => {
    if (!selectedUnitIds.length) return;
    setConfig((c) => ({
      ...c,
      units: c.units.reduce((placed, unit) => {
        const moved = selectedUnitIds.includes(unit.id) ? { ...unit, x: unit.x + dx } : unit;
        return [...placed, snapUnitToRoom(moved, placed, c.modularRoom)];
      }, [] as Unit[]),
    }));
  };
  /** Which individual door leaf is being customized. */
  const [leafSel, setLeafSel] = useState<{ unitId: string; leaf: number; section: number } | null>(
    null,
  );
  const [step, setStep] = useState<"layout" | "modules" | "finishes">("layout");
  const [catalogFilter, setCatalogFilter] = useState<
    "all" | "base" | "wall" | "tall" | "stairs" | "kitchen"
  >("all");

  /** Every door leaf in the scene, numbered left-to-right as listed. */
  const doorList = units.flatMap((u, ui) =>
    Array.from({ length: leafCount(u) }, (_, li) =>
      Array.from({ length: Math.max(1, Math.min(3, u.frontSections ?? 1)) }, (_, section) => ({
        u,
        ui,
        li,
        section,
      })),
    ).flat(),
  );
  const leafUnit = leafSel ? (units.find((u) => u.id === leafSel.unitId) ?? null) : null;
  const leaf = leafUnit && leafSel ? sectionSpec(leafUnit, leafSel.leaf, leafSel.section) : null;

  const patchLeaf = (p: Partial<LeafSpec>) => {
    if (!leafSel) return;
    const key =
      leafSel.section === 0 ? String(leafSel.leaf) : sectionKey(leafSel.leaf, leafSel.section);
    setConfig((c) => ({
      ...c,
      units: c.units.map((u) =>
        u.id === leafSel.unitId
          ? { ...u, leaves: { ...(u.leaves ?? {}), [key]: { ...(u.leaves?.[key] ?? {}), ...p } } }
          : u,
      ),
    }));
  };

  const patch = (id: string, p: Partial<Unit>) =>
    setConfig((c) => ({ ...c, units: c.units.map((u) => (u.id === id ? { ...u, ...p } : u)) }));

  /** Resize the carcase and re-seat the fittings so nothing ends up outside it. */
  const resize = (id: string, p: Partial<Unit>) =>
    setConfig((c) => ({
      ...c,
      units: c.units.map((u) => (u.id === id ? reflowFittings({ ...u, ...p }) : u)),
    }));

  const mapUnit = (id: string, fn: (u: Unit) => Unit) =>
    setConfig((c) => ({ ...c, units: c.units.map((u) => (u.id === id ? fn(u) : u)) }));

  const addUnit = (side: "left" | "right" = "right") => {
    const createdId = newId();
    setConfig((c) => {
      const u = newUnit({
        id: createdId,
        finish: c.finish,
        x: side === "left" ? previousUnitX(c.units, 60) : nextUnitX(c.units, 60),
        z: c.units[0]?.z ?? 0,
      });
      return { ...c, units: [...c.units, snapUnitToRoom(u, c.units, c.modularRoom)] };
    });
    setSelectedId(createdId);
    toast.success(`Cabinet added to the ${side}`);
  };

  const addCatalogCabinet = (product: CatalogProduct) => {
    const dimensions = product.dimensions ?? {};
    const createdId = newId();
    setConfig((c) => {
      const height = dimensions.height ?? 200;
      const role = product.technicalMetadata?.["kitchenRole"];
      const unit = newUnit({
        id: createdId,
        x: nextUnitX(c.units, dimensions.width ?? 60),
        z: c.units[0]?.z ?? 0,
        w: dimensions.width ?? 60,
        h: height,
        d: dimensions.depth ?? 60,
        mount: product.sku.includes("WALL") ? "wall" : "base",
        ...(role === "sink" || role === "hob" || role === "dishwasher" || role === "ovenTower"
          ? { front: "door" as const }
          : {}),
        countertop: role === "sink" || role === "hob" || role === "dishwasher",
        faucet: role === "sink",
        appliances:
          role === "sink"
            ? [{ id: newId(), type: "sink" as const, x: 0, y: 4 }]
            : role === "hob"
              ? [
                  { id: newId(), type: "oven" as const, x: 0, y: 4 },
                  { id: newId(), type: "hob" as const, x: 0, y: 4 },
                ]
              : role === "dishwasher"
                ? [{ id: newId(), type: "dishwasher" as const, x: 0, y: 4 }]
                : role === "ovenTower"
                  ? [{ id: newId(), type: "oven" as const, x: 0, y: 4 }]
                  : [],
        underStairs: product.sku.includes("STAIRS"),
        ...(product.sku.includes("STAIRS")
          ? { slopeMinHeight: Math.max(40, Math.round(height * 0.55)) }
          : {}),
      });
      return { ...c, units: [...c.units, snapUnitToRoom(unit, c.units, c.modularRoom)] };
    });
    setSelectedId(createdId);
    toast.success(`${product.name} added`);
  };

  const addKitchenModule = (
    kind: "sink" | "hob" | "wall" | "fridge" | "dishwasher" | "drawers",
  ) => {
    const createdId = newId();
    setConfig((c) => {
      const base = {
        finish: c.finish,
        w: 60,
        h: kind === "wall" ? 80 : kind === "fridge" ? 220 : 80,
        d: kind === "wall" ? 35 : 60,
        mount: kind === "wall" ? ("wall" as const) : ("base" as const),
        countertop: kind !== "wall" && kind !== "fridge",
        countertopMaterial: "stone" as const,
        faucet: kind === "sink",
        front: kind === "drawers" ? ("drawers" as const) : ("door" as const),
        drawers: kind === "drawers" ? 3 : 0,
        appliances:
          kind === "sink"
            ? [{ id: newId(), type: "sink" as const, y: 4 }]
            : kind === "hob"
              ? [
                  { id: newId(), type: "oven" as const, y: 4 },
                  { id: newId(), type: "hob" as const, y: 4 },
                ]
              : kind === "fridge"
                ? [{ id: newId(), type: "fridge" as const, y: 4 }]
                : kind === "dishwasher"
                  ? [{ id: newId(), type: "dishwasher" as const, y: 4 }]
                  : [],
      };
      const unit = newUnit({
        ...base,
        id: createdId,
        x: nextUnitX(c.units, base.w),
        z: c.units[0]?.z ?? 0,
      });
      return { ...c, units: [...c.units, snapUnitToRoom(unit, c.units, c.modularRoom)] };
    });
    setSelectedId(createdId);
    toast.success("Kitchen module added");
  };

  const removeUnit = (id: string) =>
    setConfig((c) => ({ ...c, units: c.units.filter((u) => u.id !== id) }));

  const addFromPreset = (p: CabinetPreset) => {
    setConfig((c) => {
      const u = unitFromPreset(p, nextUnitX(c.units, p.unit.w), c.units[0]?.z ?? 0);
      return { ...c, units: [...c.units, snapUnitToRoom(u, c.units, c.modularRoom)] };
    });
  };

  const addKitchenLayout = (
    layout: (typeof KITCHEN_LAYOUT_PRESETS)[number],
    mode: "replace" | "append" = "replace",
  ) => {
    let firstId = "";
    setConfig((c) => {
      const created = layout.units.map((item, index) => {
        const unit = newUnit({
          finish: c.finish,
          ...item,
          id: newId(),
          ...(item.appliances
            ? { appliances: item.appliances.map((appliance) => ({ ...appliance, id: newId() })) }
            : {}),
        });
        if (index === 0) firstId = unit.id;
        return unit;
      });
      const room =
        mode === "replace" && layout.room ? { ...c.modularRoom, ...layout.room } : c.modularRoom;
      return {
        ...c,
        ...(mode === "replace" && layout.room ? { modularRoom: room } : {}),
        units: created.reduce((all, unit) => [...all, snapUnitToRoom(unit, all, room)], [
          ...(mode === "append" ? c.units : []),
        ] as Unit[]),
      };
    });
    setSelectedId(firstId);
    toast.success(`${layout.name} added`);
  };

  const addSavedKitchenLayout = (layout: SavedKitchenLayout, mode: "replace" | "append") => {
    if (mode === "replace" && layout.config) {
      setConfig(() => JSON.parse(JSON.stringify(layout.config)) as Config);
      setSelectedId(layout.config.units[0]?.id ?? null);
      setSelectedUnitIds([]);
      toast.success(`${layout.name} restored`);
      return;
    }
    addKitchenLayout(
      {
        id: layout.id,
        name: layout.name,
        description: "Saved kitchen layout",
        units: layout.units,
      },
      mode,
    );
  };

  const autoPlaceAll = () => {
    setConfig((c) => ({
      ...c,
      units: c.units.reduce(
        (placed, unit) => [...placed, snapUnitToRoom(unit, placed, c.modularRoom)],
        [] as Unit[],
      ),
    }));
    toast.success("All cabinets aligned to the room walls");
  };

  const applyMount = (u: Unit, mount: UnitMount) => {
    const m = UNIT_MOUNTS.find((x) => x.id === mount)!;
    patch(u.id, { mount, y: m.y, h: m.h ?? u.h });
  };

  const addApplianceModule = (type: ApplianceType) => {
    const createdId = newId();
    const spec = applianceModuleSpec(type);
    setConfig((c) => {
      const maxUnitHeight = Math.max(40, c.modularRoom.height - spec.y);
      const unitHeight = Math.min(spec.h, maxUnitHeight);
      const unitY = Math.min(spec.y, Math.max(0, c.modularRoom.height - unitHeight));
      const unit = newUnit({
        id: createdId,
        name: spec.label,
        x: nextUnitX(c.units, spec.w),
        z: c.units[0]?.z ?? 30,
        w: spec.w,
        h: unitHeight,
        d: spec.d,
        y: unitY,
        mount: spec.mount,
        front: spec.front,
        countertop: spec.countertop,
        countertopMaterial: spec.countertopMaterial,
        faucet: spec.faucet,
        appliances: spec.applianceTypes.map((applianceType) => ({
          id: newId(),
          type: applianceType,
          x: 0,
          y: 4,
        })),
      });
      return { ...c, units: [...c.units, snapUnitToRoom(unit, c.units, c.modularRoom)] };
    });
    setSelectedId(createdId);
    toast.success(`${spec.label} added with wooden housing`);
  };

  const cnc = cncSettings(config);
  const cutlist = buildCncCutlist(config);
  const cncIssues = validateCncCutlist(cutlist);
  const cncErrors = cncIssues.filter((issue) => issue.severity === "error");
  const cncReady = cncErrors.length === 0 && cutlist.oversized.length === 0;
  const canExportCnc = () => {
    if (cncReady) return true;
    toast.error("Export CNC blocat / CNC export blocked", {
      description:
        cutlist.oversized.length > 0
          ? "RO: Împarte piesele prea mari sau alege o placă suficient de mare. / EN: Split the oversized parts or choose a sheet that can contain them."
          : "RO: Corectează erorile de geometrie înainte de trimiterea la utilaj. / EN: Fix the CNC geometry errors before sending the file to the machine.",
    });
    return false;
  };
  const oversizedCopy = (item: (typeof cutlist.oversized)[number]) => {
    const usableWidth = cnc.sheetWidth - 2 * cnc.sheetMargin;
    const usableHeight = cnc.sheetHeight - 2 * cnc.sheetMargin;
    const canOnlyFitByRotation =
      item.grain !== "none" && item.height <= usableWidth && item.width <= usableHeight;
    return canOnlyFitByRotation
      ? {
          ro: "Fibra este fixă, iar piesa ar încăpea doar dacă ar fi rotită. Schimbă direcția de debitare sau împarte piesa.",
          en: "The grain direction is fixed and this part would fit only if rotated. Change the cutting direction or split the part.",
        }
      : {
          ro: `Piesa depășește placa utilă de ${usableWidth.toFixed(0)} × ${usableHeight.toFixed(0)} mm. Împarte piesa sau alege o placă mai mare.`,
          en: `The part exceeds the usable sheet area of ${usableWidth.toFixed(0)} × ${usableHeight.toFixed(0)} mm. Split it or choose a larger sheet.`,
        };
  };
  const patchCnc = (key: keyof typeof cnc, value: number) =>
    setConfig((c) => ({ ...c, cnc: { ...cncSettings(c), [key]: value } }));
  const downloadCnc = () => {
    if (!canExportCnc()) return;
    const name = projectName.trim() || "Project";
    downloadBlob(
      new Blob([createDxf(cutlist, name)], { type: "application/dxf" }),
      dxfFileName(name),
    );
  };
  const downloadCncSheets = () => {
    if (!canExportCnc()) return;
    const name = projectName.trim() || "Project";
    cutlist.sheets.forEach((sheet, index) => {
      window.setTimeout(() => {
        const singleSheetCutlist = { ...cutlist, sheets: [sheet] };
        downloadBlob(
          new Blob([createDxf(singleSheetCutlist, name, [sheet])], { type: "application/dxf" }),
          dxfSheetFileName(name, sheet.number),
        );
      }, index * 180);
    });
    toast.success(`${cutlist.sheets.length} individual CNC plate file(s) queued`);
  };
  const printCncPdf = () => {
    const report = window.open("", "_blank", "noopener,noreferrer,width=1200,height=900");
    if (!report) return;
    report.document.write(createCutlistPdfHtml(cutlist, projectName.trim() || "Project"));
    report.document.close();
    report.focus();
    report.setTimeout(() => report.print(), 300);
  };
  const downloadCncManifest = () => {
    if (!cutlist.parts.length) {
      toast.error("Nu există piese CNC / No CNC parts", {
        description: "Adaugă cel puțin un dulap cu panouri înainte de export.",
      });
      return;
    }
    const name = projectName.trim() || "Project";
    downloadBlob(
      new Blob([createCncManifestCsv(cutlist, name)], { type: "text/csv;charset=utf-8" }),
      `${name.replace(/[^a-z0-9-_]+/gi, "_") || "project"}-cnc-manifest.csv`,
    );
    toast.success("Manifestul CNC a fost exportat / CNC manifest exported", {
      description: "Folosește-l pentru verificarea pieselor după importul DXF în Aspire.",
    });
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      {sel && (
        <div className="sticky top-0 z-10 rounded-2xl border border-primary/30 bg-accent/95 px-3 py-2.5 shadow-sm backdrop-blur">
          <div className="label-eyebrow">Active cabinet</div>
          <div className="text-sm font-semibold text-foreground">
            Editing: {sel.name ?? `Unit ${units.findIndex((u) => u.id === sel.id) + 1}`} ({sel.w} ×{" "}
            {sel.h} cm)
          </div>
        </div>
      )}
      {validationIssues.length > 0 && (
        <div className="rounded-2xl border border-amber-300/70 bg-amber-50/80 p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-amber-900">Layout check</span>
            <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
              {validationIssues.length} issue{validationIssues.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-1.5 space-y-1">
            {validationIssues.slice(0, 3).map((issue) => (
              <div
                key={issue.id}
                className={`text-[11px] ${issue.severity === "error" ? "font-medium text-red-700" : "text-amber-800"}`}
              >
                {issue.severity === "error" ? "●" : "▲"} {issue.message}
              </div>
            ))}
            {validationIssues.length > 3 && (
              <div className="text-[10px] text-amber-700">+{validationIssues.length - 3} more</div>
            )}
          </div>
        </div>
      )}
      <div className="rounded-2xl border border-border bg-card p-2 shadow-sm">
        <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Modular Assembly workspace
        </div>
        <nav aria-label="Planner workspace sections" className="grid grid-cols-3 gap-1">
          {(
            [
              ["layout", "1", "Room"],
              ["modules", "2", "Cabinets"],
              ["finishes", "3", "Fronts & equipment"],
            ] as const
          ).map(([id, number, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setStep(id)}
              className={`rounded-xl px-2 py-2 text-[11px] font-medium transition-colors ${step === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
            >
              <span className="mr-1.5 opacity-70">{number}</span>
              {label}
            </button>
          ))}
        </nav>
      </div>
      <Accordion
        type="multiple"
        defaultValue={["layout", "modules", "config"]}
        className="space-y-3"
      >
        <AccordionItem
          value="layout"
          className={`panel-card border-none px-4 ${step !== "layout" ? "hidden" : ""}`}
        >
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <span className="label-eyebrow">Layout &amp; Room</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="grid grid-cols-2 gap-2 pb-4">
            {PRIMARY_WORKSPACES.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  setConfig((c) => (o.id === "modular" ? enterModular(c) : enterUnderStairs(c)));
                  setSelectedId(null);
                }}
                className={`rounded-xl border p-2.5 text-left transition-all ${
                  config.roomShape === o.id
                    ? "border-primary bg-accent shadow-sm"
                    : "border-border hover:bg-secondary"
                }`}
              >
                <div className="text-sm font-medium text-foreground">{o.name}</div>
                <div className="text-[11px] text-muted-foreground">{o.desc}</div>
              </button>
            ))}
            {config.roomShape === "modular" && (
              <div className="col-span-2 rounded-xl border border-primary/20 bg-accent/40 p-3">
                <div className="text-xs font-semibold text-foreground">Smart room</div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Room size, camera framing and wall placement are handled automatically. Add a
                  cabinet and it is placed on the nearest available wall without overlapping the
                  existing furniture.
                </p>
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-background/70 px-2.5 py-2">
                  <span className="text-xs font-medium text-foreground">Show measurements</span>
                  <Switch
                    checked={config.showDimensions}
                    onCheckedChange={(value) => setConfig((c) => ({ ...c, showDimensions: value }))}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-background/70 px-2.5 py-2">
                  <span className="text-xs font-medium text-foreground">Open drawers</span>
                  <Switch
                    checked={config.openDrawers ?? false}
                    onCheckedChange={(value) => setConfig((c) => ({ ...c, openDrawers: value }))}
                  />
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="modules"
          className={`panel-card border-none px-4 ${step !== "modules" ? "hidden" : ""}`}
        >
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2">
              <Boxes className="size-4 text-primary" />
              <span className="label-eyebrow">Cabinets &amp; Modules</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <div className="grid grid-cols-2 gap-2">
              <Button className="gap-2 rounded-xl" onClick={() => addUnit("left")}>
                <Plus className="size-4" />
                Add left
              </Button>
              <Button className="gap-2 rounded-xl" onClick={() => addUnit("right")}>
                <Plus className="size-4" />
                Add right
              </Button>
            </div>
            <div className="rounded-xl border border-primary/20 bg-accent/35 p-3">
              <div className="mb-2 text-xs font-semibold text-foreground">
                Quick kitchen modules
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["sink", "Base + sink"],
                    ["hob", "Base + hob"],
                    ["drawers", "Drawer base"],
                    ["dishwasher", "Dishwasher base"],
                    ["wall", "Wall cabinet"],
                    ["fridge", "Fridge tower"],
                  ] as const
                ).map(([kind, label]) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => addKitchenModule(kind)}
                    className="rounded-lg border border-border bg-background px-2 py-2 text-left text-[11px] font-medium text-foreground transition-colors hover:border-primary hover:bg-accent"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Each module is placed on the nearest room wall automatically.
              </p>
              <div className="mt-3 border-t border-primary/15 pt-3">
                <div className="mb-2 text-[11px] font-semibold text-foreground">
                  Individual appliance modules
                </div>
                <p className="mb-2 text-[10px] leading-relaxed text-muted-foreground">
                  Every appliance gets a wooden carcass, so it can be moved, rotated and exported to
                  CNC like a cabinet. Oven adds its hob on the same worktop.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["fridge", "Fridge tower"],
                      ["oven", "Oven + hob"],
                      ["microwave", "Microwave wall"],
                      ["washer", "Washing machine"],
                      ["dishwasher", "Dishwasher"],
                      ["sink", "Sink base"],
                      ["hob", "Hob base"],
                      ["extractor", "Extractor wall"],
                    ] as const
                  ).map(([type, label]) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addApplianceModule(type)}
                      className="rounded-lg border border-border bg-background px-2 py-2 text-left text-[11px] font-medium text-foreground transition-colors hover:border-primary hover:bg-accent"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2 rounded-xl"
              onClick={() => sel && onDuplicate(sel.id)}
              disabled={!sel}
            >
              <Copy className="size-4" />
              Duplicate selected
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2 rounded-xl"
              onClick={autoPlaceAll}
              disabled={units.length === 0}
            >
              <AlignVerticalJustifyStart className="size-4" />
              Snap & fix layout
            </Button>
            <div className="rounded-xl border border-border bg-card/60 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Library className="size-4 text-primary" />
                <span className="label-eyebrow">Catalog</span>
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {(
                  [
                    ["all", "All"],
                    ["base", "Base"],
                    ["wall", "Wall"],
                    ["tall", "Tall"],
                    ["stairs", "Under stairs"],
                    ["kitchen", "Kitchen"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCatalogFilter(id)}
                    className={`rounded-full border px-2 py-1 text-[10px] transition-colors ${
                      catalogFilter === id
                        ? "border-primary bg-primary/10 font-medium text-foreground"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CATALOG.filter((product) => {
                  if (!product.sku.startsWith("WW-CAB-")) return false;
                  if (catalogFilter === "all") return true;
                  if (catalogFilter === "base") return product.sku.includes("BASE");
                  if (catalogFilter === "wall") return product.sku.includes("WALL");
                  if (catalogFilter === "tall") return product.sku.includes("TALL");
                  if (catalogFilter === "stairs") return product.sku.includes("STAIRS");
                  return !!product.technicalMetadata?.["kitchenRole"];
                }).map((product) => (
                  <button
                    key={product.sku}
                    type="button"
                    onClick={() => addCatalogCabinet(product)}
                    className="rounded-lg border border-border bg-background px-2 py-2 text-left transition-colors hover:border-primary hover:bg-accent"
                  >
                    <CabinetCatalogPreview product={product} />
                    <span className="block text-xs font-medium text-foreground">
                      {product.name}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {product.dimensions?.width} × {product.dimensions?.height} ×{" "}
                      {product.dimensions?.depth} cm · €{product.unitPrice}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Drag a unit on the floor — side panels snap magnetically to the neighbouring cabinet.
            </p>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-dashed border-primary/30 bg-accent/30 p-2">
                <span className="mr-auto text-[11px] font-medium text-foreground">
                  Multi-select · {selectedUnitIds.length}
                </span>
                <button
                  className="rounded-md border border-border px-2 py-1 text-[10px] hover:bg-secondary"
                  onClick={() => setSelectedUnitIds(units.map((u) => u.id))}
                >
                  All
                </button>
                <button
                  className="rounded-md border border-border px-2 py-1 text-[10px] hover:bg-secondary"
                  onClick={() => setSelectedUnitIds([])}
                >
                  Clear
                </button>
                <button
                  className="rounded-md border border-border px-2 py-1 text-[10px] hover:bg-secondary"
                  disabled={!selectedUnitIds.length}
                  onClick={() => nudgeSelectedUnits(-10)}
                >
                  ←
                </button>
                <button
                  className="rounded-md border border-border px-2 py-1 text-[10px] hover:bg-secondary"
                  disabled={!selectedUnitIds.length}
                  onClick={() => nudgeSelectedUnits(10)}
                >
                  →
                </button>
                <button
                  className="rounded-md border border-border px-2 py-1 text-[10px] hover:bg-secondary"
                  disabled={!selectedUnitIds.length}
                  onClick={duplicateSelectedUnits}
                >
                  Duplicate
                </button>
                <button
                  className="rounded-md border border-destructive/40 px-2 py-1 text-[10px] text-destructive hover:bg-destructive/10"
                  disabled={!selectedUnitIds.length}
                  onClick={deleteSelectedUnits}
                >
                  Delete
                </button>
              </div>
              {units.map((u, i) => (
                <div
                  key={u.id}
                  className={`flex items-center gap-3 rounded-xl border p-2 transition-colors ${
                    sel?.id === u.id
                      ? "border-primary bg-accent"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedUnitIds.includes(u.id)}
                    onChange={() => toggleUnitSelection(u.id)}
                    aria-label={`Select unit ${i + 1}`}
                    className="size-4 accent-primary"
                  />
                  <button
                    className="flex flex-1 items-center gap-3 text-left"
                    onClick={() => setSelectedId(u.id)}
                  >
                    <span
                      className="flex h-10 w-8 flex-col justify-between rounded-md border border-border/70 p-0.5"
                      style={{ backgroundColor: FINISHES.find((f) => f.id === u.finish)?.swatch }}
                    >
                      <span className="h-px w-full bg-foreground/15" />
                      <span className="h-px w-full bg-foreground/15" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-foreground">
                        Unit {i + 1}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {u.w}×{u.h}×{u.d} cm · €{unitPrice(u)}
                      </span>
                    </span>
                  </button>
                  <button
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeUnit(u.id)}
                    aria-label={`Remove unit ${i + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              {units.length === 0 && (
                <p className="rounded-xl border border-dashed border-border p-3 text-[11px] text-muted-foreground">
                  No cabinets yet. Add your first unit to start the assembly.
                </p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="cnc"
          className={`panel-card border-none px-4 ${step !== "finishes" ? "hidden" : ""}`}
        >
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2">
              <Boxes className="size-4 text-primary" />
              <span className="label-eyebrow">CNC Export · Panels</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["panelThickness", "Panel thickness", 0, 60],
                  ["backThickness", "HDF back", 0, 60],
                  ["kerf", "Kerf", 0, 30],
                  ["sheetMargin", "Sheet margin", 0, 100],
                  ["sheetWidth", "Sheet width", 100, 5000],
                  ["sheetHeight", "Sheet height", 100, 5000],
                ] as const
              ).map(([key, label, min, max]) => (
                <label key={key} className="space-y-1 text-[10px] text-muted-foreground">
                  {label} (mm)
                  <input
                    type="number"
                    min={min}
                    max={max}
                    step="0.1"
                    value={cnc[key]}
                    onChange={(event) => patchCnc(key, Number(event.target.value))}
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                  />
                </label>
              ))}
            </div>
            <p className="rounded-lg border border-dashed border-primary/30 bg-accent/30 p-2 text-[10px] text-muted-foreground">
              Values are in millimetres. Zero or empty values automatically use the standard
              defaults.
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <span>{cutlist.parts.length} parts</span>
              <span>{cutlist.sheets.length} sheets</span>
              <span>{cutlist.totalAreaM2.toFixed(2)} m² total</span>
              <span>Joinery compensated for {cnc.panelThickness} mm board</span>
            </div>
            {cutlist.sheets.length > 0 && (
              <div className="space-y-1.5 rounded-lg border border-border bg-background/70 p-2 text-[10px]">
                <div className="font-semibold text-foreground">Automatic plate allocation</div>
                {cutlist.sheets.map((sheet) => {
                  const cabinets = [...new Set(sheet.parts.map((item) => item.cabinet))];
                  return (
                    <div
                      key={sheet.number}
                      className="rounded-md border border-border/70 bg-card px-2 py-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 font-medium text-foreground">
                        <span>Plate {String(sheet.number).padStart(2, "0")}</span>
                        <span className="text-muted-foreground">{sheet.parts.length} panels</span>
                      </div>
                      <div className="mt-0.5 break-words text-muted-foreground">
                        {cabinets.join(" · ")}
                      </div>
                    </div>
                  );
                })}
                <p className="pt-0.5 text-muted-foreground">
                  Cabinets are allocated by material efficiency; a cabinet may continue on the next
                  plate when its parts do not fit together on one sheet.
                </p>
              </div>
            )}
            {cncReady ? (
              <p className="rounded-lg border border-emerald-300/70 bg-emerald-50 p-2 text-[10px] text-emerald-800">
                Verificarea plăcilor a trecut: dimensiunile, limitele și suprapunerile sunt corecte.
                <span className="block opacity-75">
                  Panel nesting passed: dimensions, sheet boundaries and overlaps are valid.
                </span>
              </p>
            ) : (
              <div className="space-y-1 rounded-lg border border-red-300 bg-red-50 p-2 text-[10px] text-red-800">
                <p className="font-semibold">Export CNC blocat / CNC export blocked:</p>
                {cncIssues.slice(0, 4).map((issue) => (
                  <p key={issue.id}>
                    <span className="block">{issue.messageRo ?? issue.message}</span>
                    {issue.messageRo && <span className="block opacity-75">{issue.message}</span>}
                  </p>
                ))}
                {cutlist.oversized.length > 0 && (
                  <>
                    <p>
                      • RO: {cutlist.oversized.length} piesă/piese nu încap pe placa configurată și
                      nu au fost repartizate.
                    </p>
                    <p className="opacity-75">
                      EN: {cutlist.oversized.length} part(s) do not fit the configured sheet and
                      were not nested.
                    </p>
                    <div className="mt-1 space-y-1 border-t border-red-300/70 pt-1">
                      {cutlist.oversized.map((item) => {
                        const copy = oversizedCopy(item);
                        return (
                          <div key={item.id}>
                            <p className="font-medium">
                              {item.cabinet} · {item.label} · {item.width.toFixed(0)} ×
                              {item.height.toFixed(0)} mm
                            </p>
                            <p>{copy.ro}</p>
                            <p className="opacity-75">{copy.en}</p>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                {cncIssues.length > 4 && (
                  <p>+ {cncIssues.length - 4} alte probleme / more issue(s)</p>
                )}
              </div>
            )}
            {cutlist.camReviewReasons.length > 0 && (
              <details className="rounded-lg border border-sky-300 bg-sky-50 p-2 text-[10px] text-sky-800">
                <summary className="cursor-pointer font-semibold">
                  Verificare CAM înainte de prelucrare / Pre-CAM checklist (
                  {cutlist.camReviewReasons.length})
                </summary>
                <div className="mt-1 space-y-1">
                  {cutlist.camReviewReasons.map((reason) => (
                    <p key={reason.en}>
                      <span className="block">{reason.ro}</span>
                      <span className="block opacity-75">{reason.en}</span>
                    </p>
                  ))}
                </div>
              </details>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={downloadCnc}
                disabled={!cutlist.sheets.length || !cncReady}
              >
                Download combined DXF
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={downloadCncSheets}
                disabled={!cutlist.sheets.length || !cncReady}
              >
                Export separate plates ({cutlist.sheets.length})
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={printCncPdf}
                disabled={!cutlist.parts.length}
              >
                Print cut-list PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={downloadCncManifest}
                disabled={!cutlist.parts.length}
              >
                Export Aspire manifest (CSV)
              </Button>
            </div>
            <p className="rounded-lg border border-dashed border-sky-300/70 bg-sky-50/70 p-2 text-[10px] leading-4 text-sky-800">
              DXF = geometria panourilor · CSV = trasabilitate placă/dulap/piesă · PDF = control
              uman. Codul CNC final și traseele se generează în Aspire cu profilul și
              postprocessorul utilajului.
            </p>
          </AccordionContent>
        </AccordionItem>

        {sel && (
          <AccordionItem
            value="config"
            className={`panel-card border-none px-4 ${step !== "finishes" ? "hidden" : ""}`}
          >
            <AccordionTrigger className="hover:no-underline">
              <span className="flex items-center gap-2">
                <Palette className="size-4 text-primary" />
                <span className="label-eyebrow">
                  Finishes &amp; Hardware · #{units.findIndex((u) => u.id === sel.id) + 1}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="space-y-2 rounded-xl border border-border bg-card/70 p-2.5">
                <div className="label-eyebrow">Editing cabinet</div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {units.map((unit, index) => (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(unit.id);
                        setLeafSel(null);
                        onSelectFitting(null);
                      }}
                      className={`min-w-[92px] shrink-0 rounded-xl border px-2.5 py-2 text-left transition-colors ${selectedId === unit.id ? "border-primary bg-accent" : "border-border hover:bg-secondary"}`}
                    >
                      <span className="block text-xs font-medium text-foreground">
                        Unit {index + 1}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        {unit.w} × {unit.h} × {unit.d} cm
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border p-2.5">
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Lock className="size-3.5 text-primary" />
                  Edit Interior Only
                </span>
                <Switch checked={editInterior} onCheckedChange={onToggleEditInterior} />
              </div>
              {editInterior && (
                <p className="rounded-xl bg-secondary p-2.5 text-[11px] text-muted-foreground">
                  Frame locked. Drag shelves, rails, drawers or the door handle directly in the 3D
                  view — fittings snap to the 32 mm hole matrix.
                </p>
              )}
              <fieldset disabled={editInterior} className="space-y-4 disabled:opacity-50">
                <Row
                  label="Width"
                  value={sel.w}
                  min={UNIT_LIMITS.w[0]}
                  max={UNIT_LIMITS.w[1]}
                  onChange={(v) => resize(sel.id, { w: v })}
                />
                <Row
                  label="Height"
                  value={sel.h}
                  min={UNIT_LIMITS.h[0]}
                  max={UNIT_LIMITS.h[1]}
                  onChange={(v) => resize(sel.id, { h: v })}
                />
                <Row
                  label="Depth"
                  value={sel.d}
                  min={UNIT_LIMITS.d[0]}
                  max={UNIT_LIMITS.d[1]}
                  onChange={(v) => resize(sel.id, { d: v })}
                />
              </fieldset>

              <div className="space-y-2">
                <span className="label-eyebrow">Mounting</span>
                <div className="grid grid-cols-3 gap-2">
                  {UNIT_MOUNTS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => applyMount(sel, m.id)}
                      className={`rounded-xl border p-2 text-left transition-all ${
                        (sel.mount ?? "base") === m.id
                          ? "border-primary bg-accent"
                          : "border-border hover:bg-secondary"
                      }`}
                    >
                      <div className="text-[11px] font-medium text-foreground">{m.name}</div>
                      <div className="text-[10px] text-muted-foreground">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <Row
                label="Clearance from floor"
                value={sel.y ?? 0}
                min={UNIT_LIMITS.y[0]}
                max={UNIT_LIMITS.y[1]}
                onChange={(v) => patch(sel.id, { y: v })}
              />

              <div className="space-y-3 rounded-xl border border-primary/25 bg-accent/30 p-3">
                <div>
                  <div className="text-xs font-semibold text-foreground">Kitchen components</div>
                  <div className="text-[10px] text-muted-foreground">
                    Add a worktop, sink, hob and tap to turn this cabinet into a kitchen module.
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-foreground">Countertop / worktop</span>
                  <Switch
                    checked={!!sel.countertop}
                    onCheckedChange={(v) => patch(sel.id, { countertop: v })}
                  />
                </div>
                {sel.countertop && (
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ["stone", "Stone"],
                        ["wood", "Wood"],
                        ["laminate", "Laminate"],
                      ] as const
                    ).map(([id, name]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => patch(sel.id, { countertopMaterial: id })}
                        className={`rounded-lg border px-2 py-1.5 text-[11px] ${
                          (sel.countertopMaterial ?? "stone") === id
                            ? "border-primary bg-primary/10 font-medium"
                            : "border-border hover:bg-secondary"
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
                {sel.countertop && (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-foreground">Backsplash</span>
                      <Switch
                        checked={!!sel.backsplash}
                        onCheckedChange={(v) => patch(sel.id, { backsplash: v })}
                      />
                    </div>
                    {sel.backsplash && (
                      <Row
                        label="Backsplash height"
                        value={sel.backsplashHeight ?? 60}
                        min={10}
                        max={120}
                        onChange={(v) => patch(sel.id, { backsplashHeight: v })}
                      />
                    )}
                  </>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-foreground">Faucet / tap</span>
                  <Switch
                    checked={!!sel.faucet}
                    onCheckedChange={(v) => patch(sel.id, { faucet: v })}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Add Sink or Induction Hob below in Interior Equipment. The 3D preview shows them
                  on the worktop.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Magnet className="size-3.5 text-primary" />
                  Magnetic snapping
                </span>
                <Switch
                  checked={sel.snap !== false}
                  onCheckedChange={(v) => patch(sel.id, { snap: v })}
                />
              </div>

              <div className="space-y-2">
                <span className="label-eyebrow">Finish</span>
                <div className="grid grid-cols-4 gap-2">
                  {FINISHES.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => patch(sel.id, { finish: f.id })}
                      title={f.name}
                      className={`aspect-square rounded-xl border-2 shadow-sm transition-transform hover:scale-105 ${
                        sel.finish === f.id ? "border-primary" : "border-border"
                      }`}
                      style={{ backgroundColor: f.swatch }}
                      aria-label={f.name}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="label-eyebrow">Front</span>
                <div className="grid grid-cols-2 gap-2">
                  {UNIT_FRONTS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() =>
                        patch(sel.id, {
                          front: f.id,
                          drawers: f.id === "drawers" ? Math.max(1, sel.drawers || 3) : sel.drawers,
                        })
                      }
                      className={`rounded-xl border p-2 text-left transition-all ${
                        sel.front === f.id
                          ? "border-primary bg-accent"
                          : "border-border hover:bg-secondary"
                      }`}
                    >
                      <div className="text-xs font-medium text-foreground">{f.name}</div>
                      <div className="text-[10px] text-muted-foreground">{f.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-foreground">Under-stairs profile</div>
                    <div className="text-[10px] text-muted-foreground">
                      Use this unit beside or under a staircase.
                    </div>
                  </div>
                  <Switch
                    checked={!!sel.underStairs}
                    onCheckedChange={(v) => patch(sel.id, { underStairs: v })}
                  />
                </div>
                {sel.underStairs && (
                  <>
                    <Row
                      label="Low-side height"
                      unit="cm"
                      value={sel.slopeMinHeight ?? Math.max(40, Math.round(sel.h * 0.5))}
                      min={40}
                      max={Math.max(40, sel.h - 10)}
                      onChange={(v) => patch(sel.id, { slopeMinHeight: v })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      {(["left", "right"] as const).map((side) => (
                        <button
                          key={side}
                          type="button"
                          onClick={() => patch(sel.id, { slopeSide: side })}
                          className={`rounded-lg border px-2 py-1.5 text-xs capitalize ${
                            (sel.slopeSide ?? "right") === side
                              ? "border-primary bg-accent font-medium"
                              : "border-border hover:bg-secondary"
                          }`}
                        >
                          Low side: {side}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={() => patch(sel.id, { rot: (sel.rot + 90) % 360 })}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2 text-xs font-medium text-foreground hover:bg-secondary"
              >
                <RotateCw className="size-3.5" />
                Rotate 90°
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      units: c.units.map((u) => (u.id === sel.id ? alignToWall(u) : u)),
                    }))
                  }
                  className="flex items-center justify-center gap-2 rounded-xl border border-border py-2 text-xs font-medium text-foreground hover:bg-secondary"
                >
                  <AlignVerticalJustifyStart className="size-3.5" />
                  Align to wall
                </button>
                <button
                  onClick={() => onDuplicate(sel.id)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-border py-2 text-xs font-medium text-foreground hover:bg-secondary"
                >
                  <Copy className="size-3.5" />
                  Duplicate
                </button>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {sel && (
          <AccordionItem
            value="acc"
            className={`panel-card border-none px-4 ${step !== "finishes" ? "hidden" : ""}`}
          >
            <AccordionTrigger className="hover:no-underline">
              <span className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <span className="label-eyebrow">Interior Equipment</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              {/* the exact same editor Straight Wall uses, driven by the selected cabinet */}
              <InteriorEquipment
                items={[
                  ...fittingsOf(sel).map((f) => ({
                    id: f.id,
                    type: f.type as ItemType,
                    y: f.y + innerBase(sel),
                  })),
                  ...(sel.appliances ?? []).map((appliance) => ({
                    id: appliance.id,
                    type: appliance.type as ItemType,
                    x: appliance.x ?? 0,
                    y: appliance.y,
                  })),
                ]}
                types={["shelf", "rail", "drawer", "basket", "cargo", ...APPLIANCE_TYPES]}
                selectedId={selectedFitting}
                onSelect={onSelectFitting}
                onAdd={(t) =>
                  APPLIANCE_TYPES.includes(t as (typeof APPLIANCE_TYPES)[number])
                    ? mapUnit(sel.id, (u) => ({
                        ...u,
                        appliances: [
                          ...(u.appliances ?? []),
                          {
                            id: newId(),
                            type: t as (typeof APPLIANCE_TYPES)[number],
                            x: 0,
                            y: t === "sink" || t === "hob" ? 4 : 20,
                          },
                        ],
                      }))
                    : mapUnit(sel.id, (u) => addFitting(u, t as FittingType))
                }
                onRemove={(id) =>
                  mapUnit(sel.id, (u) =>
                    (u.appliances ?? []).some((appliance) => appliance.id === id)
                      ? {
                          ...u,
                          appliances: (u.appliances ?? []).filter(
                            (appliance) => appliance.id !== id,
                          ),
                        }
                      : removeFitting(u, id),
                  )
                }
                contentsLabel={`${sel.name ?? "Cabinet"} contents`}
                actions={(item) => (
                  <>
                    {APPLIANCE_TYPES.includes(item.type as (typeof APPLIANCE_TYPES)[number]) && (
                      <div className="flex items-center gap-0.5 rounded-md border border-border px-1">
                        {([-1, 0, 1] as const).map((direction) => (
                          <button
                            key={direction}
                            className={`px-1 text-[10px] ${Math.abs((item.x ?? 0) / 100 - direction * Math.max(1, sel.w / 260)) < 0.03 ? "font-bold text-primary" : "text-muted-foreground hover:text-foreground"}`}
                            title={
                              direction === -1
                                ? "Move appliance left"
                                : direction === 1
                                  ? "Move appliance right"
                                  : "Center appliance"
                            }
                            onClick={() =>
                              mapUnit(sel.id, (u) => ({
                                ...u,
                                appliances: (u.appliances ?? []).map((appliance) =>
                                  appliance.id === item.id
                                    ? { ...appliance, x: direction * Math.max(0, u.w / 2 - 18) }
                                    : appliance,
                                ),
                              }))
                            }
                          >
                            {direction === -1 ? "←" : direction === 1 ? "→" : "•"}
                          </button>
                        ))}
                      </div>
                    )}
                    <HeightField
                      value={Math.round(item.y * 10) / 10}
                      onCommit={(v) =>
                        mapUnit(sel.id, (u) =>
                          (u.appliances ?? []).some((appliance) => appliance.id === item.id)
                            ? {
                                ...u,
                                appliances: (u.appliances ?? []).map((appliance) =>
                                  appliance.id === item.id ? { ...appliance, y: v } : appliance,
                                ),
                              }
                            : moveFitting(u, item.id, v - innerBase(sel), true),
                        )
                      }
                    />
                    <button
                      className="rounded-md border border-border px-1.5 text-xs text-foreground hover:bg-secondary"
                      onClick={() =>
                        mapUnit(sel.id, (u) => {
                          const appliance = (u.appliances ?? []).find(
                            (candidate) => candidate.id === item.id,
                          );
                          if (appliance)
                            return {
                              ...u,
                              appliances: (u.appliances ?? []).map((candidate) =>
                                candidate.id === item.id
                                  ? { ...candidate, y: candidate.y + 3.2 }
                                  : candidate,
                              ),
                            };
                          return moveFitting(u, item.id, item.y - innerBase(sel) + 3.2);
                        })
                      }
                      aria-label="Move item up"
                    >
                      ↑
                    </button>
                    <button
                      className="rounded-md border border-border px-1.5 text-xs text-foreground hover:bg-secondary"
                      onClick={() =>
                        mapUnit(sel.id, (u) => {
                          const appliance = (u.appliances ?? []).find(
                            (candidate) => candidate.id === item.id,
                          );
                          if (appliance)
                            return {
                              ...u,
                              appliances: (u.appliances ?? []).map((candidate) =>
                                candidate.id === item.id
                                  ? { ...candidate, y: candidate.y - 3.2 }
                                  : candidate,
                              ),
                            };
                          return moveFitting(u, item.id, item.y - innerBase(sel) - 3.2);
                        })
                      }
                      aria-label="Move item down"
                    >
                      ↓
                    </button>
                  </>
                )}
              />
              <Row
                label="Exterior drawers below door"
                unit=""
                value={sel.drawers}
                min={0}
                max={5}
                onChange={(v) => patch(sel.id, { drawers: v })}
              />
              {sel.drawers > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center gap-2 rounded-xl"
                  onClick={() => patch(sel.id, { drawersOpen: !sel.drawersOpen })}
                >
                  {sel.drawersOpen ? "Close drawers" : "Open drawers"}
                </Button>
              )}
              {sel.front !== "none" && sel.front !== "drawers" && (
                <div className="space-y-2 rounded-xl border border-primary/20 bg-accent/20 p-2.5">
                  <div>
                    <div className="text-xs font-medium text-foreground">
                      Horizontal front split
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Divide this cabinet into stacked front sections. The separation line is shown
                      in 3D.
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([1, 2, 3] as const).map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => patch(sel.id, { frontSections: count })}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-medium ${
                          (sel.frontSections ?? 1) === count
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-foreground hover:bg-secondary"
                        }`}
                      >
                        {count === 1 ? "Full" : `${count} sections`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {sel.drawers > 0 && (
                <Row
                  label="Drawer height"
                  unit="cm"
                  value={sel.drawerHeight ?? 20}
                  min={8}
                  max={60}
                  onChange={(v) => patch(sel.id, { drawerHeight: v })}
                />
              )}
              {sel.drawers > 0 && sel.front !== "drawers" && (
                <p className="rounded-xl border border-dashed border-primary/40 bg-accent/60 p-2.5 text-[11px] text-muted-foreground">
                  The drawer fronts sit outside the cabinet at the bottom. The door is automatically
                  shortened and starts directly above the drawer stack.
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Top LED light</span>
                <Switch checked={sel.light} onCheckedChange={(v) => patch(sel.id, { light: v })} />
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {doorList.length > 0 && (
          <AccordionItem
            value="doorleaves"
            className={`panel-card border-none px-4 ${step !== "finishes" ? "hidden" : ""}`}
          >
            <AccordionTrigger className="hover:no-underline">
              <span className="flex items-center gap-2">
                <SquareStack className="size-4 text-primary" />
                <span className="label-eyebrow">Individual Door Customization</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                <span className="text-xs font-medium text-foreground">
                  Open all doors (preview)
                </span>
                <Switch
                  checked={units.some((u) => u.open)}
                  onCheckedChange={(v) =>
                    setConfig((c) => ({
                      ...c,
                      units: c.units.map((u) => ({
                        ...u,
                        open: v,
                        // Clear per-leaf overrides so the global preview wins.
                        leaves: Object.fromEntries(
                          Object.entries(u.leaves ?? {}).map(([k, l]) => {
                            const { open: _o, ...rest } = l;
                            return [k, rest];
                          }),
                        ),
                      })),
                    }))
                  }
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {doorList.map(({ u, ui, li, section }, n) => {
                  const spec = sectionSpec(u, li, section);
                  const mat = DOOR_MATERIALS.find((m) => m.id === spec.material);
                  const active =
                    leafSel?.unitId === u.id && leafSel.leaf === li && leafSel.section === section;
                  return (
                    <button
                      key={`${u.id}-${li}-${section}`}
                      onClick={() => {
                        setLeafSel({ unitId: u.id, leaf: li, section });
                        setSelectedId(u.id);
                      }}
                      title={`${u.name ?? `Cabinet ${ui + 1}`}${leafCount(u) > 1 ? ` · leaf ${li + 1}` : ""}`}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        active
                          ? "border-primary bg-accent"
                          : "border-border text-foreground hover:bg-secondary"
                      }`}
                    >
                      <span
                        className="size-3.5 rounded-full border border-border"
                        style={{
                          backgroundColor:
                            mat?.swatch ?? FINISHES.find((f) => f.id === u.finish)?.swatch,
                        }}
                      />
                      {leafCount(u) > 1 ? `Leaf ${li + 1}` : "Door"} · S{section + 1}
                    </button>
                  );
                })}
              </div>

              {!leaf || !leafUnit ? (
                <p className="rounded-xl border border-dashed border-border p-3 text-[11px] text-muted-foreground">
                  Select a door above to change its material, hinge side and handle.
                </p>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-foreground">
                    Editing {leafUnit.name ?? "cabinet"} · Door{" "}
                    {doorList.findIndex(
                      (d) =>
                        d.u.id === leafSel?.unitId &&
                        d.li === leafSel?.leaf &&
                        d.section === leafSel?.section,
                    ) + 1}
                  </p>
                  <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                    <span className="text-xs font-medium text-foreground">Open this door only</span>
                    <Switch
                      checked={leaf.open}
                      onCheckedChange={(v) =>
                        setConfig((c) => ({
                          ...c,
                          units: c.units.map((u) => {
                            // Every other door closes: unit-level preview off and
                            // sibling leaf overrides reset to closed.
                            const leaves = Object.fromEntries(
                              Object.entries(u.leaves ?? {}).map(([k, l]) => [
                                k,
                                { ...l, open: false },
                              ]),
                            );
                            if (u.id === leafSel?.unitId) {
                              const key =
                                leafSel.section === 0
                                  ? String(leafSel.leaf)
                                  : sectionKey(leafSel.leaf, leafSel.section);
                              leaves[key] = { ...(u.leaves?.[key] ?? {}), open: v };
                            }
                            return { ...u, open: false, leaves };
                          }),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="label-eyebrow">Front type</span>
                    <div className="grid gap-2">
                      {[
                        { id: "hinged", name: "Hinged door", desc: "Swings on a side hinge" },
                        {
                          id: "pullout",
                          name: "Pull-out front",
                          desc: "Front slides out with the box",
                        },
                      ].map((f) => (
                        <button
                          key={f.id}
                          onClick={() => patchLeaf({ mode: f.id as "hinged" | "pullout" })}
                          className={`rounded-xl border p-2.5 text-left transition-all ${
                            leaf.mode === f.id
                              ? "border-primary bg-accent"
                              : "border-border hover:bg-secondary"
                          }`}
                        >
                          <div className="text-[12px] font-medium text-foreground">{f.name}</div>
                          <div className="text-[10px] text-muted-foreground">{f.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="label-eyebrow">Hinge orientation / handle side</span>
                    <div className="grid grid-cols-3 gap-2">
                      {HANDLE_SIDES.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => patchLeaf({ side: o.id })}
                          className={`rounded-xl border p-2 text-xs font-medium transition-all ${
                            leaf.side === o.id
                              ? "border-primary bg-accent text-foreground"
                              : "border-border text-foreground hover:bg-secondary"
                          }`}
                        >
                          {o.name}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {HANDLE_SIDES.find((s) => s.id === leaf.side)?.desc}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <span className="label-eyebrow">Handle alignment</span>
                    <div className="grid grid-cols-2 gap-2">
                      {HANDLE_ALIGNS.map((a) => (
                        <button
                          key={a.id}
                          onClick={() =>
                            patchLeaf({
                              align: a.id,
                              handleY: Math.round(
                                leafUnit.h *
                                  (a.id === "top" ? 0.85 : a.id === "bottom" ? 0.15 : 0.5),
                              ),
                            })
                          }
                          className={`rounded-xl border p-2 text-[11px] font-medium transition-all ${
                            leaf.align === a.id
                              ? "border-primary bg-accent text-foreground"
                              : "border-border text-foreground hover:bg-secondary"
                          }`}
                        >
                          {a.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="label-eyebrow">Door material</span>
                    <div className="grid gap-2">
                      {DOOR_MATERIALS.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => patchLeaf({ material: m.id as DoorMaterial })}
                          className={`flex items-center gap-3 rounded-xl border p-2.5 text-left transition-all ${
                            leaf.material === m.id
                              ? "border-primary bg-accent"
                              : "border-border hover:bg-secondary"
                          }`}
                        >
                          <span
                            className="size-6 shrink-0 rounded-full border border-border"
                            style={{ backgroundColor: m.swatch }}
                          />
                          <span className="flex-1">
                            <span className="block text-[12px] font-medium text-foreground">
                              {m.name}
                            </span>
                            <span className="block text-[10px] text-muted-foreground">
                              {m.desc}
                            </span>
                          </span>
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {m.price ? `+€${m.price}` : "incl."}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="label-eyebrow">Door style</span>
                    <div className="grid grid-cols-3 gap-2">
                      {DOOR_STYLES.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => patchLeaf({ style: d.id as DoorStyle })}
                          className={`rounded-xl border p-2 text-[11px] font-medium transition-all ${
                            leaf.style === d.id
                              ? "border-primary bg-accent text-foreground"
                              : "border-border text-foreground hover:bg-secondary"
                          }`}
                        >
                          {d.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="label-eyebrow">Handle</span>
                    <div className="grid grid-cols-2 gap-2">
                      {HANDLE_STYLES.map((h) => (
                        <button
                          key={h.id}
                          onClick={() => patchLeaf({ handleStyle: h.id as HandleStyle })}
                          className={`rounded-xl border p-2 text-xs font-medium transition-all ${
                            leaf.handleStyle === h.id
                              ? "border-primary bg-accent text-foreground"
                              : "border-border text-foreground hover:bg-secondary"
                          }`}
                        >
                          {h.name}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {HANDLE_POSITIONS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => patchLeaf({ handlePos: p.id as HandlePos })}
                          className={`rounded-xl border p-2 text-xs font-medium transition-all ${
                            leaf.handlePos === p.id
                              ? "border-primary bg-accent text-foreground"
                              : "border-border text-foreground hover:bg-secondary"
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Row
                    label="Handle height"
                    value={Math.round(leaf.handleY)}
                    min={8}
                    max={Math.max(9, leafUnit.h - 8)}
                    unit="cm"
                    onChange={(v) => patchLeaf({ handleY: v })}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "low", name: "Low", f: 0.25 },
                      { id: "mid", name: "Middle", f: 0.5 },
                      { id: "high", name: "High", f: 0.75 },
                    ].map((a) => (
                      <button
                        key={a.id}
                        onClick={() => patchLeaf({ handleY: Math.round(leafUnit.h * a.f) })}
                        className="rounded-xl border border-border py-2 text-[11px] font-medium text-foreground hover:bg-secondary"
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Tip: click a handle in the 3D view and drag it up or down.
                  </p>
                  <button
                    onClick={() => {
                      if (!leafSel) return;
                      const key =
                        leafSel.section === 0
                          ? String(leafSel.leaf)
                          : sectionKey(leafSel.leaf, leafSel.section);
                      setConfig((c) => ({
                        ...c,
                        units: c.units.map((u) => {
                          if (u.id !== leafSel.unitId) return u;
                          const rest = { ...(u.leaves ?? {}) };
                          delete rest[key];
                          return { ...u, leaves: rest };
                        }),
                      }));
                    }}
                    className="w-full rounded-xl border border-border py-2 text-xs font-medium text-muted-foreground hover:bg-secondary"
                  >
                    Reset this door to cabinet defaults
                  </button>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem
          value="library"
          className={`panel-card border-none px-4 ${step !== "finishes" ? "hidden" : ""}`}
        >
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2">
              <Library className="size-4 text-primary" />
              <span className="label-eyebrow">Preset Library</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <div className="space-y-2">
              <span className="label-eyebrow">Kitchen layouts</span>
              {savedKitchenLayouts.length > 0 && (
                <div className="space-y-2 rounded-xl border border-primary/20 bg-accent/25 p-2.5">
                  <span className="label-eyebrow">My saved kitchens</span>
                  {savedKitchenLayouts.map((layout) => (
                    <div
                      key={layout.id}
                      className="rounded-lg border border-border bg-background/70 p-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex-1 text-xs font-medium text-foreground">
                          {layout.name}
                        </span>
                        <button
                          type="button"
                          className="text-[10px] text-destructive hover:underline"
                          onClick={() => onRemoveKitchenLayout(layout.id)}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {layout.units.length} modules
                      </div>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          className="rounded-md bg-primary px-2 py-1.5 text-[10px] font-semibold text-primary-foreground"
                          onClick={() => addSavedKitchenLayout(layout, "replace")}
                        >
                          Use design
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-border px-2 py-1.5 text-[10px] text-foreground hover:bg-secondary"
                          onClick={() => addSavedKitchenLayout(layout, "append")}
                        >
                          Add here
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {KITCHEN_LAYOUT_PRESETS.map((layout) => (
                <div
                  key={layout.id}
                  className="space-y-2 rounded-xl border border-primary/30 bg-accent/50 p-2.5"
                >
                  <KitchenLayoutPreview layout={layout} />
                  <div>
                    <span className="block text-xs font-medium text-foreground">{layout.name}</span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {layout.description}
                    </span>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      {layout.units.length} modules ·{" "}
                      {layout.units.filter((unit) => unit.mount === "wall").length} wall units ·{" "}
                      {layout.units.filter((unit) => (unit.appliances ?? []).length > 0).length}{" "}
                      appliances
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {[
                        ...new Set(
                          layout.units.flatMap((unit) =>
                            (unit.appliances ?? []).map((item) => item.type),
                          ),
                        ),
                      ].map((type) => (
                        <span
                          key={type}
                          className="rounded-full border border-border/70 bg-background/70 px-1.5 py-0.5 text-[9px] capitalize text-muted-foreground"
                        >
                          {type === "hob" ? "Hob" : type === "fridge" ? "Fridge" : type}
                        </span>
                      ))}
                      {layout.units.some((unit) => unit.front === "drawers") && (
                        <span className="rounded-full border border-border/70 bg-background/70 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                          Drawers
                        </span>
                      )}
                      {layout.units.some((unit) => unit.mount === "wall") && (
                        <span className="rounded-full border border-border/70 bg-background/70 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                          Wall units
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => addKitchenLayout(layout, "replace")}
                      className="rounded-lg bg-primary px-2 py-2 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Use as new design
                    </button>
                    <button
                      type="button"
                      onClick={() => addKitchenLayout(layout, "append")}
                      className="rounded-lg border border-border bg-background px-2 py-2 text-[11px] font-medium text-foreground transition-colors hover:border-primary hover:bg-accent"
                    >
                      Add to current
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {presets.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-3 text-[11px] text-muted-foreground">
                No saved cabinet presets available yet.
              </p>
            )}
            {(PRESET_CATEGORIES as readonly PresetCategory[]).map((cat) => {
              const list = presets.filter((p) => p.category === cat);
              if (list.length === 0) return null;
              return (
                <div key={cat} className="space-y-2">
                  <span className="label-eyebrow">{cat}</span>
                  {list.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl border border-border p-2 hover:bg-secondary"
                    >
                      <button
                        className="flex flex-1 items-center gap-3 text-left"
                        onClick={() => addFromPreset(p)}
                      >
                        <span
                          className="h-9 w-7 rounded-md border border-border/70"
                          style={{
                            backgroundColor: FINISHES.find((f) => f.id === p.unit.finish)?.swatch,
                          }}
                        />
                        <span>
                          <span className="block text-sm font-medium text-foreground">
                            {p.name}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            {p.unit.w}×{p.unit.h}×{p.unit.d} cm
                          </span>
                        </span>
                      </button>
                      <button
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onRemovePreset(p.id)}
                        aria-label={`Remove preset ${p.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
