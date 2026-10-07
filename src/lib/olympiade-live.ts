import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"
import type { OlympicState } from "./olympiade"

/** Eine Olympiade; ohne id die neueste offizielle (für den festen OBS-Link) */
export async function fetchOlympic(supabase: SupabaseClient<Database>, id: number | null): Promise<OlympicState | null> {
  const query = supabase.from("olympics").select("*")
  // Fehler werfen statt „gibt es nicht“ melden – sonst gilt eine laufende Runde nach einem Netzfehler als gelöscht
  const [{ data: olympic, error }, { data: setting }] = await Promise.all([
    id ? query.eq("id", id).maybeSingle() : query.eq("official", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("site_settings").select("value").eq("key", "main_creator_login").maybeSingle(),
  ])
  if (error) throw error
  if (!olympic) return null
  const [{ data: games, error: gamesError }, { data: players, error: playersError }, { data: streamer }] = await Promise.all([
    supabase.from("olympic_games").select("*").eq("olympic_id", olympic.id).order("id"),
    supabase.from("olympic_players").select("*").eq("olympic_id", olympic.id).order("joined_at"),
    setting?.value
      ? supabase.from("profiles").select("id").ilike("twitch_login", setting.value.replace(/[%_\\]/g, "\\$&")).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  if (gamesError || playersError) throw gamesError ?? playersError
  return { olympic, games: games ?? [], players: players ?? [], streamerId: streamer?.id ?? null }
}
