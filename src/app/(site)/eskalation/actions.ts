"use server"

import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/supabase/server"

export async function createEscalation(_: unknown, form: FormData): Promise<{ error: string } | undefined> {
  const supabase = await requireAdmin()
  const minutes = Number(form.get("minutes")) || 4
  const mode = form.get("mode") === "chat" ? "chat" : "zufall"
  const { data, error } = await supabase.rpc("escalation_create", {
    p_title: String(form.get("title") ?? ""),
    p_interval_s: Math.round(Math.min(60, Math.max(0.5, minutes)) * 60),
    p_mode: mode,
    p_max_players: Math.min(8, Math.max(2, Math.round(Number(form.get("max_players")) || 4))),
    p_channel: mode === "chat" ? String(form.get("channel") ?? "").trim().replace(/^#/, "").toLowerCase() || null : null,
  })
  if (error) return { error: error.message }
  redirect(`/eskalation/${data}`)
}
