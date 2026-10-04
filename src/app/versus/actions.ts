"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/supabase/server"

export async function createMatch(form: FormData) {
  const supabase = await requireAdmin()
  const opponent = String(form.get("opponent") ?? "").trim()
  const title = String(form.get("title") ?? "").trim() || null
  const minutes = Math.min(180, Math.max(1, Number(form.get("minutes")) || 30))
  const checklist = String(form.get("checklist") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 20)
  if (!opponent) throw new Error("Gegner fehlt")

  const { data: match, error } = await supabase
    .from("versus_matches")
    .insert({ opponent_name: opponent, title, duration_s: minutes * 60 })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  if (checklist.length) {
    const { error: e2 } = await supabase
      .from("versus_checklist")
      .insert(checklist.map((text, position) => ({ match_id: match.id, text, position })))
    if (e2) throw new Error(e2.message)
  }
  revalidatePath("/versus")
  redirect(`/versus/${match.id}`)
}

export async function finishMatch(id: number, won: boolean, remaining: number) {
  const supabase = await requireAdmin()
  const { data: m, error } = await supabase.from("versus_matches").select("*").eq("id", id).single()
  if (error) throw new Error(error.message)
  let challengeId = m.challenge_id
  if (!challengeId) {
    const { data: ch, error: e1 } = await supabase
      .from("challenges")
      .insert({
        title: `Versus vs. ${m.opponent_name}${m.title ? ` – ${m.title}` : ""}`,
        source: "versus",
        status: won ? "geschafft" : "gescheitert",
        played_at: new Date().toISOString(),
        config: { opponent: m.opponent_name, score: `${m.score_alvi}:${m.score_opponent}` },
      })
      .select("id")
      .single()
    if (e1) throw new Error(e1.message)
    challengeId = ch.id
  }
  const { error: e2 } = await supabase
    .from("versus_matches")
    .update({ status: "beendet", paused_remaining_s: remaining, challenge_id: challengeId })
    .eq("id", id)
  if (e2) throw new Error(e2.message)
  revalidatePath("/versus")
  revalidatePath("/stats")
}
