import { useMemo } from "react";
import { TechnicalDimension } from "./TechnicalDimension";
import { planItems, type PlanItem } from "@/lib/plan";
import { fittingsOf } from "@/lib/fittings";
import {
  doorPartsOf,
  doorModeOf,
  FINISHES,
  frontSectionFractions,
  leafCount,
  leafSpec,
  type Config,
  type WallId,
} from "@/lib/wardrobe";

const SCALE = 2.2;
const cm = (value: number) => `${Math.round(value * 10) / 10} cm`;

function bounds(items: PlanItem[]) {
  if (!items.length) return { minX: -120, maxX: 120, minH: -35, maxH: 220 };
  return {
    minX: Math.min(...items.map((item) => item.x - item.width / 2)) - 45,
    maxX: Math.max(...items.map((item) => item.x + item.width / 2)) + 45,
    minH: -35,
    maxH: Math.max(...items.map((item) => item.elevation + item.height), 220) + 35,
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
  const height = (frame.maxH - frame.minH) * SCALE;
  const toX = (x: number) => (x - frame.minX) * SCALE;
  const toY = (y: number) => (frame.maxH - y) * SCALE;
  const selectedItem = items.find((item) => item.selected) ?? null;
  const itemMinX = items.length
    ? Math.min(...items.map((item) => item.x - item.width / 2))
    : frame.minX + 45;
  const itemMaxX = items.length
    ? Math.max(...items.map((item) => item.x + item.width / 2))
    : frame.maxX - 45;
  const overallDimensionY = toY(0) + 26;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f6f4f0] p-3">
      <div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-card/90 px-3 py-2 text-xs text-muted-foreground">
        <span>Front View · technical elevation</span>
        <span>Click a cabinet to select it</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-[#fbfaf7] shadow-inner">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full"
          role="img"
          aria-label="Technical front elevation"
        >
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
          <text x={12} y={toY(0) - 8} fontSize="9" letterSpacing="1" fill="#69736d">
            FLOOR LINE
          </text>
          {items.length > 0 && (
            <>
              <line
                x1={toX(itemMinX)}
                y1={toY(0)}
                x2={toX(itemMinX)}
                y2={overallDimensionY}
                stroke="#9aa69f"
                strokeWidth="1"
              />
              <line
                x1={toX(itemMaxX)}
                y1={toY(0)}
                x2={toX(itemMaxX)}
                y2={overallDimensionY}
                stroke="#9aa69f"
                strokeWidth="1"
              />
              <TechnicalDimension
                x1={toX(itemMinX)}
                y1={overallDimensionY}
                x2={toX(itemMaxX)}
                y2={overallDimensionY}
                label={`Total · ${cm(itemMaxX - itemMinX)}`}
              />
            </>
          )}
          {selectedItem && (
            <>
              <line
                x1={toX(selectedItem.x - selectedItem.width / 2)}
                y1={toY(selectedItem.elevation)}
                x2={toX(selectedItem.x - selectedItem.width / 2) - 24}
                y2={toY(selectedItem.elevation)}
                stroke="#9aa69f"
                strokeWidth="1"
              />
              <line
                x1={toX(selectedItem.x - selectedItem.width / 2)}
                y1={toY(selectedItem.elevation + selectedItem.height)}
                x2={toX(selectedItem.x - selectedItem.width / 2) - 24}
                y2={toY(selectedItem.elevation + selectedItem.height)}
                stroke="#9aa69f"
                strokeWidth="1"
              />
              <TechnicalDimension
                x1={toX(selectedItem.x - selectedItem.width / 2) - 24}
                y1={toY(selectedItem.elevation + selectedItem.height)}
                x2={toX(selectedItem.x - selectedItem.width / 2) - 24}
                y2={toY(selectedItem.elevation)}
                label={`Height · ${cm(selectedItem.height)}`}
                vertical
              />
            </>
          )}
          {items.map((item) => {
            const unit =
              item.kind === "unit"
                ? config.units.find((candidate) => candidate.id === item.id)
                : null;
            const selected = item.selected;
            const x = toX(item.x - item.width / 2);
            const y = toY(item.elevation + item.height);
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
            const sectionFractions = unit ? frontSectionFractions(unit) : [1];
            const fittings = unit ? fittingsOf(unit) : [];
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
                {sectionFractions.length > 1 &&
                  sectionFractions
                    .slice(0, -1)
                    .reduce<number[]>((positions, fraction) => {
                      positions.push((positions.at(-1) ?? 0) + fraction);
                      return positions;
                    }, [])
                    .map((fraction, index) => (
                      <line
                        key={`section-${index}`}
                        x1={x}
                        y1={y + h * fraction}
                        x2={x + w}
                        y2={y + h * fraction}
                        stroke="#736d65"
                        strokeWidth="1.4"
                      />
                    ))}
                {fittings.map((fitting) => {
                  const fittingY = toY(item.elevation + fitting.y);
                  if (fittingY <= y + 5 || fittingY >= y + h - 5) return null;
                  return (
                    <line
                      key={fitting.id}
                      x1={x + 6}
                      y1={fittingY}
                      x2={x + w - 6}
                      y2={fittingY}
                      stroke="#5d766a"
                      strokeWidth="1"
                      strokeDasharray={fitting.type === "shelf" ? undefined : "4 3"}
                      opacity="0.78"
                    />
                  );
                })}
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
