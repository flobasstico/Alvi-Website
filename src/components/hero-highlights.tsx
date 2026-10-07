import Link from "next/link"
import clsx from "clsx"
import type { ReactNode } from "react"

export type PodiumEntry = {
  id: string | number
  name: string
  avatar: string | null
  value: number
  color?: string
}

/**
 * Aufbau der großen Kachel: ab Desktop Liga links, Titel/Text/Icons in der Mitte, Stats rechts.
 * Am Handy steht die Mitte oben, darunter die beiden Karten (Tablet: nebeneinander).
 */
export function HeroLayout({ center, left, right }: { center: ReactNode; left: ReactNode; right: ReactNode }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="flex flex-col justify-center sm:col-span-2 lg:order-2 lg:col-span-1">{center}</div>
      <div className="text-left lg:order-1 [&>*]:h-full">{left}</div>
      <div className="text-left lg:order-3 [&>*]:h-full">{right}</div>
    </div>
  )
}

/** Große Kachel mit Vorschau-Karten: Creator-Liga (Podest) und Stats (Alvis Quote + Top-Spieler) */
export function HeroHighlights({
  center,
  league,
  challenges,
  rate,
  finished,
  players,
}: {
  center: ReactNode
  league: PodiumEntry[]
  challenges: number
  rate: number
  finished: number
  players: PodiumEntry[]
}) {
  return (
    <HeroLayout
      center={center}
      left={
        <Link
          href="/liga"
          className="group flex flex-col rounded-2xl border border-line bg-bg/50 p-4 transition hover:-translate-y-1 hover:border-accent"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-xl group-hover:text-accent">🏆 Creator-Liga</h2>
            <span className="text-xs text-muted">{challenges} Challenges</span>
          </div>
          {league.length ? (
            <Podium entries={league} unit="Pkt." />
          ) : (
            <p className="mt-6 text-sm text-muted">Noch keine Challenges eingetragen.</p>
          )}
          <p className="mt-auto pt-3 text-right text-sm text-accent-2 group-hover:underline">Zur ewigen Tabelle →</p>
        </Link>
      }
      right={
        <Link
          href="/stats"
          className="group flex flex-col rounded-2xl border border-line bg-bg/50 p-4 transition hover:-translate-y-1 hover:border-accent"
        >
          <h2 className="font-display text-xl group-hover:text-accent">📊 Stats</h2>
          <div className="mt-3 flex items-center gap-3">
            <RateRing rate={rate} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold uppercase text-muted">Alvis Challenges</div>
              <div className="text-sm">
                <span className="font-bold">{rate} %</span> von {finished} geschafft
              </div>
              <div className="mt-2 text-xs font-bold uppercase text-muted">Meiste Siege</div>
              <ol className="mt-1 flex flex-col gap-1">
                {players.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="w-5 text-center">{["🥇", "🥈", "🥉"][i]}</span>
                    <Avatar entry={p} size="h-5 w-5" />
                    <span className="flex-1 truncate font-semibold">{p.name}</span>
                    <span className="tabular-nums text-accent">{p.value}</span>
                  </li>
                ))}
                {!players.length && <li className="text-sm text-muted">Noch keine Runden gespielt.</li>}
              </ol>
            </div>
          </div>
          <p className="mt-auto pt-3 text-right text-sm text-accent-2 group-hover:underline">Alle Stats →</p>
        </Link>
      }
    />
  )
}

/** Podest: Platz 2 links, 1 in der Mitte, 3 rechts */
function Podium({ entries, unit }: { entries: PodiumEntry[]; unit: string }) {
  const order = [entries[1], entries[0], entries[2]]
  const heights = ["h-12", "h-16", "h-8"]
  const places = [2, 1, 3]
  return (
    <div className="mt-3 grid grid-cols-3 items-end gap-2">
      {order.map((e, i) =>
        e ? (
          <div key={e.id} className="flex min-w-0 flex-col items-center">
            {places[i] === 1 && <span className="text-lg leading-none">👑</span>}
            <Avatar entry={e} size={places[i] === 1 ? "h-12 w-12" : "h-9 w-9"} />
            <span className="mt-1 w-full truncate text-center text-sm font-bold">{e.name}</span>
            <span className="text-xs tabular-nums text-accent">
              {e.value} {unit}
            </span>
            <div
              className={clsx(
                "mt-1 flex w-full items-start justify-center rounded-t-lg pt-1 font-display text-lg text-white [text-shadow:0_1px_3px_rgba(0,0,0,.7)]",
                heights[i],
              )}
              style={{ background: e.color ?? "#facc15" }}
            >
              {places[i]}
            </div>
          </div>
        ) : (
          <div key={i} />
        ),
      )}
    </div>
  )
}

function Avatar({ entry, size }: { entry: PodiumEntry; size: string }) {
  return entry.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={entry.avatar} alt="" className={clsx(size, "shrink-0 rounded-full object-cover ring-2 ring-line")} />
  ) : (
    <span className={clsx(size, "flex shrink-0 items-center justify-center rounded-full bg-line text-xs")}>👤</span>
  )
}

/** Ring mit Alvis Erfolgsquote */
function RateRing({ rate }: { rate: number }) {
  const R = 30
  const C = 2 * Math.PI * R
  return (
    <svg viewBox="0 0 80 80" className="h-24 w-24 shrink-0 -rotate-90 lg:h-20 lg:w-20 xl:h-24 xl:w-24" aria-label={`${rate} % geschafft`}>
      <circle cx="40" cy="40" r={R} fill="none" stroke="var(--color-line)" strokeWidth="9" />
      {rate > 0 && (
        <circle
          cx="40"
          cy="40"
          r={R}
          fill="none"
          stroke={rate >= 50 ? "var(--color-win)" : "var(--color-accent)"}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(rate / 100) * C} ${C}`}
        />
      )}
      <text
        x="40"
        y="40"
        transform="rotate(90 40 40)"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-white font-display"
        fontSize="18"
      >
        {rate}%
      </text>
    </svg>
  )
}

/** Platzhalter, solange Liga und Stats laden (gleiche Größe wie die Karten) */
export function HeroHighlightsSkeleton({ center }: { center: ReactNode }) {
  const box = <div className="h-[280px] animate-pulse rounded-2xl border border-line bg-bg/50" aria-hidden />
  return <HeroLayout center={center} left={box} right={box} />
}
