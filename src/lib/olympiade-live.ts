import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"
import type { OlympicState } from "./olympiade"

/** Eine Olympiade; ohne id die neueste offizielle (für den festen OBS-Link) */
export async function fetchOlympic(supabase: SupabaseClient<Database>, id: number | null): Promise<OlympicState | null> {
  const query = supabase.from("olympics").select("*")
  const [{ data: olympic }, { data: setting }] = await Promise.all([
    id ? query.eq("id", id).maybeSingle() : query.eq("official", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("site_settings").select("value").eq("key", "main_creator_login").maybeSingle(),
  ])
  if (!olympic) return null
  const [{ data: games }, { data: players }, { data: streamer }] = await Promise.all([
    supabase.from("olympic_games").select("*").eq("olympic_id", olympic.id).order("id"),
    supabase.from("olympic_players").select("*").eq("olympic_id", olympic.id).order("joined_at"),
    setting?.value
      ? supabase.from("profiles").select("id").ilike("twitch_login", setting.value).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  return { olympic, games: games ?? [], players: players ?? [], streamerId: streamer?.id ?? null }
}
