"use server"

import { revalidatePath } from "next/cache"
import { BINGO_CELLS, bingoScore, markedCells } from "@/lib/bingo"
import { shuffle } from "@/lib/random"
import { requireAdmin } from "@/lib/supabase/server"

export async function startBingo(title: string) {
  const supabase = await requireAdmin()
  const { data: tasks, error } = await supabase.from("bingo_tasks").select("id").eq("active", true)
  if (error) throw new Error(error.message)
  if (!tasks || tasks.length < BINGO_CELLS) throw new Error(`Mindestens ${BINGO_CELLS} aktive Bingo-Aufgaben nötig`)
  await supabase.from("bingo_games").update({ status: "beendet" }).eq("status", "laeuft")
  // Die ersten 9 sind Alvis Karte, Zuschauer ziehen aus allen
  const { error: e2 } = await supabase
    .from("bingo_games")
    .insert({ title: title.trim() || null, task_ids: shuffle(tasks.map((t) => t.id)) })
  if (e2) throw new Error(e2.message)
  revalidatePath("/bingo")
}

export async function endBingo(gameId: number) {
  const supabase = await requireAdmin()
  const [{ data: game, error }, { data: marks }] = await Promise.all([
    supabase.from("bingo_games").select("*").eq("id", gameId).single(),
    supabase.from("bingo_marks").select("task_id").eq("game_id", gameId),
  ])
  if (error) throw new Error(error.message)
  // Geschafft nur mit voller Karte (alle 9 Felder)
  const score = bingoScore(markedCells(game.task_ids.slice(0, BINGO_CELLS), new Set((marks ?? []).map((m) => m.task_id))))
  const { data: ch, error: e1 } = await supabase
    .from("challenges")
    .insert({
      title: `Bingo${game.title ? `: ${game.title}` : ""} – ${score.points} Punkte`,
      source: "bingo",
      status: score.full ? "geschafft" : "gescheitert",
      played_at: new Date().toISOString(),
      config: { game_id: gameId, points: score.points, fields: score.fields, bingos: score.bingos },
    })
    .select("id")
    .single()
  if (e1) throw new Error(e1.message)
  const { error: e2 } = await supabase.from("bingo_games").update({ status: "beendet", challenge_id: ch.id }).eq("id", gameId)
  if (e2) throw new Error(e2.message)
  revalidatePath("/bingo")
  revalidatePath("/stats")
  return score.full
}
