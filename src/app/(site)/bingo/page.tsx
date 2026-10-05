import { PageTitle } from "@/components/page-title"
import { MAX_POINTS, POINTS_PER_BINGO, POINTS_PER_FIELD } from "@/lib/bingo"
import { fetchBingo } from "@/lib/bingo-live"
import { getViewer } from "@/lib/supabase/server"
import { BingoBoard } from "./bingo-board"
import { StartBingo } from "./start-bingo"

export const metadata = { title: "Bingo" }

export default async function BingoPage() {
  const { supabase, user, isAdmin } = await getViewer()
  const initial = await fetchBingo(supabase)

  return (
    <>
      <PageTitle
        title="Bingo"
        subtitle={`Alvi spielt – ihr fiebert mit eurer eigenen 3×3-Karte mit. ${POINTS_PER_FIELD} Punkt pro erledigtem Feld, +${POINTS_PER_BINGO} pro Bingo (Reihe, Spalte, Diagonale), maximal ${MAX_POINTS}.`}
      />
      {isAdmin && <StartBingo running={initial.game?.status === "laeuft"} />}
      {initial.game ? (
        <BingoBoard initial={initial} userId={user?.id ?? null} isAdmin={isAdmin} />
      ) : (
        <p className="panel text-muted">Noch keine Bingo-Runde gestartet.</p>
      )}
    </>
  )
}
