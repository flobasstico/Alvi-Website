import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"
import { sortGames, type WinState } from "./winchallenge"

/** Stand einer Winchallenge; ohne id die neueste offizielle (für den festen OBS-Link – Nachspiel-Runden von Zuschauern nie) */
export async function fetchWin(supabase: SupabaseClient<Database>, id: number | null): Promise<WinState | null> {
  const query = supabase.from("win_challenges").select("*")
  // Fehler werfen statt „gibt es nicht“ melden – sonst verschwindet die Runde nach einem Netzfehler
  const { data: challenge, error } = id
    ? await query.eq("id", id).maybeSingle()
    : await query.eq("official", true).order("created_at", { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  if (!challenge) return null
  const { data: games, error: gamesError } = await supabase.from("win_challenge_games").select("*").eq("challenge_id", challenge.id)
  if (gamesError) throw gamesError
  return { challenge, games: sortGames(games ?? []) }
}
