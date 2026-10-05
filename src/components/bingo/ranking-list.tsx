import clsx from "clsx"
import type { RankEntry } from "@/lib/bingo"

/** Live-Punkterangliste aller Teilnehmer einer Bingo-Runde */
export function RankingList({ entries, overlay, me }: { entries: RankEntry[]; overlay?: boolean; me?: string | null }) {
  return (
    <ol className="flex flex-col gap-1.5">
      {entries.map((e, i) => (
        <li
          key={e.key}
          className={clsx(
            "flex items-center gap-2 rounded-xl border px-3 py-1.5",
            overlay ? "border-white/10 bg-black/70" : "border-line bg-bg/40",
            i === 0 && e.score.points > 0 && "border-accent",
            me && e.key === me && "ring-2 ring-accent-2",
          )}
        >
          <span className={clsx("w-8 shrink-0 text-center font-display", overlay ? "text-2xl" : "text-xl")}>
            {e.score.points > 0 ? (["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`) : `${i + 1}.`}
          </span>
          {e.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.avatar} alt="" className="h-6 w-6 shrink-0 rounded-full" />
          ) : (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-line text-xs">{e.streamer ? "🎮" : "👤"}</span>
          )}
          <span className={clsx("min-w-0 flex-1 truncate font-bold text-white", overlay && "text-lg")}>{e.name}</span>
          <span className="shrink-0 text-xs text-muted">
            {e.score.fields}✅ {e.score.bingos > 0 && `${e.score.bingos}× Bingo`}
          </span>
          <span className={clsx("w-14 shrink-0 text-right font-display text-accent tabular-nums", overlay ? "text-3xl" : "text-2xl")}>
            {e.score.points}
          </span>
        </li>
      ))}
      {entries.length === 0 && <li className="text-muted">Noch keine Teilnehmer.</li>}
    </ol>
  )
}
