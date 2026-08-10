import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  billOfMaterials,
  totalPrice,
  bayCountOf,
  runWidth,
  wallSpec,
  wallLabel,
  walls,
  type Config,
  type Unit,
} from "@/lib/wardrobe";
import { Receipt, RotateCcw, Truck } from "lucide-react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ValidationIssue } from "@/lib/validation";

export default function RightPanel({
  config,
  onReset,
  validationIssues = [],
  selectedUnit,
  onPatchUnit,
}: {
  config: Config;
  onReset: () => void;
  validationIssues?: ValidationIssue[];
  selectedUnit?: Unit | null;
  onPatchUnit?: (patch: Partial<Unit>) => void;
}) {
  const lines = billOfMaterials(config);
  const total = totalPrice(config);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <section className="panel-card p-4">
        <div className="mb-3 flex items-center gap-2">
          {validationIssues.some((issue) => issue.severity === "error") ? (
            <AlertTriangle className="size-4 text-destructive" />
          ) : (
            <CheckCircle2 className="size-4 text-primary" />
          )}
          <h2 className="label-eyebrow">
            {validationIssues.length ? "Review design" : "Design ready"}
          </h2>
        </div>
        {validationIssues.length ? (
          <ul className="space-y-2 text-xs text-muted-foreground">
            {validationIssues.map((issue) => (
              <li key={issue.id} className={issue.severity === "error" ? "text-destructive" : ""}>
                {issue.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            Your current configuration can be saved and exported.
          </p>
        )}
      </section>
      {selectedUnit && onPatchUnit && (
        <section className="panel-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="label-eyebrow">Selected cabinet</h2>
            <span className="text-[10px] text-muted-foreground">Live properties</span>
          </div>
          <div className="mb-3 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-foreground">
            {selectedUnit.name || "Cabinet"}
          </div>
          <label className="mb-3 block text-xs text-muted-foreground">
            Name
            <input
              value={selectedUnit.name ?? ""}
              placeholder="Cabinet name"
              onChange={(event) => onPatchUnit({ name: event.target.value })}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["w", "h", "d", "rot"] as const).map((field) => (
              <label key={field} className="text-xs capitalize text-muted-foreground">
                {field === "w"
                  ? "Width"
                  : field === "h"
                    ? "Height"
                    : field === "d"
                      ? "Depth"
                      : "Rotation"}
                <div className="mt-1 flex items-center gap-1 rounded-lg border border-border bg-background px-2">
                  <input
                    type="number"
                    value={selectedUnit[field]}
                    min={field === "rot" ? -360 : 20}
                    max={field === "rot" ? 360 : field === "h" ? 300 : field === "d" ? 90 : 300}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (!Number.isFinite(value)) return;
                      onPatchUnit({ [field]: Math.round(value) } as Partial<Unit>);
                    }}
                    className="h-8 min-w-0 flex-1 bg-transparent text-sm tabular-nums text-foreground outline-none"
                  />
                  <span className="text-[10px]">{field === "rot" ? "°" : "cm"}</span>
                </div>
              </label>
            ))}
          </div>
        </section>
      )}
      <section className="panel-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <Receipt className="size-4 text-primary" />
          <h2 className="label-eyebrow">Bill of Materials</h2>
        </div>
        <div className="space-y-2">
          {lines.map((l) => (
            <div key={l.key} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <div className="font-medium text-foreground">{l.label}</div>
                <div className="text-[11px] text-muted-foreground">
                  {l.sku ?? "CUSTOM"} · {l.qty} × €{l.unit.toFixed(2)}
                </div>
              </div>
              <div className="tabular-nums font-medium text-foreground">
                €{(l.qty * l.unit).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
        <Separator className="my-4" />
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <dt>Sections</dt>
            <dd className="tabular-nums">
              {walls(config).reduce((s, w) => s + bayCountOf(config, w), 0)}
            </dd>
          </div>
          {walls(config).map((w) => {
            const s = wallSpec(config, w);
            return (
              <div key={w} className="flex justify-between text-muted-foreground">
                <dt>{wallLabel(config.roomShape, w)}</dt>
                <dd className="tabular-nums">
                  {runWidth(config, w)} × {s.depth} × {s.height} cm
                </dd>
              </div>
            );
          })}
          <div className="flex justify-between text-muted-foreground">
            <dt>Parts</dt>
            <dd className="tabular-nums">{lines.reduce((s, l) => s + l.qty, 0)}</dd>
          </div>
        </dl>
        <Separator className="my-4" />
        <div className="flex items-end justify-between">
          <span className="text-sm font-medium text-foreground">Total</span>
          <span className="font-display text-2xl font-semibold tabular-nums text-primary">
            €{total.toFixed(2)}
          </span>
        </div>
      </section>

      <section className="panel-card p-4">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Truck className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>Flat-pack delivery in 3–5 working days. Assembly hardware included.</p>
        </div>
      </section>

      <Button variant="outline" className="w-full gap-2" onClick={onReset}>
        <RotateCcw className="size-4" />
        Clear all &amp; reset
      </Button>
    </div>
  );
}
