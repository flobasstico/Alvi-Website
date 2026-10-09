/* eslint-disable @next/next/no-img-element */
import Link from "next/link"
import { aggregatePlayers, sortPlayers } from "@/lib/player-stats"
import { loadPlayerStats } from "@/lib/player-stats-server"
import { successRate } from "@/lib/stats"
import { createClient } from "@/lib/supabase/server"

/** Linke Lobby-Spalte wie die Fortnite-Aufträge: Kennzahlen mit Fortschrittsbalken und die Spieler mit den meisten Siegen */
export async function Quests({ active }: { active: { id: number; title: string }[] }) {
  const supabase = await createClient()
  const [players, { data: total }] = await Promise.all([
    loadPlayerStats(supabase),
    supabase.from("challenge_stats").select("won, finished").is("source", null).maybeSingle(),
  ])
  const finished = total?.finished ?? 0
  const rate = successRate(total?.won ?? 0, finished)
  const top = sortPlayers(aggregatePlayers(players.parts, players.names), "siege")
    .filter((r) => r.wins > 0)
    .slice(0, 3)
  return (
    <QuestFrame>
      {active.map((c) => (
        <div key={c.id} className="border-l-4 border-accent bg-accent/15 px-2 py-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-accent">Läuft gerade</div>
          <div className="truncate text-sm font-semibold">{c.title}</div>
        </div>
      ))}
      <Quest label="Alvis Erfolgsquote" value={`${rate} %`} progress={rate} hint={`${finished} Challenges beendet`} />
      <div className="px-1">
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">Meiste Siege</div>
        <ol className="flex flex-col gap-1">
          {top.map((p, i) => (
            <li key={p.userId} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-center">{["🥇", "🥈", "🥉"][i]}</span>
              {p.avatar ? <img src={p.avatar} alt="" className="h-5 w-5 rounded-full" /> : <span className="h-5 w-5 rounded-full bg-line" />}
              <span className="flex-1 truncate font-semibold">{p.name}</span>
              <span className="font-display tabular-nums text-accent">{p.wins}</span>
            </li>
          ))}
          {!top.length && <li className="text-sm text-muted">Noch keine Runden gespielt.</li>}
        </ol>
      </div>
    </QuestFrame>
  )
}

function QuestFrame({ children }: { children: React.ReactNode }) {
  return (
    <Link href="/stats" className="panel group flex flex-col gap-3 p-3 hover:border-accent">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl">Aufträge & Stats</h2>
        <span className="font-display text-sm text-accent-2 group-hover:text-accent">Alle ›</span>
      </div>
      {children}
    </Link>
  )
}

function Quest({ label, value, progress, hint }: { label: string; value: string; progress: number; hint: string }) {
  return (
    <div className="bg-black/25 px-2 py-2">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="font-display text-lg text-accent">{value}</span>
      </div>
      <div className="mt-1 h-2.5 -skew-x-12 overflow-hidden bg-black/50">
        <div className="h-full bg-gradient-to-r from-accent-2 to-accent" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-muted">{hint}</div>
    </div>
  )
}

export function QuestsSkeleton() {
  return (
    <QuestFrame>
      <div className="h-16 animate-pulse bg-black/25" />
      <div className="h-20 animate-pulse bg-black/25" />
    </QuestFrame>
  )
}
