import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  FINISHES,
  DOOR_STYLES,
  DOOR_MATERIALS,
  HANDLE_ALIGNS,
  HANDLE_STYLES,
  HANDLE_SIDES,
  PRIMARY_WORKSPACES,
  DOOR_MODES,
  MODULE_TYPES,
  ITEM_META,
  bayCountOf,
  bayWidths,
  doorKey,
  doorMaterialOf,
  fridgeBay,
  handleOf,
  addColumn,
  removeColumn,
  setColWidth,
  enableGrid,
  disableGrid,
  gridCells,
  isGrid,
  moduleOf,
  setModule,
  cellKey,
  setSplit,
  splitOf,
  colHeight,
  colDepth,
  setColHeight,
  setColDepth,
  nextFreeY,
  newId,
  runWidth,
  doorModeOf,
  doorPartsOf,
  enterModular,
  enterUnderStairs,
  slopeAngle,
  slopeOf,
  setSlopeAngle,
  setWallSpec,
  setWallWidth,
  wallSpec,
  walls,
  wallLabel,
  type Config,
  type ItemType,
  type WallId,
} from "@/lib/wardrobe";
import type { DoorSel } from "@/components/wardrobe/Scene";
import InteriorEquipment from "@/components/wardrobe/InteriorEquipment";
import {
  Rows3,
  Shirt,
  Archive,
  Grid2x2,
  Lightbulb,
  Refrigerator,
  Ruler,
  Palette,
  DoorClosed,
  PackagePlus,
  Trash2,
  LayoutPanelLeft,
  SquareStack,
  Columns3,
  PanelRightOpen,
  TriangleRight,
  Grid3x3,
  Plus,
} from "lucide-react";

function Field({
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
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={value}
            min={min}
            max={max}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
            }}
            className="h-8 w-20 text-right text-sm"
          />
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={(v) => onChange(v[0] ?? value)}
      />
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Ruler;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h2 className="label-eyebrow">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export default function LeftPanel({
  config,
  setConfig,
  activeWall,
  activeBay,
  setActive,
  doorSel,
  setDoorSel,
  onEnterAssembly,
}: {
  config: Config;
  setConfig: (fn: (c: Config) => Config) => void;
  activeWall: WallId;
  activeBay: number;
  setActive: (wall: WallId, bay: number) => void;
  doorSel: DoorSel;
  setDoorSel: (d: DoorSel) => void;
  onEnterAssembly?: () => void;
}) {
  const wallList = walls(config);
  const us = config.roomShape === "understairs";
  // Under-Stairs stays one focused workflow even after an optional straight
  // companion cabinet is added. Adding the cabinet must not switch the panel
  // into the multi-wall editor.
  const multi = config.roomShape !== "straight" && !us;
  const [layoutExpanded, setLayoutExpanded] = useState(false);
  const activeWorkspace = config.roomShape === "understairs" ? "understairs" : "modular";
  const activeLayout = PRIMARY_WORKSPACES.find((layout) => layout.id === activeWorkspace)!;
  const spec = wallSpec(config, activeWall);
  const wallName = wallLabel(config.roomShape, activeWall);
  const bays = bayCountOf(config, activeWall);
  const widths = bayWidths(config, activeWall);
  const fridge = fridgeBay(config, activeWall);
  const grid = isGrid(config, activeWall);
  const dimensionMinHeight = us && activeWall === "b" ? 40 : 180;

  const addItem = (type: ItemType) => {
    if (type === "fridge") {
      if (fridge !== null) {
        toast.error("This section already has a built-in fridge");
        return;
      }
      if (bays < 2) {
        toast.error("Increase the width to at least two sections for a fridge cabinet");
        return;
      }
      setConfig((c) => {
        const prepared = isGrid(c, activeWall) ? c : enableGrid(c, activeWall);
        return {
          ...setModule(prepared, activeWall, activeBay, 0, "open"),
          items: [
            ...c.items.filter((i) => !(i.wall === activeWall && i.bay === activeBay)),
            { id: newId(), wall: activeWall, bay: activeBay, type, y: 4 },
          ],
        };
      });
      toast.success(`Section ${activeBay + 1} set to 60 cm; back panel removed`);
      return;
    }
    if (fridge === activeBay && type !== "shelf" && type !== "light") {
      toast.error("The fridge section cannot receive accessories");
      return;
    }
    setConfig((c) => ({
      ...c,
      items: [
        ...c.items,
        {
          id: newId(),
          wall: activeWall,
          bay: activeBay,
          type,
          y: nextFreeY(c, activeWall, activeBay, type),
          ...(type === "drawer" ? { height: ITEM_META.drawer.height } : {}),
        },
      ],
    }));
  };

  const slope = slopeOf(config, activeWall);
  const angle = slopeAngle(config, activeWall);
  const setSlope = (patch: Partial<typeof slope>) =>
    setConfig((c) =>
      setWallSpec(c, activeWall, { slope: { ...slopeOf(c, activeWall), ...patch } }),
    );

  // This action is intentionally independent from the button component/style.
  // It only creates the straight companion run and never changes roomShape or
  // navigates to another editor.
  const addStraightUnit = () => {
    setConfig((c) => {
      const currentCount = Math.max(0, c.underStairsExtraUnits ?? (c.underStairsExtraRun ? 1 : 0));
      const currentUnitWidth =
        currentCount > 0 ? Math.max(30, Math.round(c.wallB / currentCount)) : Math.max(30, c.wallB);
      const nextCount = currentCount + 1;
      const nextWidths = Array.from({ length: nextCount }, () => currentUnitWidth);
      const nextWallB = nextWidths.reduce((sum, width) => sum + width, 0);
      const nextModules = { ...c.modules };
      const nextSplits = { ...c.splits };

      // A companion unit is a simple straight cabinet: one full-height door
      // per unit. Remove the old Under-Stairs preset split (b0:84) and any
      // legacy upper-module entries before rebuilding the companion run.
      Object.keys(nextSplits).forEach((key) => {
        if (/^b\d+$/.test(key)) delete nextSplits[key];
      });
      Object.keys(nextModules).forEach((key) => {
        if (/^b\d+:1$/.test(key)) delete nextModules[key];
      });
      nextWidths.forEach((_, index) => {
        const hasEquipment = c.items.some((item) => item.wall === "b" && item.bay === index);
        nextModules[`b${index}:0`] = hasEquipment ? "open" : "door";
      });
      const next = {
        ...c,
        underStairsExtraRun: true,
        underStairsExtraUnits: nextCount,
        wallB: nextWallB,
        wallSpecs: {
          ...c.wallSpecs,
          b: {
            height: c.wallSpecs.b?.height ?? 168,
            depth: c.wallSpecs.b?.depth ?? 80,
            finish: c.wallSpecs.b?.finish ?? c.finish,
            doorStyle: c.wallSpecs.b?.doorStyle ?? c.doorStyle,
            slope: { on: false, side: "right" as const, maxHeight: 168, minHeight: 168 },
          },
        },
        colWidths: { ...c.colWidths, b: nextWidths },
        splits: nextSplits,
        modules: nextModules,
      };
      return next;
    });
    // Select the newly created companion unit so its interior equipment and
    // front can be customized immediately from the same Under-Stairs panel.
    const createdBay = Math.max(0, config.underStairsExtraUnits ?? 0);
    setActive("b", createdBay);
    setDoorSel({ wall: "b", bay: createdBay, part: 0 });
    toast.success("Straight unit added — customize its contents below");
  };

  const bayItems = config.items.filter((i) => i.wall === activeWall && i.bay === activeBay);
  const selMaterial = doorSel ? doorMaterialOf(config, doorSel.wall, doorSel.bay) : "solid";
  const selHandle = doorSel ? handleOf(config, doorSel.wall, doorSel.bay) : null;
  const setHandle = (
    patch: Partial<{
      side: (typeof HANDLE_SIDES)[number]["id"];
      align: (typeof HANDLE_ALIGNS)[number]["id"];
      style: (typeof HANDLE_STYLES)[number]["id"];
      position: number;
    }>,
  ) => {
    if (!doorSel) return;
    const key = doorKey(doorSel.wall, doorSel.bay);
    setConfig((c) => ({
      ...c,
      doorHandles: {
        ...c.doorHandles,
        [key]: { ...handleOf(c, doorSel.wall, doorSel.bay), ...patch },
      },
    }));
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <Section icon={LayoutPanelLeft} title="Room Layout">
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-accent/60 p-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">{activeLayout.name}</div>
            <div className="text-[11px] text-muted-foreground">{activeLayout.desc}</div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLayoutExpanded((expanded) => !expanded)}
          >
            {layoutExpanded ? "Done" : "Change layout"}
          </Button>
        </div>
        {layoutExpanded && (
          <div className="space-y-3 rounded-xl border border-border bg-card/50 p-2">
            <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Choose a room shape
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PRIMARY_WORKSPACES.map((o) => (
                <button
                  key={o.id}
                  onClick={() => {
                    if (o.id === "modular") onEnterAssembly?.();
                    setConfig((c) =>
                      o.id === "understairs" ? enterUnderStairs(c) : enterModular(c),
                    );
                    setActive("a", 0);
                    setDoorSel(null);
                    setLayoutExpanded(false);
                  }}
                  className={`rounded-md border p-2 text-left transition-colors ${
                    activeWorkspace === o.id
                      ? "border-primary bg-accent"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  <div className="text-sm font-medium text-foreground">{o.name}</div>
                  <div className="text-[11px] text-muted-foreground">{o.desc}</div>
                </button>
              ))}
            </div>
            <p className="px-1 text-[11px] text-muted-foreground">
              The workspace is focused on either sloped/triangular cabinets or free modular
              assembly. Older room layouts remain readable for compatibility.
            </p>
          </div>
        )}
        {config.roomShape === "lshape" && (
          <p className="rounded-md border border-dashed border-border p-2 text-[11px] text-muted-foreground">
            A <strong className="text-foreground">Smart Corner Unit</strong> (
            {wallSpec(config, "b").depth} × {wallSpec(config, "a").depth} cm) adapts to the depth
            and height of both walls, so segments with different sizes still join seamlessly.
          </p>
        )}
        {config.roomShape === "ushape" && (
          <p className="rounded-md border border-dashed border-border p-2 text-[11px] text-muted-foreground">
            Walk-in U layout: a back wall plus two independent returns, each with its own length.
          </p>
        )}
        {config.roomShape === "galley" && (
          <p className="rounded-md border border-dashed border-border p-2 text-[11px] text-muted-foreground">
            Two facing runs with an adjustable walkway between them.
          </p>
        )}
        {us && (
          <p className="rounded-md border border-dashed border-primary/50 bg-accent p-2 text-[11px] text-foreground">
            Standalone <strong>Under-Stairs Cabinet</strong>: a closed sloped enclosure (base, back,
            sides and pitched ceiling board) divided into equal step modules. Switching mode starts
            from a clean canvas, so nothing floats in mid-air.
          </p>
        )}
      </Section>

      {multi && (
        <Section icon={Columns3} title="Wall Segments">
          <div className="flex flex-wrap gap-2">
            {wallList.map((w) => {
              const s = wallSpec(config, w);
              const on = activeWall === w;
              return (
                <button
                  key={w}
                  onClick={() => {
                    setActive(w, 0);
                    setDoorSel(null);
                  }}
                  className={`flex-1 rounded-md border px-2 py-2 text-left transition-colors ${
                    on ? "border-primary bg-accent" : "border-border hover:bg-secondary"
                  }`}
                >
                  <div className="text-xs font-semibold text-foreground">
                    {wallLabel(config.roomShape, w)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {runWidth(config, w)} × {s.height} × {s.depth} cm
                  </div>
                </button>
              );
            })}
          </div>
          <p className="rounded-md border border-dashed border-border p-2 text-[11px] text-muted-foreground">
            Every segment is a separate cabinet run: dimensions, finish, door style and interior
            modules below apply only to <strong className="text-foreground">{wallName}</strong>.
            Other walls keep their own build.
          </p>
        </Section>
      )}

      <Section icon={Ruler} title={multi ? `Dimensions · ${wallName}` : "Dimensions"}>
        <Field
          label={multi ? `${wallName} length` : "Width"}
          value={runWidth(config, activeWall)}
          min={50}
          max={300}
          onChange={(v) => setConfig((c) => setWallWidth(c, activeWall, v))}
        />
        {config.roomShape === "galley" && (
          <Field
            label="Walkway between runs"
            value={config.aisle}
            min={80}
            max={300}
            onChange={(v) => setConfig((c) => ({ ...c, aisle: v }))}
          />
        )}
        <Field
          label="Height"
          value={spec.height}
          min={dimensionMinHeight}
          max={280}
          onChange={(v) => setConfig((c) => setWallSpec(c, activeWall, { height: v }))}
        />
        <Field
          label="Depth"
          value={spec.depth}
          min={35}
          max={70}
          onChange={(v) => setConfig((c) => setWallSpec(c, activeWall, { depth: v }))}
        />
        <label className="flex cursor-pointer items-center justify-between rounded-md bg-secondary px-3 py-2">
          <span className="text-sm text-foreground">Show dimensions in 3D</span>
          <Switch
            checked={config.showDimensions}
            onCheckedChange={(v) => setConfig((c) => ({ ...c, showDimensions: v }))}
          />
        </label>
      </Section>

      {grid && (!us || activeWall === "b") && (
        <Section
          icon={Grid3x3}
          title={multi ? `Modular Grid · ${wallName}` : "Modular Grid Builder"}
        >
          <label className="flex cursor-pointer items-center justify-between rounded-md bg-secondary px-3 py-2">
            <span className="text-sm text-foreground">
              {us ? "Editable under-stairs compartments" : "Custom columns &amp; stacked modules"}
            </span>
            <Switch
              checked={grid}
              disabled={us && activeWall === "a"}
              onCheckedChange={(v) =>
                setConfig((c) => (v ? enableGrid(c, activeWall) : disableGrid(c, activeWall)))
              }
            />
          </label>
          {grid && (
            <>
              <div className="space-y-3">
                {Array.from({ length: bays }, (_, col) => {
                  const cells = gridCells(config, activeWall, col);
                  const split = splitOf(config, activeWall, col);
                  const cHeight = colHeight(config, activeWall, col);
                  const cDepth = colDepth(config, activeWall, col);
                  return (
                    <div key={col} className="rounded-md border border-border p-2.5">
                      <div className="mb-2 flex items-center justify-between">
                        <button
                          onClick={() => setActive(activeWall, col)}
                          className={`rounded px-2 py-0.5 text-xs font-semibold transition-colors ${
                            activeBay === col
                              ? "bg-primary text-primary-foreground"
                              : "text-foreground hover:bg-secondary"
                          }`}
                        >
                          Column {col + 1}
                        </button>
                        <button
                          aria-label="Remove column"
                          disabled={bays <= 1}
                          onClick={() => {
                            setConfig((c) => removeColumn(c, activeWall, col));
                            setActive(activeWall, 0);
                            setDoorSel(null);
                          }}
                          className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-30"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <Field
                        label="Width"
                        value={Math.round(widths[col] ?? 60)}
                        min={20}
                        max={150}
                        onChange={(v) => setConfig((c) => setColWidth(c, activeWall, col, v))}
                      />
                      <Field
                        label="Height"
                        value={cHeight}
                        min={40}
                        max={300}
                        onChange={(v) => setConfig((c) => setColHeight(c, activeWall, col, v))}
                      />
                      <Field
                        label="Depth"
                        value={cDepth}
                        min={20}
                        max={90}
                        onChange={(v) => setConfig((c) => setColDepth(c, activeWall, col, v))}
                      />
                      <label className="mt-2 flex cursor-pointer items-center justify-between rounded-md bg-secondary px-2.5 py-1.5">
                        <span className="text-xs text-foreground">Horizontal split</span>
                        <Switch
                          checked={split !== null}
                          onCheckedChange={(v) =>
                            setConfig((c) =>
                              setSplit(
                                c,
                                activeWall,
                                col,
                                v ? Math.round(colHeight(c, activeWall, col) * 0.4) : null,
                              ),
                            )
                          }
                        />
                      </label>
                      {split !== null && (
                        <div className="mt-2">
                          <Field
                            label="Split height"
                            value={split}
                            min={20}
                            max={Math.max(25, cHeight - 20)}
                            onChange={(v) => setConfig((c) => setSplit(c, activeWall, col, v))}
                          />
                        </div>
                      )}
                      <div className="mt-2 space-y-2">
                        {cells
                          .slice()
                          .reverse()
                          .map((cell) => (
                            <div key={cell.level}>
                              <div className="mb-1 text-[11px] text-muted-foreground">
                                {cells.length === 1
                                  ? `Full height · ${Math.round(cell.h)} cm`
                                  : cell.level === 0
                                    ? `Base module · ${Math.round(cell.h)} cm`
                                    : `Upper module · ${Math.round(cell.h)} cm`}
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                {MODULE_TYPES.map((m) => (
                                  <button
                                    key={m.id}
                                    title={m.desc}
                                    onClick={() =>
                                      setConfig((c) =>
                                        setModule(c, activeWall, col, cell.level, m.id),
                                      )
                                    }
                                    className={`rounded-md border px-2 py-1.5 text-left text-[11px] font-medium transition-colors ${
                                      moduleOf(config, activeWall, col, cell.level) === m.id
                                        ? "border-primary bg-accent text-foreground"
                                        : "border-border text-foreground hover:bg-secondary"
                                    }`}
                                  >
                                    {m.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => setConfig((c) => addColumn(c, activeWall))}
              >
                <Plus className="size-4" />
                Add column
              </Button>
              <p className="rounded-md border border-dashed border-border p-2 text-[11px] text-muted-foreground">
                Total width is the sum of the columns:{" "}
                {us &&
                  "Choose drawers, doors or an open interior for every compartment. Use Horizontal split for drawers below and a shelf/open space above. "}
                <strong className="text-foreground">{runWidth(config, activeWall)} cm</strong>. Each
                cell can be a door, a glass vitrine, a drawer stack or an open niche, and every cell
                gets its own width / height dimension line in the 3D view.
              </p>
            </>
          )}
        </Section>
      )}

      <Section
        icon={TriangleRight}
        title={
          us ? "Under-Stairs Cabinet" : multi ? `Under-Stairs · ${wallName}` : "Under-Stairs Mode"
        }
      >
        {us && (
          <div className="space-y-2">
            <button
              type="button"
              className={`flex w-full items-center justify-start gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                config.underStairsExtraRun
                  ? "border-primary bg-secondary text-foreground"
                  : "border-border bg-background text-foreground hover:bg-secondary"
              }`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                addStraightUnit();
              }}
            >
              <Plus className="size-4" />
              {config.underStairsExtraRun
                ? "Add another unit beside stairs"
                : "Add unit beside stairs"}
            </button>
            <p className="text-[11px] text-muted-foreground">
              Adds a complete straight cabinet unit beside the stairs. Its width, height, depth,
              finish and door style remain editable. Each added unit starts with one full-height
              door.
            </p>
            {config.underStairsExtraRun && (
              <div className="space-y-4 rounded-md border border-primary/30 bg-accent/40 p-3">
                <div className="text-xs font-semibold text-foreground">
                  Straight units ({config.underStairsExtraUnits ?? 1})
                </div>
                <Field
                  label="Unit width"
                  value={Math.round(config.wallB / Math.max(1, config.underStairsExtraUnits ?? 1))}
                  min={30}
                  max={300}
                  onChange={(v) => {
                    const count = Math.max(1, config.underStairsExtraUnits ?? 1);
                    const widths = Array.from({ length: count }, () => v);
                    setConfig((c) => ({
                      ...c,
                      wallB: widths.reduce((sum, width) => sum + width, 0),
                      colWidths: { ...c.colWidths, b: widths },
                    }));
                  }}
                />
                <Field
                  label="Unit height"
                  value={wallSpec(config, "b").height}
                  min={40}
                  max={280}
                  onChange={(v) => setConfig((c) => setWallSpec(c, "b", { height: v }))}
                />
                <Field
                  label="Unit depth"
                  value={wallSpec(config, "b").depth}
                  min={35}
                  max={80}
                  onChange={(v) => setConfig((c) => setWallSpec(c, "b", { depth: v }))}
                />
              </div>
            )}
          </div>
        )}
        {!us && (
          <label className="flex cursor-pointer items-center justify-between rounded-md bg-secondary px-3 py-2">
            <span className="text-sm text-foreground">Sloped ceiling (under stairs)</span>
            <Switch checked={slope.on} onCheckedChange={(v) => setSlope({ on: v })} />
          </label>
        )}
        {us && (
          <>
            {config.underStairsExtraRun && (
              <div>
                <div className="mb-2 text-[11px] text-muted-foreground">Editing cabinet run</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActive("a", 0)}
                    className={`rounded-md border px-2 py-1.5 text-[11px] font-medium ${
                      activeWall === "a"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-foreground hover:bg-secondary"
                    }`}
                  >
                    Under stairs
                  </button>
                  <button
                    type="button"
                    onClick={() => setActive("b", 0)}
                    className={`rounded-md border px-2 py-1.5 text-[11px] font-medium ${
                      activeWall === "b"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-foreground hover:bg-secondary"
                    }`}
                  >
                    Straight side run
                  </button>
                </div>
              </div>
            )}
            {activeWall === "a" && (
              <Field
                label="Step modules"
                value={Math.max(2, Math.min(6, config.usModules))}
                min={2}
                max={6}
                unit="mod"
                onChange={(v) => setConfig((c) => ({ ...c, usModules: v }))}
              />
            )}
          </>
        )}
        {slope.on && (
          <>
            <div>
              <div className="mb-1 text-[11px] text-muted-foreground">Tall side</div>
              <div className="grid grid-cols-2 gap-1.5">
                {(["left", "right"] as const).map((sd) => (
                  <button
                    key={sd}
                    onClick={() => setSlope({ side: sd })}
                    className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                      slope.side === sd
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-foreground hover:bg-secondary"
                    }`}
                  >
                    Max height {sd}
                  </button>
                ))}
              </div>
            </div>
            <Field
              label="Max height"
              value={slope.maxHeight}
              min={80}
              max={spec.height}
              onChange={(v) => setSlope({ maxHeight: v })}
            />
            <Field
              label="Min height"
              value={slope.minHeight}
              min={40}
              max={Math.max(45, slope.maxHeight - 5)}
              onChange={(v) => setSlope({ minHeight: v })}
            />
            {!us && (
              <Field
                label="Total length"
                value={runWidth(config, activeWall)}
                min={50}
                max={300}
                onChange={(v) => setConfig((c) => setWallWidth(c, activeWall, v))}
              />
            )}
            {!us && (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-foreground">Slope angle</span>
                  <span className="text-sm tabular-nums text-foreground">{angle}°</span>
                </div>
                <Slider
                  value={[Math.min(60, Math.max(5, angle))]}
                  min={5}
                  max={60}
                  step={1}
                  onValueChange={(v) =>
                    setConfig((c) => setSlopeAngle(c, activeWall, v[0] ?? angle))
                  }
                />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>5°</span>
                  <span>60°</span>
                </div>
              </div>
            )}
            {!us && (
              <p className="rounded-md border border-dashed border-primary/50 bg-accent p-2 text-[11px] text-foreground">
                Top panels and door leaves are sliced at {angle}° ({slope.maxHeight} →{" "}
                {slope.minHeight} cm). Handles and hinges shift down automatically to clear the
                angled edge, and every cut is listed in the bill of materials.
              </p>
            )}
          </>
        )}
      </Section>

      <Section icon={Palette} title={multi ? `Frame Finish · ${wallName}` : "Frame Finish"}>
        <div className="grid grid-cols-2 gap-2">
          {FINISHES.map((f) => (
            <button
              key={f.id}
              onClick={() => setConfig((c) => setWallSpec(c, activeWall, { finish: f.id }))}
              className={`flex items-center gap-2 rounded-md border p-2 text-left transition-colors ${
                spec.finish === f.id
                  ? "border-primary bg-accent"
                  : "border-border hover:bg-secondary"
              }`}
            >
              <span
                className="size-6 shrink-0 rounded-full border border-border"
                style={{ backgroundColor: f.swatch }}
              />
              <span className="text-xs leading-tight text-foreground">{f.name}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section icon={DoorClosed} title={multi ? `Doors · ${wallName}` : "Doors"}>
        <div className="grid gap-2">
          {DOOR_STYLES.map((d) => (
            <button
              key={d.id}
              onClick={() => setConfig((c) => setWallSpec(c, activeWall, { doorStyle: d.id }))}
              className={`rounded-md border p-2 text-left transition-colors ${
                spec.doorStyle === d.id
                  ? "border-primary bg-accent"
                  : "border-border hover:bg-secondary"
              }`}
            >
              <div className="text-sm font-medium text-foreground">{d.name}</div>
              <div className="text-[11px] text-muted-foreground">{d.desc}</div>
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center justify-between rounded-md bg-secondary px-3 py-2">
          <span className="text-sm text-foreground">Show Doors</span>
          <Switch
            checked={config.showDoors}
            onCheckedChange={(v) => setConfig((c) => ({ ...c, showDoors: v }))}
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between rounded-md bg-secondary px-3 py-2">
          <span className="text-sm text-foreground">
            Open Doors{" "}
            <span className="text-muted-foreground">({config.openDoors ? "90°" : "0°"})</span>
          </span>
          <Switch
            checked={config.openDoors}
            onCheckedChange={(v) => setConfig((c) => ({ ...c, openDoors: v }))}
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between rounded-md bg-secondary px-3 py-2">
          <span className="text-sm text-foreground">Open drawers</span>
          <Switch
            checked={config.openDrawers ?? false}
            onCheckedChange={(v) => setConfig((c) => ({ ...c, openDrawers: v }))}
          />
        </label>
        <p className="rounded-md border border-dashed border-border p-2 text-[11px] text-muted-foreground">
          Auto door widths ({wallName}):{" "}
          <strong className="text-foreground">
            {widths.map((w) => `${w.toFixed(1)}`).join(" · ")} cm
          </strong>
        </p>
      </Section>

      <Section icon={SquareStack} title="Individual Door Customization">
        <div className="space-y-2">
          {wallList.map((w) => (
            <div key={w}>
              {config.roomShape !== "straight" && (
                <div className="mb-1 text-xs text-muted-foreground">
                  {wallLabel(config.roomShape, w)}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: bayCountOf(config, w) }, (_, i) => {
                  const mat = DOOR_MATERIALS.find((m) => m.id === doorMaterialOf(config, w, i))!;
                  const levels = isGrid(config, w)
                    ? gridCells(config, w, i)
                        .map((cell) => cell.level)
                        .reverse()
                    : [0];
                  return levels.map((level) => {
                    const active =
                      doorSel?.wall === w && doorSel.bay === i && (doorSel.part ?? 0) === level;
                    const open =
                      isGrid(config, w) &&
                      (moduleOf(config, w, i, level) === "open" ||
                        !!config.openCells?.[cellKey(w, i, level)]);
                    return (
                      <button
                        key={`${i}-${level}`}
                        onClick={() => setDoorSel({ wall: w, bay: i, part: level })}
                        className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                          active
                            ? "border-primary bg-accent"
                            : "border-border text-foreground hover:bg-secondary"
                        }`}
                      >
                        <span
                          className="size-3.5 rounded-full border border-border"
                          style={{ backgroundColor: open ? "transparent" : mat.swatch }}
                        />
                        {isGrid(config, w)
                          ? `Unit ${i + 1} · ${level === 1 ? "Upper" : "Base"}`
                          : `Door ${i + 1}`}
                      </button>
                    );
                  });
                })}
              </div>
            </div>
          ))}
        </div>
        {!doorSel ? (
          <p className="text-[11px] text-muted-foreground">
            Select a door above or click one directly in the 3D view to change its material.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="text-xs font-medium text-foreground">
              Editing Door {doorSel.bay + 1}
              {config.roomShape !== "straight"
                ? ` · ${wallLabel(config.roomShape, doorSel.wall)}`
                : ""}
            </div>
            <div>
              <div className="mb-1 text-[11px] text-muted-foreground">Front type</div>
              <div className="grid gap-1.5">
                {DOOR_MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() =>
                      setConfig((c) => ({
                        ...c,
                        doorModes: {
                          ...c.doorModes,
                          [doorKey(doorSel.wall, doorSel.bay)]: m.id,
                        },
                      }))
                    }
                    className={`rounded-md border p-2 text-left transition-colors ${
                      doorModeOf(config, doorSel.wall, doorSel.bay) === m.id
                        ? "border-primary bg-accent"
                        : "border-border hover:bg-secondary"
                    }`}
                  >
                    <div className="text-xs font-medium text-foreground">{m.name}</div>
                    <div className="text-[11px] text-muted-foreground">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            {doorModeOf(config, doorSel.wall, doorSel.bay) === "pullout" && (
              <p className="rounded-md border border-dashed border-primary/50 bg-accent p-2 text-[11px] text-foreground">
                Drag the front in the 3D view to pull it out like a drawer. Click it again to close
                it.
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 border-dashed"
              onClick={() => {
                if (!doorSel) return;
                setConfig((c) => {
                  const level = doorSel.part ?? 0;
                  const key = cellKey(doorSel.wall, doorSel.bay, level);
                  const isOpen = moduleOf(c, doorSel.wall, doorSel.bay, level) === "open";
                  const next = setModule(
                    c,
                    doorSel.wall,
                    doorSel.bay,
                    level,
                    isOpen ? "door" : "open",
                  );
                  if (isOpen) {
                    const openCells = { ...(next.openCells ?? {}) };
                    delete openCells[key];
                    return { ...next, openCells };
                  }
                  return { ...next, openCells: { ...next.openCells, [key]: true } };
                });
              }}
            >
              <span className="size-2.5 rounded-full border border-primary" />
              {moduleOf(config, doorSel.wall, doorSel.bay, doorSel.part ?? 0) === "open"
                ? "Restore door"
                : "Open cabinet · no door"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              {moduleOf(config, doorSel.wall, doorSel.bay, doorSel.part ?? 0) === "open"
                ? "Restores a full front door for the selected compartment."
                : "The selected compartment stays completely open so the interior is visible."}
            </p>
            {moduleOf(config, doorSel.wall, doorSel.bay, doorSel.part ?? 0) !== "open" && (
              <div className="rounded-md bg-secondary px-3 py-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-foreground">Horizontal door sections</span>
                  <span className="text-xs text-muted-foreground">
                    {doorPartsOf(config, doorSel.wall, doorSel.bay, doorSel.part ?? 0)} parts
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {Array.from({ length: 6 }, (_, index) => index + 1).map((parts) => {
                    const key = cellKey(doorSel.wall, doorSel.bay, doorSel.part ?? 0);
                    const active =
                      doorPartsOf(config, doorSel.wall, doorSel.bay, doorSel.part ?? 0) === parts;
                    return (
                      <button
                        key={parts}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          setConfig((c) => ({
                            ...c,
                            doorSections: { ...c.doorSections, [key]: parts },
                            doorSplits: { ...c.doorSplits, [key]: parts > 1 },
                          }))
                        }
                        className={`rounded-md border px-2 py-1 text-xs font-medium ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-foreground hover:bg-background"
                        }`}
                      >
                        {parts}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <div className="mb-1 text-[11px] text-muted-foreground">
                Hinge orientation / handle side
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {HANDLE_SIDES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setHandle({ side: s.id })}
                    title={s.desc}
                    className={`rounded-md border px-1.5 py-1.5 text-[11px] font-medium transition-colors ${
                      selHandle?.side === s.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-foreground hover:bg-secondary"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {HANDLE_SIDES.find((s) => s.id === selHandle?.side)?.desc}
              </p>
              {selHandle?.side === "push" && (
                <p className="rounded-md border border-dashed border-primary/50 bg-accent p-2 text-[11px] text-foreground">
                  Push-to-open is active: click the selected door in the 3D view to open or close
                  it.
                </p>
              )}
            </div>
            <div>
              <div className="mb-1 text-[11px] text-muted-foreground">Handle alignment</div>
              <div className="grid grid-cols-2 gap-1.5">
                {HANDLE_ALIGNS.map((a) => {
                  const pullout = doorModeOf(config, doorSel.wall, doorSel.bay) === "pullout";
                  // Sloped doors clamp a top handle below the angled edge, so
                  // every alignment remains selectable and safe.
                  const name = pullout
                    ? a.id === "profile"
                      ? "Centred · vertical"
                      : a.id === "center"
                        ? "Centred · horizontal"
                        : a.name
                    : a.name;
                  if (pullout && (a.id === "top" || a.id === "bottom")) return null;
                  return (
                    <button
                      key={a.id}
                      disabled={selHandle?.side === "push"}
                      onClick={() =>
                        setHandle({
                          align: a.id,
                          position: a.id === "top" ? 85 : a.id === "bottom" ? 15 : 50,
                        })
                      }
                      className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-40 ${
                        selHandle?.align === a.id
                          ? "border-primary bg-accent text-foreground"
                          : "border-border text-foreground hover:bg-secondary"
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              {selHandle?.side !== "push" && (
                <div className="mt-3">
                  <Field
                    label="Custom handle height"
                    value={selHandle?.position ?? 50}
                    min={8}
                    max={92}
                    unit="%"
                    onChange={(v) => setHandle({ position: v, align: "center" })}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    8% = near the bottom · 92% = near the top. The value is clamped safely under the
                    stair slope.
                  </p>
                </div>
              )}
              <div className="mt-3">
                <div className="mb-1 text-[11px] text-muted-foreground">Handle design</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {HANDLE_STYLES.map((h) => (
                    <button
                      key={h.id}
                      disabled={selHandle?.side === "push"}
                      onClick={() => setHandle({ style: h.id })}
                      className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-40 ${
                        (selHandle?.style ?? "bar") === h.id
                          ? "border-primary bg-accent text-foreground"
                          : "border-border text-foreground hover:bg-secondary"
                      }`}
                    >
                      {h.name === "Knob" ? "Round knob" : h.name}
                    </button>
                  ))}
                </div>
              </div>
              {slopeOf(config, doorSel.wall).on && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Under the slope, handles and hinges stay below the mitred top edge — top placement
                  is automatically clamped to a safe position.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              {DOOR_MATERIALS.map((m) => (
                <button
                  key={m.id}
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      doorMaterials: {
                        ...c.doorMaterials,
                        [doorKey(doorSel.wall, doorSel.bay)]: m.id,
                      },
                    }))
                  }
                  className={`flex items-center gap-2 rounded-md border p-2 text-left transition-colors ${
                    selMaterial === m.id
                      ? "border-primary bg-accent"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  <span
                    className="size-6 shrink-0 rounded-full border border-border"
                    style={{ backgroundColor: m.swatch }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{m.name}</span>
                    <span className="block text-[11px] text-muted-foreground">{m.desc}</span>
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {m.price ? `+€${m.price}` : "incl."}
                  </span>
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setDoorSel(null)}>
              Done
            </Button>
          </div>
        )}
      </Section>

      <Section
        icon={PackagePlus}
        title={multi ? `Interior Equipment · ${wallName}` : "Interior Equipment"}
      >
        <InteriorEquipment
          items={bayItems}
          types={Object.keys(ITEM_META) as ItemType[]}
          onAdd={addItem}
          onRemove={(id) => setConfig((c) => ({ ...c, items: c.items.filter((x) => x.id !== id) }))}
          actions={(item) =>
            item.type === "drawer" ? (
              <div className="flex items-center gap-1">
                <Input
                  aria-label="Drawer height"
                  type="number"
                  min={8}
                  max={60}
                  value={item.height ?? ITEM_META.drawer.height}
                  onChange={(e) => {
                    const height = Math.min(
                      60,
                      Math.max(8, Number(e.target.value) || ITEM_META.drawer.height),
                    );
                    setConfig((c) => ({
                      ...c,
                      items: c.items.map((x) => (x.id === item.id ? { ...x, height } : x)),
                    }));
                  }}
                  className="h-7 w-14 px-1 text-right text-xs"
                />
                <span className="text-[10px] text-muted-foreground">cm</span>
              </div>
            ) : null
          }
          contentsLabel={`Section ${activeBay + 1} contents`}
          note={
            <div className="space-y-2">
              {fridge === activeBay && (
                <p className="rounded-md border border-dashed border-primary/50 bg-accent p-2 text-[11px] text-foreground">
                  Fridge cabinet: width locked to 60 cm, back panel removed for ventilation, split
                  fridge/freezer front (70 / 30).
                </p>
              )}
              {(() => {
                const selectedModule = moduleOf(config, activeWall, activeBay, 0);
                const canSplit = selectedModule === "door" || selectedModule === "vitrine";
                return (
                  <div className="rounded-md border border-dashed border-primary/50 bg-accent p-2">
                    <div className="mb-1 text-[11px] font-medium text-foreground">
                      Front customization
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {canSplit
                          ? `Horizontal door sections · ${doorPartsOf(config, activeWall, activeBay, 0)}`
                          : "Select a door module to split it"}
                      </span>
                    </div>
                    {canSplit && (
                      <div className="mt-2 grid grid-cols-6 gap-1">
                        {Array.from({ length: 6 }, (_, index) => index + 1).map((parts) => {
                          const key = cellKey(activeWall, activeBay, 0);
                          const active = doorPartsOf(config, activeWall, activeBay, 0) === parts;
                          return (
                            <button
                              key={parts}
                              type="button"
                              aria-pressed={active}
                              onClick={() =>
                                setConfig((c) => ({
                                  ...c,
                                  doorSections: { ...c.doorSections, [key]: parts },
                                  doorSplits: { ...c.doorSplits, [key]: parts > 1 },
                                }))
                              }
                              className={`rounded-md border px-2 py-1 text-xs font-medium ${
                                active
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border text-foreground hover:bg-background"
                              }`}
                            >
                              {parts}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          }
        >
          <div>
            <div className="mb-2 text-xs text-muted-foreground">Target section</div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: bays }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setActive(activeWall, i);
                    // Selecting an equipment target also selects its front, so
                    // door customization is immediately available below.
                    setDoorSel({ wall: activeWall, bay: i, part: 0 });
                  }}
                  className={`h-9 min-w-9 rounded-md border px-3 text-sm font-medium transition-colors ${
                    activeBay === i
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-foreground hover:bg-secondary"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </InteriorEquipment>
      </Section>
    </div>
  );
}
