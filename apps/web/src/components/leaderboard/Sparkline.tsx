export function Sparkline({ values, positive }: { values: number[]; positive: boolean | null }) {
  if (values.length < 2) return null;

  const W = 72;
  const H = 28;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 0.001;

  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 2) - 1; // 1px padding top/bottom
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const color = positive === null ? "#64748b" : positive ? "#26a69a" : "#ef5350";

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ overflow: "visible", display: "block" }}
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}
