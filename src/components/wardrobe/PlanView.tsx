import { useMemo, useRef, useState } from "react";
import { planBounds, planItems, type PlanItem } from "@/lib/plan";
import { ITEM_META, type Config, type WallId } from "@/lib/wardrobe";

const SCALE = 2.4;

export default function PlanView({
  config,
  selectedUnitId,
  activeWall,
  activeBay,
  setActive,
  setConfig,
  setSelectedUnit,
  showGrid = true,
}: {
  config: Config;
  selectedUnitId: string | null;
  activeWall: WallId;
  activeBay: number;
  setActive: (wall: WallId, bay: number) => void;
  setConfig: (fn: (config: Config) => Config) => void;
  setSelectedUnit: (id: string | null) => void;
  showGrid?: boolean;
}) {
  const drag = useRef<{ id: string; startX: number; startZ: number; x: number; z: number } | null>(
    null,
  );
  const [armedId, setArmedId] = useState<string | null>(null);
  const items = useMemo(
    () => planItems(config, selectedUnitId, activeWall, activeBay),
    [config, selectedUnitId, activeWall, activeBay],
  );
  const bounds = useMemo(() => {
    const content = planBounds(items);
    if (config.roomShape !== "modular") return content;
    return {
      minX: Math.min(content.minX, -config.modularRoom.width / 2),
      maxX: Math.max(content.maxX, config.modularRoom.width / 2),
      minZ: Math.min(content.minZ, 0),
      maxZ: Math.max(content.maxZ, config.modularRoom.depth),
    };
  }, [items, config.roomShape, config.modularRoom]);
  const width = (bounds.maxX - bounds.minX) * SCALE;
  const height = (bounds.maxZ - bounds.minZ) * SCALE;
  const toX = (value: number) => (value - bounds.minX) * SCALE;
  const toY = (value: number) => (bounds.maxZ - value) * SCALE;

  const select = (item: PlanItem) => {
    if (item.kind === "unit") setSelectedUnit(item.id);
    else if (item.wall && item.bay != null) setActive(item.wall, item.bay);
  };

  const moveUnit = (item: PlanItem, event: React.PointerEvent<SVGGElement>) => {
    if (config.roomShape !== "modular") return;
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM()?.inverse();
    if (!matrix) return;
    const local = point.matrixTransform(matrix);
    drag.current = {
      id: item.id,
      startX: local.x,
      startZ: local.y,
      x: item.x,
      z: item.z,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    if (!current) return;
    const point = event.currentTarget.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = event.currentTarget.getScreenCTM()?.inverse();
    if (!matrix) return;
    const local = point.matrixTransform(matrix);
    const dx = (local.x - current.startX) / SCALE;
    const dz = -(local.y - current.startZ) / SCALE;
    setConfig((next) => ({
      ...next,
      units: next.units.map((unit) =>
        unit.id === current.id
          ? { ...unit, x: Math.round(current.x + dx), z: Math.round(current.z + dz) }
          : unit,
      ),
    }));
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f6f4f0] p-3">
      <div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-card/90 px-3 py-2 text-xs text-muted-foreground">
        <span>2D Plan · top view</span>
        <span>Click to select · drag modular units to move</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-[#fbfaf7] shadow-inner">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full touch-none"
          onPointerMove={move}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          <defs>
            <pattern
              id="plan-grid"
              width={SCALE * 10}
              height={SCALE * 10}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${SCALE * 10} 0 L 0 0 0 ${SCALE * 10}`}
                fill="none"
                stroke="#e5e0d8"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          {showGrid && <rect width={width} height={height} fill="url(#plan-grid)" />}
          {config.roomShape === "modular" && (
            <rect
              x={toX(-config.modularRoom.width / 2)}
              y={toY(config.modularRoom.depth)}
              width={config.modularRoom.width * SCALE}
              height={config.modularRoom.depth * SCALE}
              fill="#f0ede7"
              fillOpacity="0.45"
              stroke="#777f78"
              strokeWidth="2"
            />
          )}
          {items.map((item) => {
            const selected = item.selected;
            const w = item.width * SCALE;
            const d = item.depth * SCALE;
            const unit =
              item.kind === "unit"
                ? config.units.find((candidate) => candidate.id === item.id)
                : null;
            return (
              <g
                key={item.id}
                transform={`translate(${toX(item.x)}, ${toY(item.z)}) rotate(${(-item.rotation * 180) / Math.PI})`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  if (armedId === item.id) moveUnit(item, event);
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  setArmedId(item.id);
                  select(item);
                }}
                className="cursor-pointer"
              >
                <rect
                  x={-w / 2}
                  y={-d / 2}
                  width={w}
                  height={d}
                  rx={4}
                  fill={item.kind === "unit" ? "#d9e9de" : "#e8e1d6"}
                  stroke={selected ? "#2f6d5a" : "#8d9b91"}
                  strokeWidth={selected ? 3 : 1.5}
                />
                {unit?.appliances?.map((appliance) => {
                  const applianceWidth = ["fridge", "washer", "oven", "dishwasher"].includes(
                    appliance.type,
                  )
                    ? Math.min(unit.w - 4, 56)
                    : 42;
                  const applianceDepth =
                    appliance.type === "sink" || appliance.type === "hob" ? 42 : 54;
                  return (
                    <g key={appliance.id}>
                      <rect
                        x={(appliance.x ?? 0) * SCALE - (applianceWidth * SCALE) / 2}
                        y={-(applianceDepth * SCALE) / 2}
                        width={applianceWidth * SCALE}
                        height={applianceDepth * SCALE}
                        rx={3}
                        fill={appliance.type === "hob" ? "#343a3d" : "#aeb9bb"}
                        fillOpacity="0.7"
                        stroke="#657174"
                        strokeWidth="1"
                      />
                      {config.showDimensions && (
                        <text
                          x={(appliance.x ?? 0) * SCALE}
                          y={4}
                          textAnchor="middle"
                          fontSize="7"
                          fill="#26312e"
                        >
                          {ITEM_META[appliance.type].name}
                        </text>
                      )}
                    </g>
                  );
                })}
                {config.showDimensions && (
                  <>
                    <text x={0} y={4} textAnchor="middle" fontSize="11" fill="#38413c">
                      {item.label}
                    </text>
                    <text x={0} y={18} textAnchor="middle" fontSize="9" fill="#69736d">
                      {Math.round(item.width)} × {Math.round(item.depth)} cm
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
