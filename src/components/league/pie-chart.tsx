import type { Slice } from "@/lib/league"

/** Kuchendiagramm (Ring) mit Legende – reines SVG */
export function PieChart({ slices, unit = "Siege" }: { slices: Slice[]; unit?: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  if (!total) return <p className="text-sm text-muted">Noch keine Siege.</p>
  const R = 46
  const C = 2 * Math.PI * R
  let offset = 0
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 120 120" className="h-44 w-44 shrink-0 -rotate-90" role="img" aria-label={`Anteil an allen ${unit}`}>
        <circle cx="60" cy="60" r={R} fill="none" stroke="#2a2650" strokeWidth="22" />
        {slices.map((s) => {
          const len = (s.value / total) * C
          const el = (
            <circle
              key={s.key}
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="22"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
            >
              <title>{`${s.label}: ${s.value} ${unit} (${Math.round((s.value / total) * 100)} %)`}</title>
            </circle>
          )
          offset += len
          return el
        })}
        <text x="60" y="60" transform="rotate(90 60 60)" textAnchor="middle" dominantBaseline="central" className="fill-white font-display" fontSize="20">
          {total}
        </text>
      </svg>
      <ul className="flex min-w-40 flex-1 flex-col gap-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="flex-1 truncate font-semibold">{s.label}</span>
            <span className="tabular-nums text-muted">
              {s.value} · {Math.round((s.value / total) * 100)} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
