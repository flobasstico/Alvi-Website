"use server"

import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/supabase/server"

export async function createLoadoutSession(_: unknown, form: FormData): Promise<{ error: string } | undefined> {
  const supabase = await requireAdmin()
  const { data, error } = await supabase.rpc("loadout_create", {
    p_title: String(form.get("title") ?? ""),
    p_rarities: form.getAll("rarity").map(String),
    p_must_heal: form.get("mustHeal") === "on",
  })
  if (error) return { error: error.message }
  redirect(`/loadout/${data}`)
}
