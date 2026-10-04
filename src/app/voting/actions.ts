"use server"

import { revalidatePath } from "next/cache"
import { getViewer, requireAdmin } from "@/lib/supabase/server"

export async function submitChallenge(_: unknown, form: FormData): Promise<{ ok: boolean; message: string }> {
  const { supabase, user } = await getViewer()
  if (!user) return { ok: false, message: "Bitte zuerst mit Twitch einloggen." }
  const title = String(form.get("title") ?? "").trim()
  const description = String(form.get("description") ?? "").trim() || null
  if (title.length < 3 || title.length > 120) return { ok: false, message: "Titel muss 3–120 Zeichen lang sein." }
  if (description && description.length > 500) return { ok: false, message: "Beschreibung max. 500 Zeichen." }
  const { error } = await supabase.from("submissions").insert({ title, description, user_id: user.id })
  if (error) {
    const limit = error.code === "42501"
    return { ok: false, message: limit ? "Du hast diese Woche schon 3 Challenges eingereicht." : error.message }
  }
  revalidatePath("/voting")
  return { ok: true, message: "Eingereicht! Jetzt Votes sammeln." }
}

export async function rejectSubmission(id: number) {
  const supabase = await requireAdmin()
  const { error } = await supabase.from("submissions").update({ status: "abgelehnt" }).eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/voting")
}

export async function adoptSubmissions(ids: number[]) {
  const supabase = await requireAdmin()
  const { data: subs, error } = await supabase
    .from("submission_scores")
    .select("id, title, description, week, votes, author_name, challenge_id")
    .in("id", ids)
  if (error) throw new Error(error.message)
  for (const s of subs ?? []) {
    if (s.challenge_id || s.id === null) continue
    const { data: ch, error: e1 } = await supabase
      .from("challenges")
      .insert({
        title: s.title!,
        description: s.description,
        source: "voting",
        config: { week: s.week, votes: s.votes, author: s.author_name, submission_id: s.id },
      })
      .select("id")
      .single()
    if (e1) throw new Error(e1.message)
    const { error: e2 } = await supabase.from("submissions").update({ status: "freigegeben", challenge_id: ch.id }).eq("id", s.id)
    if (e2) throw new Error(e2.message)
  }
  revalidatePath("/voting")
  revalidatePath("/stats")
}
