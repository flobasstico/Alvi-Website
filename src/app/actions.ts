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

