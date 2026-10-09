import clsx from "clsx"
import { drawnGames, openGame, standings, type OlympicState } from "@/lib/olympiade"

/** Kleine Punkteanzeige: Rangliste + aktuelles Spiel. Auf der Seite und im OBS-Overlay. */
export function ScoreBoard({ state, overlay = false }: { state: OlympicState; overlay?: boolean }) {
  const rows = standings(state)
  const current = openGame(state)
  const drawn = drawnGames(state.games).length
  const ended = state.olympic.status === "beendet"
  return (
    <div className={clsx("overflow-hidden rounded-2xl border-2 border-white/15 text-white", overlay ? "bg-[#071640]/85" : "bg-[#071640]")}>
      <div className="flex items-baseline justify-between gap-3 bg-gradient-to-r from-[#f59e0b] to-[#ec4899] px-4 py-2">
        <span className="font-display text-2xl tracking-wide drop-shadow">OLYMPIADE</span>
        <span className="text-xs font-bold uppercase text-white/90">
          {ended ? "Beendet" : `Spiel ${drawn}/${state.games.length}`}
        </span>
      </div>
      {current && (
        <div className="border-b border-white/10 bg-white/5 px-4 py-1.5 text-sm font-bold">
          Jetzt: {current.name} <span className="text-accent">· {current.position} {current.position === 1 ? "Punkt" : "Punkte"}</span>
        </div>
      )}
      <ol className="flex flex-col gap-1 p-2">
        {rows.map((r) => (
          <li key={r.userId} className={clsx("flex items-center gap-2 rounded-xl px-2 py-1", r.rank === 1 && r.points > 0 ? "bg-accent/20" : "bg-black/30")}>
            <span className="w-7 shrink-0 text-center font-display text-xl">{r.points > 0 ? (["🥇", "🥈", "🥉"][r.rank - 1] ?? `${r.rank}.`) : `${r.rank}.`}</span>
            {r.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.avatar} alt="" className="h-6 w-6 shrink-0 rounded-full" />
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs">{r.streamer ? "🎮" : "👤"}</span>
            )}
            <span className="min-w-0 flex-1 truncate text-lg font-bold" style={{ textShadow: "0 2px 3px rgba(0,0,0,.8)" }}>
              {r.name}
            </span>
            <span className="shrink-0 font-display text-2xl tabular-nums text-accent">{r.points}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="px-2 py-1 text-white/70">Noch keine Spieler.</li>}
      </ol>
    </div>
  )
}
