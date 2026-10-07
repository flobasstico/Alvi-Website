import Link from "next/link"
import clsx from "clsx"
import { AdminDeleteRound } from "@/components/admin-delete-round"
import { PageTitle } from "@/components/page-title"
import { SOURCE_LABEL, SOURCES, STATUS_LABEL, STATUSES, type Source, type Status } from "@/lib/constants"
import {
  aggregatePlayers,
  PLAYER_GAME_LABEL,
  PLAYER_GAMES,
  POINT_GAMES,
  sortPlayers,
  type PlayerGame,
  type SortKey,
} from "@/lib/player-stats"
import { loadPlayerStats } from "@/lib/player-stats-server"
import { replayHref } from "@/lib/replay"
import { rateQuip, streaks, successRate } from "@/lib/stats"
import { selectAll } from "@/lib/supabase/select-all"
import { getViewer } from "@/lib/supabase/server"

export const metadata = { title: "Challenge-Stats" }

/** Spiele, die Zuschauer ohne Admin spielen können */
const VIEWER_GAMES: readonly PlayerGame[] = ["eskalation", "loadout", "auktion", "bingo", "olympiade", "winchallenge"]

const STATUS_CLASS: Record<Status, string> = {
  geplant: "bg-panel-2 text-muted",
  aktiv: "bg-accent-2/20 text-accent-2",
  geschafft: "bg-win/20 text-win",
  gescheitert: "bg-fail/20 text-fail",
}

type Params = { ansicht?: string; quelle?: string; status?: string; spiel?: string; sort?: string }
const SORT_KEYS: SortKey[] = ["siege", "teilnahmen", "quote", "punkte", "schnitt"]

export default async function StatsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams
  const { quelle, status } = params
  const ansicht = params.ansicht === "alvi" ? "alvi" : params.ansicht === "zuschauer" ? "zuschauer" : "spieler"
  const spiel = PLAYER_GAMES.includes(params.spiel as PlayerGame) ? (params.spiel as PlayerGame) : undefined
  const sort = SORT_KEYS.includes(params.sort as SortKey) ? (params.sort as SortKey) : "siege"
  const { supabase, isAdmin } = await getViewer()
  const [{ data: stats }, { data: all }, players] = await Promise.all([
    supabase.from("challenge_stats").select("*"),
    selectAll((a, b) => supabase.from("challenges").select("*").order("created_at", { ascending: false }).order("id").range(a, b)),
    loadPlayerStats(supabase),
  ])
  const viewer = ansicht === "zuschauer"
  const playerRows = sortPlayers(aggregatePlayers(viewer ? players.viewerParts : players.parts, players.names, spiel), sort)
  // Häufigkeit: gespielte Zuschauer-Runden je Spiel
  const viewerRounds = new Map<PlayerGame, Set<string>>()
  for (const p of players.viewerParts) viewerRounds.set(p.game, (viewerRounds.get(p.game) ?? new Set()).add(p.round))
  const frequency = [...viewerRounds].map(([game, rounds]) => ({ game, count: rounds.size })).sort((a, b) => b.count - a.count)
  const maxFreq = Math.max(1, ...frequency.map((f) => f.count))
  const showPoints = !spiel || POINT_GAMES.includes(spiel)

  const total = stats?.find((s) => s.source === null)
  const rate = successRate(total?.won ?? 0, total?.finished ?? 0)
  const st = streaks(all ?? [])
  const list = (all ?? []).filter((c) => (!quelle || c.source === quelle) && (!status || c.status === status))

  const filterLink = (key: keyof Params, value?: string) => {
    const p = new URLSearchParams()
    const next: Params = { ansicht: ansicht === "spieler" ? undefined : ansicht, quelle, status, spiel, sort: sort === "siege" ? undefined : sort, [key]: value }
    for (const k of ["ansicht", "spiel", "sort", "quelle", "status"] as const) if (next[k]) p.set(k, next[k]!)
    const q = p.toString()
    return q ? `/stats?${q}` : "/stats"
  }

  return (
    <>
      <PageTitle title="Challenge-Stats" subtitle="Wer gewinnt am meisten – und wie oft schafft Alvi seine Challenges?" />

      <nav className="mb-6 flex gap-2">
        <Link href="/stats" className={clsx("btn px-4 py-2", ansicht === "spieler" ? "bg-accent text-black" : "btn-secondary")}>
          👥 Creator
        </Link>
        <Link href="/stats?ansicht=alvi" className={clsx("btn px-4 py-2", ansicht === "alvi" ? "bg-accent text-black" : "btn-secondary")}>
          🎮 Alvi
        </Link>
        <Link href="/stats?ansicht=zuschauer" className={clsx("btn px-4 py-2", ansicht === "zuschauer" ? "bg-accent text-black" : "btn-secondary")}>
          🧑‍🤝‍🧑 Zuschauer
        </Link>
      </nav>

      {ansicht !== "alvi" ? (
        <>
          {viewer && (
            <section className="panel mb-6">
              <h2 className="mb-1 font-display text-2xl">Zuschauer-Runden</h2>
              <p className="mb-3 text-sm text-muted">
                Runden, die Zuschauer ohne Admin gespielt haben. Die Runden selbst werden nach dem Beenden gelöscht – Sieger, Punkte und Platzierungen
                bleiben hier erhalten. Sie zählen getrennt von den offiziellen Stats.
              </p>
              <div className="flex flex-col gap-2">
                {frequency.map((f) => (
                  <div key={f.game} className="grid grid-cols-[120px_1fr_48px] items-center gap-3 text-sm sm:grid-cols-[160px_1fr_60px]">
                    <span className="font-semibold">{PLAYER_GAME_LABEL[f.game]}</span>
                    <div className="h-4 overflow-hidden rounded-full bg-panel-2">
                      <div className="h-full rounded-full bg-accent-2" style={{ width: `${(f.count / maxFreq) * 100}%` }} />
                    </div>
                    <span className="text-right tabular-nums">{f.count}×</span>
                  </div>
                ))}
                {!frequency.length && <p className="text-muted">Noch keine Zuschauer-Runden gespielt.</p>}
              </div>
            </section>
          )}

          <section id="spieler" className="panel mb-6">
            <h2 className="mb-1 font-display text-2xl">{viewer ? "Zuschauer-Rangliste" : "Creator-Rangliste"}</h2>
            <p className="mb-3 text-sm text-muted">
              {viewer
                ? "Alle, die in Zuschauer-Runden mitgespielt haben. Punkte gibt es bei Bingo und Olympiade. Private Profile werden nicht angezeigt."
                : "Alle, die bei offiziellen Challenges mitgespielt haben (abgeschlossene Runden). Alvis Solo-Challenges zählen mit – geschafft = Sieg. Punkte gibt es bei Bingo und Olympiade. Private Profile werden nicht angezeigt."}
            </p>
            <div className="mb-3 flex flex-wrap gap-1 text-sm">
              <FilterChip href={filterLink("spiel")} active={!spiel}>Alle Spiele</FilterChip>
              {PLAYER_GAMES.filter((g) => !viewer || VIEWER_GAMES.includes(g)).map((g) => (
                <FilterChip key={g} href={filterLink("spiel", g)} active={spiel === g}>{PLAYER_GAME_LABEL[g]}</FilterChip>
              ))}
            </div>
            {playerRows.length ? (
              <div className="-mx-2 overflow-x-auto px-2">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase text-muted">
                      <th className="w-10 py-2">#</th>
                      <th className="py-2">{viewer ? "Zuschauer" : "Creator"}</th>
                      <SortTh label="Teilnahmen" k="teilnahmen" sort={sort} href={filterLink} />
                      <SortTh label="Siege" k="siege" sort={sort} href={filterLink} />
                      <SortTh label="Siegquote" k="quote" sort={sort} href={filterLink} />
                      {showPoints && <SortTh label="Punkte" k="punkte" sort={sort} href={filterLink} />}
                      {showPoints && <SortTh label="Ø Punkte" k="schnitt" sort={sort} href={filterLink} />}
                    </tr>
                  </thead>
                  <tbody>
                    {playerRows.map((r, i) => (
                      <tr key={r.userId} className={clsx("border-b border-line/50", i === 0 && "bg-accent/10", r.userId === players.alviId && "font-semibold")}>
                        <td className="py-2 font-display text-lg">{["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`}</td>
                        <td className="py-2">
                          <span className="flex items-center gap-2 font-bold">
                            {r.avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.avatar} alt="" className="h-6 w-6 rounded-full" />
                            ) : (
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-line text-xs">👤</span>
                            )}
                            {players.names.get(r.userId)?.login ? (
                              <Link href={`/profil/${players.names.get(r.userId)!.login}`} className="hover:text-accent hover:underline">
                                {r.name}
                              </Link>
                            ) : (
                              r.name
                            )}
                            {r.userId === players.alviId && <span className="chip px-1.5 py-0 text-[10px]">Streamer</span>}
                          </span>
                        </td>
                        <td className="py-2 text-right tabular-nums">{r.rounds}</td>
                        <td className="py-2 text-right font-bold tabular-nums text-accent">{r.wins}</td>
                        <td className="py-2 text-right tabular-nums">{r.winRate} %</td>
                        {showPoints && <td className="py-2 text-right tabular-nums">{r.pointRounds ? r.points : "–"}</td>}
                        {showPoints && (
                          <td className="py-2 text-right tabular-nums">{r.avgPoints != null ? r.avgPoints.toLocaleString("de-DE") : "–"}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted">Noch keine abgeschlossenen Runden{spiel ? ` bei ${PLAYER_GAME_LABEL[spiel]}` : ""}.</p>
            )}
          </section>
        </>
      ) : (
        <>
          <section className="panel mb-6 text-center">
            <div className="mb-2 text-muted">Alvi hat</div>
            <div className={clsx("font-display text-8xl drop-shadow sm:text-9xl", rate >= 50 ? "text-win" : "text-accent")}>{rate} %</div>
            <div className="text-muted">seiner Challenges geschafft</div>
            <p className="mt-3 text-lg italic">„{rateQuip(rate, total?.finished ?? 0)}“</p>
          </section>

          <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Abgeschlossen" value={total?.finished ?? 0} />
            <Stat label="Geschafft" value={total?.won ?? 0} className="text-win" />
            <Stat label="Gescheitert" value={total?.lost ?? 0} className="text-fail" />
            <Stat
              label="Aktuelle Serie"
              value={st.current ? `${st.current.count}× ${st.current.status === "geschafft" ? "✅" : "❌"}` : "–"}
            />
            <Stat label="Längste Siegesserie" value={st.bestWin} />
            <Stat label="Längste Pechsträhne" value={st.bestFail} />
          </section>

          <section className="panel mb-6">
            <h2 className="mb-3 font-display text-2xl">Nach Tool</h2>
            <div className="flex flex-col gap-3">
              {SOURCES.map((src) => {
                const s = stats?.find((x) => x.source === src)
                if (!s) return null
                const r = successRate(s.won ?? 0, s.finished ?? 0)
                return (
                  <div key={src} className="grid grid-cols-[140px_1fr_80px] items-center gap-3 text-sm">
                    <span className="font-semibold">{SOURCE_LABEL[src]}</span>
                    <div className="h-4 overflow-hidden rounded-full bg-fail/30">
                      <div className="h-full rounded-full bg-win" style={{ width: `${r}%` }} />
                    </div>
                    <span className="text-right tabular-nums">
                      {r} % <span className="text-muted">({s.won}/{s.finished})</span>
                    </span>
                  </div>
                )
              })}
              {!stats?.some((s) => s.source !== null) && <p className="text-muted">Noch keine Daten.</p>}
            </div>
          </section>

          <section className="panel">
            <h2 className="mb-3 font-display text-2xl">Alle Challenges</h2>
            <div className="mb-2 flex flex-wrap gap-1 text-sm">
              <FilterChip href={filterLink("quelle")} active={!quelle}>Alle Tools</FilterChip>
              {SOURCES.map((s) => (
                <FilterChip key={s} href={filterLink("quelle", s)} active={quelle === s}>{SOURCE_LABEL[s]}</FilterChip>
              ))}
            </div>
            <div className="mb-4 flex flex-wrap gap-1 text-sm">
              <FilterChip href={filterLink("status")} active={!status}>Alle Status</FilterChip>
              {STATUSES.map((s) => (
                <FilterChip key={s} href={filterLink("status", s)} active={status === s}>{STATUS_LABEL[s]}</FilterChip>
              ))}
            </div>
            <ul className="divide-y divide-line">
              {list.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className={clsx("chip border-0", STATUS_CLASS[c.status as Status])}>{STATUS_LABEL[c.status as Status]}</span>
                  <span className="font-semibold">{c.title}</span>
                  <span className="chip">{SOURCE_LABEL[c.source as Source]}</span>
                  <span className="ml-auto text-xs text-muted">
                    {new Date(c.played_at ?? c.created_at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}
                  </span>
                  {c.video_url && (
                    <a href={c.video_url} target="_blank" rel="noreferrer" className="text-sm text-accent-2 underline">
                      Video
                    </a>
                  )}
                  {replayHref(c) && (
                    <Link href={replayHref(c)!} className="text-sm text-accent-2 underline">
                      🔁 Nachspielen
                    </Link>
                  )}
                  {isAdmin && (
                    <AdminDeleteRound kind="challenge" id={c.id} name={c.title}>
                      🗑
                    </AdminDeleteRound>
                  )}
                </li>
              ))}
              {list.length === 0 && <li className="py-2 text-muted">Keine Challenges gefunden.</li>}
            </ul>
          </section>
        </>
      )}
    </>
  )
}

function Stat({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <div className="panel p-4 text-center">
      <div className={clsx("font-display text-3xl", className)}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={clsx("rounded-lg px-2.5 py-1", active ? "bg-accent text-black" : "bg-panel-2 text-muted hover:text-white")}>
      {children}
    </Link>
  )
}

function SortTh({
  label,
  k,
  sort,
  href,
}: {
  label: string
  k: SortKey
  sort: SortKey
  href: (key: keyof Params, value?: string) => string
}) {
  return (
    <th className="py-2 text-right">
      <Link href={href("sort", k)} className={clsx("hover:text-white", sort === k && "text-accent")}>
        {label}
        {sort === k && " ▼"}
      </Link>
    </th>
  )
}
