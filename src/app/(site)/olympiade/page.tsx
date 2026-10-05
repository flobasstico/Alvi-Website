import Link from "next/link"
import { PageTitle } from "@/components/page-title"
import { OLYMPIC_STATUS } from "@/lib/olympiade"
import { getViewer } from "@/lib/supabase/server"
import { CreateOlympic } from "./create-olympic"

export const metadata = { title: "Olympiade" }

export default async function OlympiadePage() {
  const { supabase, user } = await getViewer()
  const [{ data: list }, { data: players }, { data: games }] = await Promise.all([
    supabase.from("olympics").select("*").eq("official", true).order("created_at", { ascending: false }).limit(30),
    supabase.from("olympic_players").select("olympic_id, display_name, won"),
    supabase.from("olympic_games").select("olympic_id, position"),
  ])
  const info = (id: number) => {
    const p = (players ?? []).filter((x) => x.olympic_id === id)
    const g = (games ?? []).filter((x) => x.olympic_id === id)
    return { count: p.length, winners: p.filter((x) => x.won).map((x) => x.display_name), drawn: g.filter((x) => x.position != null).length, games: g.length }
  }

  return (
    <>
      <PageTitle
        title="Olympiade"
        subtitle="Spiele aufs Glücksrad, drehen, extern spielen und den Sieger markieren. Jedes Spiel ist einen Punkt mehr wert: 1., 2., 3. Spiel = 1, 2, 3 Punkte …"
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <section className="panel">
          <h2 className="mb-3 font-display text-2xl">Olympiaden</h2>
          <ul className="flex flex-col gap-2">
            {list?.map((o) => {
              const i = info(o.id)
              return (
                <li key={o.id}>
                  <Link href={`/olympiade/${o.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-bg/40 p-3 hover:border-accent">
                    <span className="font-display text-xl">{o.title ?? `Olympiade #${o.id}`}</span>
                    <span className="text-sm text-muted">👥 {i.count} · 🎮 {i.drawn}/{i.games}</span>
                    <span className="chip ml-auto">
                      {OLYMPIC_STATUS[o.status]}
                      {i.winners.length ? ` · 🏆 ${i.winners.join(", ")}` : ""}
                    </span>
                  </Link>
                </li>
              )
            })}
            {!list?.length && <li className="text-muted">Noch keine Olympiaden.</li>}
          </ul>
        </section>
        <aside className="panel h-fit">
          <h2 className="mb-3 font-display text-2xl">Neue Olympiade</h2>
          {user ? <CreateOlympic /> : <p className="text-muted">Mit Twitch einloggen, um eine Olympiade zu eröffnen.</p>}
        </aside>
      </div>
    </>
  )
}
