import clsx from "clsx"
import { elapsedSeconds, formatClock, progress, remainingSeconds, type WinState } from "@/lib/winchallenge"

/** Schlichtes Stream-Layout: Timer, Gesamtfortschritt und je Spiel Siege/Ziel. Auch als OBS-Overlay. */
export function WinBoard({ state, now }: { state: WinState; now: number }) {
  const { challenge: c, games } = state
  const p = progress(games)
  const remaining = remainingSeconds(c, now)
  const clock = remaining ?? elapsedSeconds(c, now)
  const timeUp = remaining === 0 && c.status !== "beendet"
  const urgent = remaining !== null && remaining > 0 && remaining <= 60 && c.status === "laeuft"
  const banner =
    c.status === "beendet"
      ? c.result === "geschafft"
        ? { text: "GESCHAFFT", tone: "win" }
        : { text: "GESCHEITERT", tone: "fail" }
      : p.complete
        ? { text: "GESCHAFFT", tone: "win" }
        : timeUp
          ? { text: "ZEIT ABGELAUFEN", tone: "fail" }
          : null

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b14]/85 text-white shadow-2xl backdrop-blur">
      <div className="flex items-end justify-between gap-4 border-b border-white/10 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/50">Win Challenge</div>
          <div className="truncate text-xl font-extrabold">{c.title ?? "Winchallenge"}</div>
        </div>
        <div className="text-right">
          <div
            className={clsx(
              "font-mono text-4xl font-bold tabular-nums leading-none",
              timeUp || banner?.tone === "fail" ? "text-fail" : urgent ? "animate-pulse text-fail" : "text-white",
            )}
          >
            {formatClock(clock)}
          </div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-white/50">
            {c.status === "pausiert" ? "Pausiert" : c.status === "bereit" ? "Bereit" : remaining === null ? "Spielzeit" : "Restzeit"}
          </div>
        </div>
      </div>

      <div className="px-5 py-3">
        <div className="mb-1 flex justify-between text-xs font-semibold text-white/60">
          <span>Fortschritt</span>
          <span className="tabular-nums">
            {p.wins} / {p.target} Siege
          </span>
        </div>
        <Bar value={p.target ? p.wins / p.target : 0} done={p.complete} />
      </div>

      <ul className="flex flex-col gap-2 px-5 pb-4">
        {games.map((g) => {
          const done = g.wins >= g.target
          return (
            <li key={g.id} className={clsx("rounded-xl px-3 py-2", done ? "bg-win/15" : "bg-white/5")}>
              <div className="flex items-center gap-3">
                <span className={clsx("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-black", done ? "bg-win text-black" : "border border-white/25")}>
                  {done ? "✓" : ""}
                </span>
                <span className="min-w-0 flex-1 truncate font-bold">{g.name}</span>
                <span className="font-mono text-lg font-bold tabular-nums">
                  <span className={done ? "text-win" : "text-accent"}>{g.wins}</span>
                  <span className="text-white/40"> / {g.target}</span>
                </span>
              </div>
              <div className="mt-1.5 pl-8">
                <Bar value={g.wins / g.target} done={done} thin />
              </div>
            </li>
          )
        })}
        {games.length === 0 && <li className="text-sm text-white/50">Noch keine Spiele.</li>}
      </ul>

      {banner && (
        <div className={clsx("py-2 text-center text-lg font-black tracking-[0.3em]", banner.tone === "win" ? "bg-win text-black" : "bg-fail text-white")}>
          {banner.text}
        </div>
      )}
    </div>
  )
}

function Bar({ value, done, thin }: { value: number; done?: boolean; thin?: boolean }) {
  return (
    <div className={clsx("overflow-hidden rounded-full bg-white/10", thin ? "h-1" : "h-2")}>
      <div
        className={clsx("h-full rounded-full transition-all duration-500", done ? "bg-win" : "bg-accent")}
        style={{ width: `${Math.min(100, Math.round(value * 100))}%` }}
      />
    </div>
  )
}
