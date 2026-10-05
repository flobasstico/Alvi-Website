import type { SupabaseClient } from "@supabase/supabase-js"
import { BINGO_CELLS, bingoScore, markedCells, rankEntries, type RankEntry } from "./bingo"
import type { Database, Tables } from "./database.types"

export type BingoCard = { user_id: string; task_ids: number[]; created_at: string; name: string; avatar: string | null }
export type BingoState = {
  game: Tables<"bingo_games"> | null
  tasks: { id: number; text: string }[]
  marks: number[]
  cards: BingoCard[]
  streamerName: string
}

/**
 * Kompletter Stand der neuesten Bingo-Runde (Seite und OBS-Overlays).
 * Die Overlays zeigen immer die neueste Runde – der OBS-Link bleibt dadurch über alle Runden gleich.
 */
export async function fetchBingo(supabase: SupabaseClient<Database>): Promise<BingoState> {
  const [{ data: game }, { data: setting }] = await Promise.all([
    supabase.from("bingo_games").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("site_settings").select("value").eq("key", "main_creator_login").maybeSingle(),
  ])
  const streamerLogin = setting?.value ?? null
  if (!game) return { game: null, tasks: [], marks: [], cards: [], streamerName: "Alvi" }

  const [{ data: tasks }, { data: marks }, { data: cards }, { data: streamer }] = await Promise.all([
    supabase.from("bingo_tasks").select("id, text").in("id", game.task_ids),
    supabase.from("bingo_marks").select("task_id").eq("game_id", game.id),
    supabase.from("bingo_cards").select("user_id, task_ids, created_at").eq("game_id", game.id).order("created_at"),
    streamerLogin
      ? supabase.from("profiles").select("display_name").ilike("twitch_login", streamerLogin).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const ids = (cards ?? []).map((c) => c.user_id)
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids)
    : { data: [] }
  const prof = new Map((profiles ?? []).map((p) => [p.id, p]))
  return {
    game,
    tasks: tasks ?? [],
    marks: (marks ?? []).map((m) => Number(m.task_id)),
    cards: (cards ?? []).map((c) => ({
      user_id: c.user_id,
      task_ids: c.task_ids.map(Number),
      created_at: c.created_at,
      name: prof.get(c.user_id)?.display_name ?? "Zuschauer",
      avatar: prof.get(c.user_id)?.avatar_url ?? null,
    })),
    streamerName: streamer?.display_name ?? "Alvi",
  }
}

/** Alvis Karte = die ersten 9 Aufgaben der Runde */
export const streamerCard = (game: Tables<"bingo_games">) => game.task_ids.slice(0, BINGO_CELLS).map(Number)

/** Punkte-Rangliste aller Teilnehmer der Runde (Alvi + Zuschauer-Karten) */
export function ranking(state: BingoState, marks: ReadonlySet<number>): RankEntry[] {
  if (!state.game) return []
  return rankEntries([
    {
      key: "streamer",
      name: state.streamerName,
      avatar: null,
      streamer: true,
      joinedAt: state.game.started_at,
      score: bingoScore(markedCells(streamerCard(state.game), marks)),
    },
    ...state.cards.map((c) => ({
      key: c.user_id,
      name: c.name,
      avatar: c.avatar,
      streamer: false,
      joinedAt: c.created_at,
      score: bingoScore(markedCells(c.task_ids, marks)),
    })),
  ])
}
