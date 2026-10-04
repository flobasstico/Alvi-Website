"use server"

import { revalidatePath } from "next/cache"
import { hasBingo, markedCells } from "@/lib/bingo"
import { shuffle } from "@/lib/random"
import { requireAdmin } from "@/lib/supabase/server"

export async function startBingo(title: string) {
  const supabase = await requireAdmin()
  const { data: tasks, error } = await supabase.from("bingo_tasks").select("id").eq("active", true)
  if (error) throw new Error(error.message)
  if (!tasks || tasks.length < 25) throw new Error("Mindestens 25 aktive Bingo-Aufgaben nötig")
  await supabase.from("bingo_games").update({ status: "beendet" }).eq("status", "laeuft")
  // Die ersten 25 sind Alvis Karte, Zuschauer ziehen aus allen
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
  const won = hasBingo(markedCells(game.task_ids.slice(0, 25), new Set((marks ?? []).map((m) => m.task_id))))
  const { data: ch, error: e1 } = await supabase
    .from("challenges")
    .insert({
      title: `Bingo${game.title ? `: ${game.title}` : ""}`,
      source: "bingo",
      status: won ? "geschafft" : "gescheitert",
      played_at: new Date().toISOString(),
      config: { game_id: gameId, marked: marks?.length ?? 0 },
    })
    .select("id")
    .single()
  if (e1) throw new Error(e1.message)
  const { error: e2 } = await supabase.from("bingo_games").update({ status: "beendet", challenge_id: ch.id }).eq("id", gameId)
  if (e2) throw new Error(e2.message)
  revalidatePath("/bingo")
  revalidatePath("/stats")
  return won
}
