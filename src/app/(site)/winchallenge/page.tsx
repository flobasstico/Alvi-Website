import Link from "next/link"
import { PageTitle } from "@/components/page-title"
import { getViewer } from "@/lib/supabase/server"
import { CreateWin } from "./create-win"

export const metadata = { title: "Winchallenge" }

const STATUS: Record<string, string> = { bereit: "Bereit", laeuft: "Läuft", pausiert: "Pausiert", beendet: "Beendet" }

export default async function WinPage() {
  const { supabase, isAdmin } = await getViewer()
  const [{ data: list }, { data: games }] = await Promise.all([
    supabase.from("win_challenges").select("*").eq("official", true).order("created_at", { ascending: false }).limit(30),
    supabase.from("win_challenge_games").select("challenge_id, wins, target"),
  ])
  const sum = (id: number) => {
    const g = (games ?? []).filter((x) => x.challenge_id === id)
    return `${g.reduce((s, x) => s + Math.min(x.wins, x.target), 0)}/${g.reduce((s, x) => s + x.target, 0)} Siege`
  }

  return (
    <>
      <PageTitle title="Winchallenge" subtitle="Spiele mit Ziel-Siegen, ein gemeinsamer Timer – schaffst du alle Siege, bevor die Zeit abläuft? Mit OBS-Overlay." />
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <section className="panel">
          <h2 className="mb-3 font-display text-2xl">Winchallenges</h2>
          <ul className="flex flex-col gap-2">
            {list?.map((w) => (
              <li key={w.id}>
                <Link href={`/winchallenge/${w.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-bg/40 p-3 hover:border-accent">
                  <span className="font-display text-xl">{w.title ?? `Winchallenge #${w.id}`}</span>
                  <span className="text-sm text-muted">{sum(w.id)}</span>
                  <span className="chip ml-auto">
                    {STATUS[w.status]}
                    {w.result && ` · ${w.result}`}
                  </span>
                </Link>
              </li>
            ))}
            {!list?.length && <li className="text-muted">Noch keine Winchallenges.</li>}
          </ul>
        </section>
        {isAdmin && (
          <aside className="panel h-fit">
            <h2 className="mb-3 font-display text-2xl">Neue Winchallenge</h2>
            <CreateWin />
          </aside>
        )}
      </div>
    </>
  )
}
