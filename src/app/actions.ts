"use server"

import { revalidatePath } from "next/cache"
import type { Json } from "@/lib/database.types"
import type { Source, Status } from "@/lib/constants"
import { requireAdmin } from "@/lib/supabase/server"

export async function saveChallenge(input: {
  title: string
  description?: string
  source: Source
  config: Json
  status?: Status
}) {
  const supabase = await requireAdmin()
  const { data, error } = await supabase
    .from("challenges")
    .insert({
      title: input.title.slice(0, 200),
      description: input.description ?? null,
      source: input.source,
      config: input.config,
      status: input.status ?? "geplant",
      played_at: input.status === "aktiv" ? new Date().toISOString() : null,
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  revalidatePath("/stats")
  revalidatePath("/")
  return data.id
}

export async function setChallengeStatus(id: number, status: Status, videoUrl?: string | null) {
  const supabase = await requireAdmin()
  const patch: { status: Status; played_at?: string; video_url?: string | null } = { status }
  if (status !== "geplant") patch.played_at = new Date().toISOString()
  if (videoUrl !== undefined) patch.video_url = videoUrl || null
  const { error } = await supabase.from("challenges").update(patch).eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/", "layout")
}
