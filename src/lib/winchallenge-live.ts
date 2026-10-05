import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"
import { sortGames, type WinState } from "./winchallenge"

/** Stand einer Winchallenge; ohne id die neueste (für den festen OBS-Link) */
export async function fetchWin(supabase: SupabaseClient<Database>, id: number | null): Promise<WinState | null> {
  const query = supabase.from("win_challenges").select("*")
  const { data: challenge } = id
    ? await query.eq("id", id).maybeSingle()
    : await query.order("created_at", { ascending: false }).limit(1).maybeSingle()
  if (!challenge) return null
  const { data: games } = await supabase.from("win_challenge_games").select("*").eq("challenge_id", challenge.id)
  return { challenge, games: sortGames(games ?? []) }
}
