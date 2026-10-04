import Link from "next/link"
import clsx from "clsx"
import { PageTitle } from "@/components/page-title"
import { SOURCE_LABEL, SOURCES, STATUS_LABEL, STATUSES, type Source, type Status } from "@/lib/constants"
import { rateQuip, streaks, successRate } from "@/lib/stats"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Challenge-Stats" }

const STATUS_CLASS: Record<Status, string> = {
  geplant: "bg-panel-2 text-muted",
  aktiv: "bg-accent-2/20 text-accent-2",
  geschafft: "bg-win/20 text-win",
  gescheitert: "bg-fail/20 text-fail",
}

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ quelle?: string; status?: string }> }) {
  const { quelle, status } = await searchParams
  const supabase = await createClient()
  const [{ data: stats }, { data: all }] = await Promise.all([
    supabase.from("challenge_stats").select("*"),
    supabase.from("challenges").select("*").order("created_at", { ascending: false }),
  ])

  const total = stats?.find((s) => s.source === null)
  const rate = successRate(total?.won ?? 0, total?.finished ?? 0)
  const st = streaks(all ?? [])
  const list = (all ?? []).filter((c) => (!quelle || c.source === quelle) && (!status || c.status === status))

  const filterLink = (key: "quelle" | "status", value?: string) => {
    const p = new URLSearchParams()
    const next = { quelle, status, [key]: value }
    if (next.quelle) p.set("quelle", next.quelle)
    if (next.status) p.set("status", next.status)
    const q = p.toString()
    return q ? `/stats?${q}` : "/stats"
  }

  return (
    <>
      <PageTitle title="Challenge-Stats" subtitle="Die schonungslose Wahrheit." />

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
            </li>
          ))}
          {list.length === 0 && <li className="py-2 text-muted">Keine Challenges gefunden.</li>}
        </ul>
      </section>
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
