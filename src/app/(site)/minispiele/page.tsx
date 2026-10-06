import Link from "next/link"
import { PageTitle } from "@/components/page-title"
import { MINIGAMES } from "@/lib/minigames"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Minispiele" }

export default async function MinispielePage() {
  const supabase = await createClient()
  const games = await Promise.all(
    MINIGAMES.map(async (g) => {
      const [{ data: today }, { data: ever }, { data: alvi }] = await Promise.all([
        supabase.rpc("minigame_board", { p_game: g.key, p_period: "heute", p_limit: 1 }),
        supabase.rpc("minigame_board", { p_game: g.key, p_period: "ewig", p_limit: 1 }),
        supabase.rpc("minigame_alvi_best", { p_game: g.key }),
      ])
      return { ...g, today: today?.[0] ?? null, ever: ever?.[0] ?? null, alvi: alvi ?? null }
    }),
  )

  return (
    <>
      <PageTitle title="Minispiele" subtitle="Kleine Spiele für zwischendurch – mit Twitch-Login landest du in der Bestenliste. Schaffst du es, Alvi zu schlagen?" />
      <div className="grid gap-4 md:grid-cols-2">
        {games.map((g) => (
          <Link key={g.key} href={`/minispiele/${g.key}`} className="panel group transition hover:-translate-y-1 hover:border-accent">
            <div className="text-5xl">{g.emoji}</div>
            <h2 className="mt-2 font-display text-3xl group-hover:text-accent">{g.title}</h2>
            <p className="text-sm text-muted">{g.text}</p>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <Highscore label="Heute" entry={g.today} />
              <Highscore label="Ewig" entry={g.ever} />
              <div className="rounded-lg bg-panel-2 px-1 py-2">
                <dt className="text-[11px] uppercase text-muted">Alvi</dt>
                <dd className="font-display text-xl text-accent">{g.alvi !== null ? g.alvi.toLocaleString("de-DE") : "–"}</dd>
              </div>
            </dl>
            <span className="btn-primary mt-4 w-full">▶ Spielen</span>
          </Link>
        ))}
      </div>
    </>
  )
}

function Highscore({ label, entry }: { label: string; entry: { name: string | null; score: number } | null }) {
  return (
    <div className="min-w-0 rounded-lg bg-panel-2 px-1 py-2">
      <dt className="text-[11px] uppercase text-muted">{label}</dt>
      <dd className="font-display text-xl text-accent">{entry ? entry.score.toLocaleString("de-DE") : "–"}</dd>
      {entry && <dd className="truncate text-xs text-muted">{entry.name}</dd>}
    </div>
  )
}
