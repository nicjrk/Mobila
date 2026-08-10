import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRESET_CATEGORIES, type PresetCategory } from "@/lib/presets";
import type { Unit } from "@/lib/wardrobe";

/** Modal for naming a cabinet before it is stored in the preset library. */
export default function SavePresetDialog({
  unit,
  open,
  onOpenChange,
  onSave,
}: {
  unit: Unit | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (name: string, category: PresetCategory) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<PresetCategory>(PRESET_CATEGORIES[0]);

  useEffect(() => {
    if (open) setName(unit?.name ?? "Custom cabinet");
  }, [open, unit?.name]);

  const submit = () => {
    if (!name.trim()) return;
    onSave(name.trim(), category);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Save cabinet to presets</DialogTitle>
          <DialogDescription>
            Stores the complete configuration — dimensions, fronts, materials, handles and interior
            fittings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="preset-name">Custom name</Label>
            <Input
              id="preset-name"
              value={name}
              autoFocus
              placeholder="e.g. Glass door + 4 drawers"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    category === c
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {unit && (
            <p className="text-xs text-muted-foreground">
              {unit.w}×{unit.h}×{unit.d} cm · {unit.front} front
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim()}>
            Save preset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
