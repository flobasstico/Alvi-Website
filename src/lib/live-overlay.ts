import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "./database.types"

/** Letztes Ergebnis einer Person für die kleinen OBS-Anzeigen */
export type OverlayKind = "loadout" | "drop"
export type LoadoutOverlay = { items: ({ name: string; rarity: string; type: string; icon_url?: string | null } | null)[] }
export type DropOverlay = { circles: { player: string; spot: string; color: string }[]; rule: string | null }

type Client = SupabaseClient<Database>

/** Ergebnis speichern (nur mit Login; ohne Login passiert nichts) */
export async function pushOverlay(supabase: Client, kind: "loadout", data: LoadoutOverlay): Promise<void>
export async function pushOverlay(supabase: Client, kind: "drop", data: DropOverlay): Promise<void>
export async function pushOverlay(supabase: Client, kind: OverlayKind, data: LoadoutOverlay | DropOverlay) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return
  await supabase
    .from("live_overlays")
    .upsert({ user_id: auth.user.id, kind, data: data as unknown as Json, updated_at: new Date().toISOString() }, { onConflict: "user_id,kind" })
}

export async function fetchOverlay(supabase: Client, userId: string, kind: OverlayKind) {
  const { data } = await supabase.from("live_overlays").select("data, updated_at").eq("user_id", userId).eq("kind", kind).maybeSingle()
  return data
}
