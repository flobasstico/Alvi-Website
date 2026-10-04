import { PageTitle } from "@/components/page-title"
import { getViewer } from "@/lib/supabase/server"
import { BingoBoard } from "./bingo-board"
import { StartBingo } from "./start-bingo"

export const metadata = { title: "Bingo" }

export default async function BingoPage() {
  const { supabase, user, isAdmin } = await getViewer()
  const { data: game } = await supabase.from("bingo_games").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle()

  const [{ data: tasks }, { data: marks }, { data: myCard }, { data: winners }] = game
    ? await Promise.all([
        supabase.from("bingo_tasks").select("id, text").in("id", game.task_ids),
        supabase.from("bingo_marks").select("task_id").eq("game_id", game.id),
        user
          ? supabase.from("bingo_cards").select("task_ids").eq("game_id", game.id).eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("bingo_cards").select("user_id, bingo_at").eq("game_id", game.id).not("bingo_at", "is", null).order("bingo_at").limit(10),
      ])
    : [{ data: [] }, { data: [] }, { data: null }, { data: [] }]

  const winnerIds = (winners ?? []).map((w) => w.user_id)
  const { data: profiles } = winnerIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", winnerIds)
    : { data: [] }
  const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name ?? "?"]))

  return (
    <>
      <PageTitle title="Bingo" subtitle="Alvi spielt – ihr fiebert mit eurer eigenen Karte mit. Felder werden live abgehakt." />
      {isAdmin && <StartBingo running={game?.status === "laeuft"} />}
      {game ? (
        <BingoBoard
          game={game}
          tasks={tasks ?? []}
          initialMarks={(marks ?? []).map((m) => m.task_id)}
          myCard={myCard?.task_ids ?? null}
          winners={(winners ?? []).map((w) => ({ name: names.get(w.user_id) ?? "?", at: w.bingo_at! }))}
          loggedIn={!!user}
          isAdmin={isAdmin}
        />
      ) : (
        <p className="panel text-muted">Noch keine Bingo-Runde gestartet.</p>
      )}
    </>
  )
}
