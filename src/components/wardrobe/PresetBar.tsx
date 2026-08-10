import { Library, Trash2 } from "lucide-react";
import type { CabinetPreset } from "@/lib/presets";
import { FINISHES } from "@/lib/wardrobe";

/** Miniature elevation drawing of a cabinet, used as the card thumbnail. */
function Thumb({ preset }: { preset: CabinetPreset }) {
  const u = preset.unit;
  const hex = FINISHES.find((f) => f.id === u.finish)?.swatch ?? "#cfc4b4";
  const leaves = u.front === "double" ? 2 : u.front === "drawers" ? 0 : 1;
  const drawers = u.front === "drawers" ? 3 : 0;
  const ratio = Math.min(1.6, Math.max(0.5, u.h / Math.max(20, u.w)));
  return (
    <div
      className="grid shrink-0 place-items-center overflow-hidden rounded-md border border-border/70"
      style={{
        width: 34,
        height: 34,
        background: "color-mix(in srgb, var(--secondary) 70%, white)",
      }}
    >
      <div
        className="flex overflow-hidden rounded-[3px] border border-black/10"
        style={{
          background: hex,
          width: ratio > 1 ? 34 / ratio - 8 : 24,
          height: ratio > 1 ? 26 : 26 * ratio,
          opacity: u.front === "glass" ? 0.65 : 1,
        }}
      >
        {drawers > 0
          ? Array.from({ length: drawers }).map((_, i) => <div key={i} className="hidden" />)
          : Array.from({ length: leaves }).map((_, i) => (
              <div key={i} className="h-full flex-1 border-r border-black/15 last:border-r-0" />
            ))}
        {drawers > 0 && (
          <div className="flex h-full w-full flex-col">
            {Array.from({ length: drawers }).map((_, i) => (
              <div key={i} className="flex-1 border-b border-black/15 last:border-b-0" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Horizontal quick-load bar for saved cabinet presets, docked above the canvas. */
export default function PresetBar({
  presets,
  onInsert,
  onDelete,
}: {
  presets: CabinetPreset[];
  onInsert: (p: CabinetPreset) => void;
  onDelete: (id: string) => void;
}) {
  if (!presets.length) return null;
  return (
    <div className="pointer-events-auto absolute top-3 left-3 z-20 max-w-[calc(100%-7.5rem)]">
      <div className="glass-bar flex items-center gap-2 rounded-2xl p-2 shadow-sm">
        <span className="ml-1 flex shrink-0 items-center gap-1.5 text-[10px] tracking-wider text-muted-foreground uppercase">
          <Library className="size-3.5" />
          <span className="hidden sm:inline">Saved</span>
        </span>
        <div className="flex max-w-full gap-2 overflow-x-auto pb-0.5">
          {presets.map((p) => (
            <div
              key={p.id}
              className="group relative flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card/90 py-1.5 pr-7 pl-2 text-left transition-colors hover:border-primary"
            >
              <button
                type="button"
                title={`Insert ${p.name}`}
                onClick={() => onInsert(p)}
                className="flex cursor-pointer items-center gap-2 text-left"
              >
                <Thumb preset={p} />
                <span className="min-w-0">
                  <span className="block max-w-36 truncate text-xs font-medium text-foreground">
                    {p.name}
                  </span>
                  <span className="block text-[10px] text-muted-foreground tabular-nums">
                    {p.unit.w}×{p.unit.h}×{p.unit.d} cm
                  </span>
                </span>
              </button>
              <button
                type="button"
                aria-label={`Delete preset ${p.name}`}
                title="Delete preset"
                onClick={() => onDelete(p.id)}
                className="absolute top-1/2 right-1 -translate-y-1/2 cursor-pointer rounded-md p-1 text-muted-foreground opacity-60 transition hover:bg-destructive/10 hover:text-destructive hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
