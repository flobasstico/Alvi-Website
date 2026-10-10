"use server"

import { redirect } from "next/navigation"
import { requireUser } from "@/lib/supabase/server"

export async function createLoadoutSession(_: unknown, form: FormData): Promise<{ error: string } | undefined> {
  const supabase = await requireUser()
  const { data, error } = await supabase.rpc("loadout_create", {
    p_title: String(form.get("title") ?? "").trim().slice(0, 80),
    p_rarities: form.getAll("rarity").map(String),
    p_must_heal: form.get("mustHeal") === "on",
    p_max_players: Math.min(8, Math.max(2, Math.round(Number(form.get("max_players")) || 4))),
  })
  if (error) return { error: error.message }
  redirect(`/loadout/${data}`)
}
