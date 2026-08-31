type TechnicalDimensionProps = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  vertical?: boolean;
};

/** Small SVG dimension primitive shared by the 2D plan and elevation views. */
export function TechnicalDimension({
  x1,
  y1,
  x2,
  y2,
  label,
  vertical = false,
}: TechnicalDimensionProps) {
  const tick = 5;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  return (
    <g aria-label={`${label} dimension`}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#60756a" strokeWidth="1.1" />
      {vertical ? (
        <>
          <line x1={x1 - tick} y1={y1} x2={x1 + tick} y2={y1} stroke="#60756a" strokeWidth="1.1" />
          <line x1={x2 - tick} y1={y2} x2={x2 + tick} y2={y2} stroke="#60756a" strokeWidth="1.1" />
          <text
            x={midX - 7}
            y={midY}
            textAnchor="middle"
            fontSize="9"
            fill="#42564c"
            transform={`rotate(-90 ${midX - 7} ${midY})`}
          >
            {label}
          </text>
        </>
      ) : (
        <>
          <line x1={x1} y1={y1 - tick} x2={x1} y2={y1 + tick} stroke="#60756a" strokeWidth="1.1" />
          <line x1={x2} y1={y2 - tick} x2={x2} y2={y2 + tick} stroke="#60756a" strokeWidth="1.1" />
          <text x={midX} y={midY - 6} textAnchor="middle" fontSize="9" fill="#42564c">
            {label}
          </text>
        </>
      )}
    </g>
  );
}
