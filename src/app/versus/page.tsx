import Link from "next/link"
import { PageTitle } from "@/components/page-title"
import { getViewer } from "@/lib/supabase/server"
import { createMatch } from "./actions"

export const metadata = { title: "Versus" }

const STATUS: Record<string, string> = { bereit: "Bereit", laeuft: "Läuft", pausiert: "Pausiert", beendet: "Beendet" }

export default async function VersusPage() {
  const { supabase, isAdmin } = await getViewer()
  const { data: matches } = await supabase.from("versus_matches").select("*").order("created_at", { ascending: false }).limit(50)

  return (
    <>
      <PageTitle title="Versus-Scoreboard" subtitle="Duelle gegen andere Creator – mit Live-Punktestand, Timer und Checkliste." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="panel">
          <h2 className="mb-3 font-display text-2xl">Duelle</h2>
          <ul className="flex flex-col gap-2">
            {matches?.map((m) => (
              <li key={m.id}>
                <Link href={`/versus/${m.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-bg/40 p-3 hover:border-accent">
                  <span className="font-display text-xl">
                    Alvi <span className="text-accent">{m.score_alvi}</span> : <span className="text-accent-2">{m.score_opponent}</span> {m.opponent_name}
                  </span>
                  {m.title && <span className="text-sm text-muted">{m.title}</span>}
                  <span className="chip ml-auto">{STATUS[m.status] ?? m.status}</span>
                </Link>
              </li>
            ))}
            {!matches?.length && <li className="text-muted">Noch keine Duelle.</li>}
          </ul>
        </section>
        {isAdmin && (
          <aside className="panel h-fit">
            <h2 className="mb-3 font-display text-2xl">Neues Duell</h2>
            <form action={createMatch} className="flex flex-col gap-3">
              <div>
                <label className="label" htmlFor="opponent">Gegner</label>
                <input id="opponent" name="opponent" className="input" required placeholder="Creator-Name" />
              </div>
              <div>
                <label className="label" htmlFor="title">Titel (optional)</label>
                <input id="title" name="title" className="input" placeholder="z. B. Nur graue Waffen" />
              </div>
              <div>
                <label className="label" htmlFor="minutes">Dauer (Minuten)</label>
                <input id="minutes" name="minutes" type="number" min={1} max={180} defaultValue={30} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="checklist">Checkliste (eine Aufgabe pro Zeile)</label>
                <textarea
                  id="checklist"
                  name="checklist"
                  className="input min-h-28"
                  defaultValue={"5 seltene Items gefunden\n3 Kills\nTop 10 erreicht"}
                />
              </div>
              <button className="btn-primary">Duell anlegen</button>
            </form>
          </aside>
        )}
      </div>
    </>
  )
}
