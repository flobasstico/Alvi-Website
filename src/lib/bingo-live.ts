import type { SupabaseClient } from "@supabase/supabase-js"
import { bingoScore, rankEntries, type RankEntry } from "./bingo"
import type { Database, Tables } from "./database.types"

export type BingoRound = Tables<"bingo_rounds">
export type BingoPlayer = Tables<"bingo_round_players">
export type BingoState = { round: BingoRound; players: BingoPlayer[]; streamerId: string | null }

/** Eine Bingo-Runde; ohne id die neueste offizielle (für die festen OBS-Links) */
export async function fetchRound(supabase: SupabaseClient<Database>, id: number | null): Promise<BingoState | null> {
  const query = supabase.from("bingo_rounds").select("*")
  const [{ data: round }, { data: setting }] = await Promise.all([
    id ? query.eq("id", id).maybeSingle() : query.eq("official", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("site_settings").select("value").eq("key", "main_creator_login").maybeSingle(),
  ])
  if (!round) return null
  const [{ data: players }, { data: streamer }] = await Promise.all([
    supabase.from("bingo_round_players").select("*").eq("round_id", round.id).order("joined_at"),
    setting?.value
      ? supabase.from("profiles").select("id").ilike("twitch_login", setting.value).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  return { round, players: players ?? [], streamerId: streamer?.id ?? null }
}

/** Live-Punkterangliste der Runde (jeder mit seinen eigenen Häkchen) */
export function ranking(state: BingoState): RankEntry[] {
  return rankEntries(
    state.players.map((p) => ({
      key: p.user_id,
      name: p.display_name ?? "Spieler",
      avatar: p.avatar_url,
      streamer: p.user_id === state.streamerId,
      joinedAt: p.joined_at,
      score: bingoScore(p.marks),
    })),
  )
}

/** Wessen Karte das Overlay zeigt: Alvi, wenn er mitspielt, sonst der Host */
export function featuredPlayer(state: BingoState): BingoPlayer | null {
  return (
    state.players.find((p) => p.user_id === state.streamerId) ?? state.players.find((p) => p.user_id === state.round.host_id) ?? state.players[0] ?? null
  )
}
