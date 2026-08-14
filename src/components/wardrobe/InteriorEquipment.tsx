import { Button } from "@/components/ui/button";
import { ITEM_META, type ItemType } from "@/lib/wardrobe";
import {
  Rows3,
  Shirt,
  Archive,
  Grid2x2,
  Lightbulb,
  Refrigerator,
  PanelRightOpen,
  Trash2,
} from "lucide-react";

export const ITEM_ICONS: Record<ItemType, typeof Rows3> = {
  shelf: Rows3,
  rail: Shirt,
  drawer: Archive,
  basket: Grid2x2,
  light: Lightbulb,
  fridge: Refrigerator,
  washer: Refrigerator,
  oven: Refrigerator,
  microwave: Refrigerator,
  dishwasher: Refrigerator,
  hob: Refrigerator,
  sink: Refrigerator,
  extractor: Refrigerator,
  cargo: PanelRightOpen,
};

/** One placed accessory, as rendered in the list. */
export type EquipmentItem = { id: string; type: ItemType; y: number; x?: number; height?: number };

/** Legacy types (e.g. shoe racks) still get a readable label. */
const itemName = (t: ItemType) => ITEM_META[t]?.name ?? String(t);

/**
 * The single interior / accessories editor used by BOTH Straight Wall and
 * Modular Assembly. Straight Wall passes the items of the active bay, Modular
 * Assembly passes the fittings of the selected cabinet — the UI and behaviour
 * are identical in both places.
 */
export default function InteriorEquipment({
  items,
  types,
  onAdd,
  onRemove,
  onSelect,
  selectedId,
  contentsLabel,
  note,
  children,
  actions,
}: {
  items: EquipmentItem[];
  /** Accessory types offered as add buttons, in order. */
  types: ItemType[];
  onAdd: (type: ItemType) => void;
  onRemove: (id: string) => void;
  onSelect?: (id: string) => void;
  selectedId?: string | null;
  contentsLabel: string;
  note?: React.ReactNode;
  /** Optional target picker (bay tabs in Straight Wall). */
  children?: React.ReactNode;
  /** Optional per-item extra controls (height field, nudge arrows). */
  actions?: (item: EquipmentItem) => React.ReactNode;
}) {
  return (
    <>
      {children}
      <div className="grid grid-cols-2 gap-2">
        {types.map((t) => {
          const Icon = ITEM_ICONS[t];
          return (
            <Button
              key={t}
              variant="outline"
              size="sm"
              className={`justify-start gap-2 ${["fridge", "washer", "dishwasher"].includes(t) ? "col-span-2" : ""}`}
              onClick={() => onAdd(t)}
            >
              <Icon className="size-4 text-primary" />
              <span className="text-xs">{itemName(t)}</span>
            </Button>
          );
        })}
      </div>
      {note}
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">
          {contentsLabel} ({items.length})
        </div>
        {items.length === 0 && <p className="text-xs text-muted-foreground">Empty section.</p>}
        {items
          .slice()
          .sort((a, b) => b.y - a.y)
          .map((i) => (
            <div
              key={i.id}
              className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs ${
                selectedId === i.id ? "bg-accent ring-1 ring-primary" : "bg-secondary"
              }`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-foreground"
                onClick={() => onSelect?.(i.id)}
              >
                {itemName(i.type)} · {Math.round(i.y * 10) / 10} cm
              </button>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                {actions?.(i)}
                <button
                  type="button"
                  aria-label="Remove item"
                  title="Delete item"
                  onClick={() => onRemove(i.id)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
      </div>
    </>
  );
}
