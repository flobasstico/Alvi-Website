import type { Timeline } from "@/lib/league"

const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })

/** Verlauf: kumulierte Ligapunkte je Creator nach jeder Challenge – reines SVG */
export function LineChart({ data }: { data: Timeline }) {
  const n = data.labels.length
  if (n === 0 || !data.series.length) return <p className="text-sm text-muted">Noch keine Challenges.</p>
  const W = 600
  const H = 240
  const pad = { l: 34, r: 12, t: 12, b: 28 }
  const max = Math.max(1, ...data.series.flatMap((s) => s.values))
  const x = (i: number) => pad.l + (n === 1 ? (W - pad.l - pad.r) / 2 : (i / (n - 1)) * (W - pad.l - pad.r))
  const y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b)
  const ticks = Array.from(new Set([0, Math.round(max / 2), max]))
  const labelEvery = Math.max(1, Math.ceil(n / 6))
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Ligapunkte über die Zeit">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#2a2650" strokeDasharray={t ? "4 4" : undefined} />
            <text x={pad.l - 6} y={y(t)} textAnchor="end" dominantBaseline="central" fontSize="11" className="fill-[#9b97c4]">
              {t}
            </text>
          </g>
        ))}
        {data.labels.map((l, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" className="fill-[#9b97c4]">
              {fmt(l)}
            </text>
          ) : null,
        )}
        {data.series.map((s) => (
          <g key={s.key}>
            <polyline
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill={s.color}>
                <title>{`${s.label} · ${fmt(data.labels[i])}: ${v} Ligapunkte`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {data.series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="h-1 w-4 rounded" style={{ background: s.color }} />
            <span className="font-semibold">{s.label}</span>
            <span className="text-muted">{s.values[s.values.length - 1]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
