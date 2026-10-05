import { IslandMap } from "@/components/island-map"
import { PLAYER_COLORS } from "@/lib/drop"
import type { ReplayCircle } from "@/lib/replay"

/** Gespeicherte Landebereiche einer Challenge exakt wie im Original anzeigen */
export function DropReplay({ circles, rule, mapUrl }: { circles: ReplayCircle[]; rule: string | null; mapUrl?: string | null }) {
  const multi = circles.length > 1
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="panel p-2">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl">
          <IslandMap imageUrl={mapUrl} />
          <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full">
            {circles.map((c, i) => (
              <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill={PLAYER_COLORS[i % PLAYER_COLORS.length]} fillOpacity={0.25} stroke={PLAYER_COLORS[i % PLAYER_COLORS.length]} strokeWidth={0.6} />
            ))}
          </svg>
          {circles.map((c, i) => (
            <div
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded px-2 py-0.5 text-sm font-black text-black shadow"
              style={{ left: `${c.cx}%`, top: `${c.cy}%`, background: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
            >
              {multi ? c.player || `Spieler ${i + 1}` : "Hier landen!"}
            </div>
          ))}
        </div>
      </div>
      <aside className="panel flex h-fit flex-col gap-3">
        <div className="text-sm text-muted">Landebereich{multi ? "e" : ""}</div>
        {circles.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }} />
            <span className="font-display text-2xl" style={{ color: PLAYER_COLORS[i % PLAYER_COLORS.length] }}>
              {multi ? c.player || `Spieler ${i + 1}` : "Im Kreis"}
            </span>
            {c.spot && <span className="text-sm text-muted">bei {c.spot}</span>}
          </div>
        ))}
        {rule && (
          <div className="rounded-xl border border-accent-2/50 bg-accent-2/10 p-3">
            <div className="text-sm text-muted">Zusatzregel</div>
            <div className="text-lg font-bold">{rule}</div>
          </div>
        )}
      </aside>
    </div>
  )
}
