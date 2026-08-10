import { useMemo } from "react";
import { planItems, type PlanItem } from "@/lib/plan";
import {
  doorPartsOf,
  doorModeOf,
  FINISHES,
  leafCount,
  leafSpec,
  type Config,
  type WallId,
} from "@/lib/wardrobe";

const SCALE = 2.2;

function bounds(items: PlanItem[]) {
  if (!items.length) return { minX: -120, maxX: 120, maxH: 220 };
  return {
    minX: Math.min(...items.map((item) => item.x - item.width / 2)) - 45,
    maxX: Math.max(...items.map((item) => item.x + item.width / 2)) + 45,
    maxH: Math.max(...items.map((item) => item.height), 220) + 35,
  };
}

function frontColor(config: Config, item: PlanItem) {
  if (item.kind === "unit") {
    const unit = config.units.find((candidate) => candidate.id === item.id);
    return FINISHES.find((finish) => finish.id === unit?.finish)?.hex ?? "#e8e3da";
  }
  return "#e8e3da";
}

export default function FrontView({
  config,
  selectedUnitId,
  activeWall,
  activeBay,
  setActive,
  setSelectedUnit,
  showGrid = true,
}: {
  config: Config;
  selectedUnitId: string | null;
  activeWall: WallId;
  activeBay: number;
  setActive: (wall: WallId, bay: number) => void;
  setSelectedUnit: (id: string | null) => void;
  showGrid?: boolean;
}) {
  const items = useMemo(
    () => planItems(config, selectedUnitId, activeWall, activeBay),
    [config, selectedUnitId, activeWall, activeBay],
  );
  const frame = useMemo(() => bounds(items), [items]);
  const width = (frame.maxX - frame.minX) * SCALE;
  const height = frame.maxH * SCALE;
  const toX = (x: number) => (x - frame.minX) * SCALE;
  const toY = (y: number) => (frame.maxH - y) * SCALE;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f6f4f0] p-3">
      <div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-card/90 px-3 py-2 text-xs text-muted-foreground">
        <span>Front View · technical elevation</span>
        <span>Click a cabinet to select it</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-[#fbfaf7] shadow-inner">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
          <defs>
            <pattern
              id="front-grid"
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
          {showGrid && <rect width={width} height={height} fill="url(#front-grid)" />}
          <line x1="0" y1={toY(0)} x2={width} y2={toY(0)} stroke="#69736d" strokeWidth="2" />
          {items.map((item) => {
            const unit =
              item.kind === "unit"
                ? config.units.find((candidate) => candidate.id === item.id)
                : null;
            const selected = item.selected;
            const x = toX(item.x - item.width / 2);
            const y = toY(item.height);
            const w = item.width * SCALE;
            const h = item.height * SCALE;
            const fill = frontColor(config, item);
            const parts = unit
              ? leafCount(unit)
              : item.wall && item.bay != null
                ? doorPartsOf(config, item.wall, item.bay)
                : 1;
            const isDrawer = unit?.front === "drawers";
            const isOpen =
              unit?.front === "none" ||
              (item.wall &&
                item.bay != null &&
                doorModeOf(config, item.wall, item.bay) === "pullout");
            return (
              <g
                key={item.id}
                onClick={() =>
                  item.kind === "unit"
                    ? setSelectedUnit(item.id)
                    : item.wall && item.bay != null && setActive(item.wall, item.bay)
                }
                className="cursor-pointer"
              >
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill="#d5cec2"
                  stroke={selected ? "#2f6d5a" : "#8d9b91"}
                  strokeWidth={selected ? 3 : 1.5}
                />
                {!isOpen &&
                  !isDrawer &&
                  Array.from({ length: parts }, (_, index) => {
                    const leafW = w / parts;
                    const leaf = unit ? leafSpec(unit, index) : null;
                    return (
                      <g key={index}>
                        <rect
                          x={x + index * leafW + 3}
                          y={y + 3}
                          width={leafW - 6}
                          height={h - 6}
                          rx={2}
                          fill={leaf?.material === "mirror" ? "#c9d2d8" : fill}
                          stroke="#8d8174"
                          strokeWidth="1"
                        />
                        {index > 0 && (
                          <line
                            x1={x + index * leafW}
                            y1={y}
                            x2={x + index * leafW}
                            y2={y + h}
                            stroke="#736d65"
                            strokeWidth="1.5"
                          />
                        )}
                      </g>
                    );
                  })}
                {isDrawer &&
                  Array.from({ length: Math.max(3, unit?.drawers ?? 3) }, (_, index) => {
                    const drawerH = h / Math.max(3, unit?.drawers ?? 3);
                    return (
                      <rect
                        key={index}
                        x={x + 3}
                        y={y + index * drawerH + 3}
                        width={w - 6}
                        height={drawerH - 6}
                        rx={2}
                        fill={fill}
                        stroke="#8d8174"
                        strokeWidth="1"
                      />
                    );
                  })}
                {isOpen && (
                  <rect
                    x={x + 4}
                    y={y + 4}
                    width={w - 8}
                    height={h - 8}
                    fill="#f8f6f1"
                    stroke="#a7aaa4"
                    strokeDasharray="4 3"
                  />
                )}
                <text x={x + w / 2} y={y - 8} textAnchor="middle" fontSize="10" fill="#38413c">
                  {Math.round(item.width)} × {Math.round(item.height)} cm
                </text>
                <text
                  x={x + w / 2}
                  y={y + h / 2 + 4}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#38413c"
                >
                  {item.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
