import clsx from "clsx"
import Link from "next/link"
import { AdminDeleteRound } from "@/components/admin-delete-round"
import { HeadToHeadBox } from "@/components/league/head-to-head"
import { LineChart } from "@/components/league/line-chart"
import { PieChart } from "@/components/league/pie-chart"
import { YoutubeButton } from "@/components/league/youtube-button"
import { PageTitle } from "@/components/page-title"
import { creatorColors, leagueTable, pointsByResult, pointsTimeline, winShare, type LeagueSort } from "@/lib/league"
import { loadLeague } from "@/lib/league-server"
import { getViewer } from "@/lib/supabase/server"

export const metadata = { title: "Creator-Liga" }

const SORTS: LeagueSort[] = ["ligapunkte", "siege", "teilnahmen", "quote", "punkte"]

export default async function LigaPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const params = await searchParams
  const sort = SORTS.includes(params.sort as LeagueSort) ? (params.sort as LeagueSort) : "ligapunkte"
  const { supabase, isAdmin } = await getViewer()
  const { creators, challenges, results } = await loadLeague(supabase)

  const rows = leagueTable(challenges, results, creators, sort)
  const colors = creatorColors(creators)
  const names = new Map(creators.map((c) => [c.id, c.name]))
  const timeline = pointsTimeline(challenges, results, rows)
  const lp = pointsByResult(results)

  const link = (next: { sort?: string }) => (next.sort ? `/liga?sort=${next.sort}` : "/liga")

  return (
    <>
      <PageTitle
        title="Creator-Liga"
        subtitle="Challenges, die Alvi und seine Kollegen außerhalb der Website spielen – mit Ligapunkten, Siegen und Videos. Wer ist der Beste?"
      />

      {isAdmin && (
        <div className="mb-6 flex justify-end">
          <Link href="/admin?tab=liga" className="btn-secondary px-3 py-1.5 text-sm">
            + Challenge eintragen
          </Link>
        </div>
      )}

      <section className="panel mb-6">
        <h2 className="mb-1 font-display text-2xl">Ewige Tabelle</h2>
        <p className="mb-3 text-sm text-muted">
          Ligapunkte = geschlagene Gegner: Für jeden Teilnehmer, der in einer Challenge hinter dir landet, gibt es 1 Punkt (bei 8 Teilnehmern bekommt der Sieger 7, im Duell 1). Gleiche Plätze teilen sich die Punkte; bei Punkte-Challenges zählt die Rangfolge der Punkte.
        </p>
        {rows.length ? (
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase text-muted">
                  <th className="w-10 py-2">#</th>
                  <th className="py-2">Creator</th>
                  <SortTh label="Ligapunkte" k="ligapunkte" sort={sort} href={link} />
                  <SortTh label="Siege" k="siege" sort={sort} href={link} />
                  <SortTh label="Teilnahmen" k="teilnahmen" sort={sort} href={link} />
                  <SortTh label="Siegquote" k="quote" sort={sort} href={link} />
                  <SortTh label="Punkte" k="punkte" sort={sort} href={link} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.creatorId} className={clsx("border-b border-line/50", i === 0 && "bg-accent/10")}>
                    <td className="py-2 font-display text-lg">{["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`}</td>
                    <td className="py-2">
                      <span className="flex items-center gap-2 font-bold">
                        {r.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                          <span className="h-3 w-3 rounded-full" style={{ background: r.color }} />
                        )}
                        {r.youtube ? (
                          <YoutubeButton url={r.youtube} title={r.name} kind="kanal">
                            {r.name}
                          </YoutubeButton>
                        ) : (
                          r.name
                        )}
                      </span>
                    </td>
                    <td className="py-2 text-right font-display text-lg tabular-nums text-accent">{r.leaguePoints}</td>
                    <td className="py-2 text-right tabular-nums">{r.wins}</td>
                    <td className="py-2 text-right tabular-nums">{r.rounds}</td>
                    <td className="py-2 text-right tabular-nums">{r.winRate} %</td>
                    <td className="py-2 text-right tabular-nums">{r.points ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">Noch keine Challenges eingetragen.</p>
        )}
      </section>

      {rows.length > 0 && (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <section className="panel">
            <h2 className="mb-3 font-display text-2xl">Anteil an allen Siegen</h2>
            <PieChart slices={winShare(rows)} />
          </section>
          <section className="panel">
            <h2 className="mb-3 font-display text-2xl">Kopf an Kopf</h2>
            <HeadToHeadBox creators={rows.map((r) => ({ id: r.creatorId, name: r.name, color: r.color }))} results={results} />
          </section>
          <section className="panel lg:col-span-2">
            <h2 className="mb-3 font-display text-2xl">Ligapunkte im Verlauf</h2>
            <LineChart data={timeline} />
          </section>
        </div>
      )}

      <section className="panel">
        <h2 className="mb-3 font-display text-2xl">Challenges</h2>
        <ul className="flex flex-col gap-3">
          {challenges.map((c) => {
            const res = results.filter((r) => r.challenge_id === c.id).sort((a, b) => a.placement - b.placement)
            return (
              <li key={c.id} className="rounded-xl border border-line bg-bg/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-xl">{c.title}</span>
                  {c.category && <span className="chip">{c.category}</span>}
                  <span className="chip">{c.scoring === "punkte" ? "Punkte" : "Sieg"}</span>
                  <span className="text-xs text-muted">
                    {new Date(c.played_at + "T12:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    <YoutubeButton url={c.youtube_url} title={c.title} />
                    {isAdmin && (
                      <>
                        <Link href={`/admin?tab=liga&bearbeiten=${c.id}`} className="text-sm text-muted underline hover:text-white">
                          Bearbeiten
                        </Link>
                        <AdminDeleteRound kind="liga" id={c.id} name={c.title}>
                          🗑
                        </AdminDeleteRound>
                      </>
                    )}
                  </span>
                </div>
                <ol className="mt-2 flex flex-wrap gap-2 text-sm">
                  {res.map((r) => (
                    <li
                      key={r.creator_id}
                      className={clsx("flex items-center gap-1.5 rounded-full border px-2.5 py-0.5", r.won ? "border-accent bg-accent/10" : "border-line")}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors.get(r.creator_id) }} />
                      <span className="font-semibold">{r.won ? "🏆 " : `${r.placement}. `}{names.get(r.creator_id) ?? "?"}</span>
                      {r.points != null && <span className="text-muted">{r.points} P.</span>}
                      <span className="text-xs text-accent">+{lp.get(`${c.id}-${r.creator_id}`) ?? 0}</span>
                    </li>
                  ))}
                </ol>
              </li>
            )
          })}
          {!challenges.length && <li className="text-muted">Noch keine Challenges eingetragen.</li>}
        </ul>
      </section>
    </>
  )
}

function SortTh({ label, k, sort, href }: { label: string; k: LeagueSort; sort: LeagueSort; href: (n: { sort?: string }) => string }) {
  return (
    <th className="py-2 text-right">
      <Link href={href({ sort: k === "ligapunkte" ? undefined : k })} className={clsx("hover:text-white", sort === k && "text-accent")}>
        {label}
        {sort === k && " ▼"}
      </Link>
    </th>
  )
}
