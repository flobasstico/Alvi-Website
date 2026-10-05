import Link from "next/link"
import { PageTitle } from "@/components/page-title"
import { StaleNote } from "@/components/replay-button"
import { getViewer } from "@/lib/supabase/server"
import { CreateEscalation } from "./create-escalation"

export const metadata = { title: "Regel-Eskalation" }

const STATUS: Record<string, string> = { bereit: "Bereit", laeuft: "Läuft", beendet: "Beendet" }

export default async function EskalationPage() {
  const { supabase, isAdmin } = await getViewer()
  const [{ data: sessions }, { data: pool }] = await Promise.all([
    supabase.from("escalation_sessions").select("*").eq("official", true).order("created_at", { ascending: false }).limit(30),
    supabase.from("escalation_rules").select("kind").eq("active", true),
  ])

  return (
    <>
      <PageTitle
        title="Regel-Eskalation"
        subtitle="Grundregel per Glücksrad, dann kommt alle 4 Minuten eine neue Regel dazu – per Zufall oder per Twitch-Chat-Abstimmung, mit Alarm und OBS-Overlay."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="panel">
          <h2 className="mb-1 font-display text-2xl">Runden</h2>
          <StaleNote game="eskalation" className="mb-3 text-xs text-muted" />
          <ul className="flex flex-col gap-2">
            {sessions?.map((s) => (
              <li key={s.id}>
                <Link href={`/eskalation/${s.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-bg/40 p-3 hover:border-accent">
                  <span className="font-display text-xl">{s.title ?? `Runde #${s.id}`}</span>
                  <span className="text-sm text-muted">
                    alle {Math.round(s.interval_s / 6) / 10} Min.{s.mode === "chat" && ` · 💬 Chat-Abstimmung #${s.twitch_channel}`}
                  </span>
                  <span className="chip ml-auto">
                    {STATUS[s.status]}
                    {s.result && ` · ${s.result}`}
                  </span>
                </Link>
              </li>
            ))}
            {!sessions?.length && <li className="text-muted">Noch keine Runden.</li>}
          </ul>
        </section>
        {isAdmin && (
          <aside className="panel h-fit">
            <h2 className="mb-3 font-display text-2xl">Neue Runde</h2>
            <CreateEscalation
              baseCount={pool?.filter((r) => r.kind === "grund").length ?? 0}
              extraCount={pool?.filter((r) => r.kind !== "grund").length ?? 0}
            />
          </aside>
        )}
      </div>
    </>
  )
}
