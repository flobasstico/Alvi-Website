import { privateIds, PRIVATE_NAME } from "@/lib/privacy"
import Link from "next/link"
import { PageTitle } from "@/components/page-title"
import { StaleNote } from "@/components/replay-button"
import { MAX_POINTS, POINTS_PER_BINGO, POINTS_PER_FIELD } from "@/lib/bingo"
import { getViewer } from "@/lib/supabase/server"

export const metadata = { title: "Bingo" }

const STATUS: Record<string, string> = { lobby: "Lobby", laeuft: "Läuft", beendet: "Beendet" }

export default async function BingoPage() {
  const { supabase, user } = await getViewer()
  const { data: rounds } = await supabase.from("bingo_rounds").select("*").eq("official", true).order("created_at", { ascending: false }).limit(30)
  const ids = (rounds ?? []).map((r) => r.id)
  const { data: players } = ids.length
    ? await supabase.from("bingo_round_players").select("round_id, user_id, display_name, won").in("round_id", ids)
    : { data: [] }
  const hidden = await privateIds(supabase, (players ?? []).filter((p) => p.won).map((p) => p.user_id))
  const byRound = new Map<number, { count: number; winners: string[] }>()
  for (const p of players ?? []) {
    const e = byRound.get(p.round_id) ?? { count: 0, winners: [] }
    e.count++
    if (p.won && p.display_name) e.winners.push(hidden.has(p.user_id) ? PRIVATE_NAME : p.display_name)
    byRound.set(p.round_id, e)
  }

  return (
    <>
      <PageTitle
        title="Bingo"
        subtitle={`Alle spielen dieselbe 3×3-Karte, jeder hakt für sich ab. ${POINTS_PER_FIELD} Punkt pro Feld, +${POINTS_PER_BINGO} pro Bingo (Reihe, Spalte, Diagonale), maximal ${MAX_POINTS}.`}
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {user ? (
          <Link href="/bingo/neu" className="btn-primary">+ Neue Runde</Link>
        ) : (
          <span className="text-sm text-muted">Zum Mitspielen mit Twitch einloggen.</span>
        )}
        <Link href="/bingo/karten" className="btn-secondary">🃏 Karten ansehen &amp; erstellen</Link>
      </div>
      <section className="panel">
        <h2 className="mb-1 font-display text-2xl">Runden</h2>
          <StaleNote game="bingo" className="mb-3 text-xs text-muted" />
        <ul className="flex flex-col gap-2">
          {rounds?.map((r) => {
            const info = byRound.get(r.id)
            return (
              <li key={r.id}>
                <Link href={`/bingo/${r.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-bg/40 p-3 hover:border-accent">
                  <span className="font-display text-xl">{r.title ?? `Runde #${r.id}`}</span>
                  <span className="text-sm text-muted">👥 {info?.count ?? 0}</span>
                  <span className="chip ml-auto">
                    {STATUS[r.status]}
                    {info?.winners.length ? ` · 🏆 ${info.winners.join(", ")}` : ""}
                  </span>
                </Link>
              </li>
            )
          })}
          {!rounds?.length && <li className="text-muted">Noch keine Runden.</li>}
        </ul>
      </section>
    </>
  )
}
