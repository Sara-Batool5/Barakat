/** A small accessible bar chart drawn as SVG (no chart library). */
export function BarChart({ data, label, unit }: { data: { label: string; value: number }[]; label: string; unit: string }) {
  const W = 640;
  const H = 210;
  const pad = { l: 44, r: 10, t: 16, b: 34 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = max <= 10 ? Math.ceil(max) : max <= 100 ? Math.ceil(max / 10) * 10 : Math.ceil(max / 50) * 50;
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const slot = innerW / Math.max(1, data.length);
  const bar = Math.min(44, slot * 0.58);
  const y = (v: number) => pad.t + innerH - (v / nice) * innerH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full">
      <title>{label}</title>
      {[0, 0.5, 1].map((g) => (
        <g key={g}>
          <line x1={pad.l} x2={W - pad.r} y1={y(nice * g)} y2={y(nice * g)} stroke="hsl(120 14% 86%)" strokeWidth="1" />
          <text x={pad.l - 8} y={y(nice * g) + 4} textAnchor="end" fontSize="11" fill="hsl(122 7% 45%)">{Math.round(nice * g * 10) / 10}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const cx = pad.l + slot * i + slot / 2;
        const h = Math.max(d.value > 0 ? 2 : 0, innerH - (y(d.value) - pad.t));
        return (
          <g key={`${d.label}-${i}`}>
            <rect x={cx - bar / 2} y={pad.t + innerH - h} width={bar} height={h} rx="4" fill="hsl(140 55% 38%)">
              <title>{`${d.label}: ${d.value} ${unit}`}</title>
            </rect>
            {d.value > 0 && <text x={cx} y={pad.t + innerH - h - 5} textAnchor="middle" fontSize="11" fontWeight="600" fill="hsl(123 20% 7%)">{d.value}</text>}
            <text x={cx} y={H - 12} textAnchor="middle" fontSize="11" fill="hsl(122 7% 45%)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
