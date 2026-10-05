"use server"

import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/supabase/server"

export async function createWinChallenge(_: unknown, form: FormData): Promise<{ error: string } | undefined> {
  const supabase = await requireAdmin()
  const names = form.getAll("game_name").map((v) => String(v).trim().slice(0, 60))
  const targets = form.getAll("game_target").map((v) => Math.min(999, Math.max(1, Math.round(Number(v)) || 1)))
  const games = names.map((name, i) => ({ name, target: targets[i] ?? 1 })).filter((g) => g.name)
  if (!games.length) return { error: "Mindestens ein Spiel eintragen" }
  const minutes = Math.min(1440, Math.max(0, Number(form.get("minutes")) || 0))

  const { data, error } = await supabase
    .from("win_challenges")
    .insert({ title: String(form.get("title") ?? "").trim().slice(0, 80) || null, duration_s: Math.round(minutes * 60) })
    .select("id")
    .single()
  if (error) return { error: error.message }
  const { error: e2 } = await supabase.from("win_challenge_games").insert(games.map((g, i) => ({ ...g, position: i, challenge_id: data.id })))
  if (e2) return { error: e2.message }
  redirect(`/winchallenge/${data.id}`)
}

