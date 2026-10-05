import type { createClient } from "@/lib/supabase/server"
import { bingoParticipations, type Participation } from "./player-stats"

type Client = Awaited<ReturnType<typeof createClient>>

/** Alle Teilnahmen an abgeschlossenen Mehrspieler-Runden + Namen der Personen */
export async function loadPlayerStats(supabase: Client) {
  const [esc, escPlayers, lo, loPlayers, auc, aucPlayers, bingo, cards, marks, setting] = await Promise.all([
    supabase.from("escalation_sessions").select("id, winner_id").eq("status", "beendet"),
    supabase.from("escalation_players").select("session_id, user_id"),
    supabase.from("loadout_sessions").select("id, winner_id").eq("status", "beendet"),
    supabase.from("loadout_players").select("session_id, user_id"),
    supabase.from("auctions").select("id, winner_id").not("decided_at", "is", null),
    supabase.from("auction_players").select("auction_id, user_id"),
    supabase.from("bingo_games").select("id, task_ids").eq("status", "beendet"),
    supabase.from("bingo_cards").select("game_id, user_id, task_ids"),
    supabase.from("bingo_marks").select("game_id, task_id"),
    supabase.from("site_settings").select("value").eq("key", "main_creator_login").maybeSingle(),
  ])
  const { data: streamer } = setting.data?.value
    ? await supabase.from("profiles").select("id").ilike("twitch_login", setting.data.value).limit(1).maybeSingle()
    : { data: null }

  const parts: Participation[] = []
  const winners = new Map((esc.data ?? []).map((s) => [s.id, s.winner_id]))
  for (const p of escPlayers.data ?? [])
    if (winners.has(p.session_id))
      parts.push({ userId: p.user_id, game: "eskalation", round: `esk-${p.session_id}`, won: winners.get(p.session_id) === p.user_id, points: null })

  const loWinners = new Map((lo.data ?? []).map((s) => [s.id, s.winner_id]))
  for (const p of loPlayers.data ?? [])
    if (loWinners.has(p.session_id))
      parts.push({ userId: p.user_id, game: "loadout", round: `lo-${p.session_id}`, won: loWinners.get(p.session_id) === p.user_id, points: null })

  // Auktion zählt, sobald der Host die Wertung abgeschlossen hat (Sieger oder ohne Wertung)
  const aucWinners = new Map((auc.data ?? []).map((a) => [a.id, a.winner_id]))
  for (const p of aucPlayers.data ?? [])
    if (aucWinners.has(p.auction_id))
      parts.push({ userId: p.user_id, game: "auktion", round: `auk-${p.auction_id}`, won: aucWinners.get(p.auction_id) === p.user_id, points: null })

  for (const g of bingo.data ?? []) {
    const gameMarks = new Set((marks.data ?? []).filter((m) => m.game_id === g.id).map((m) => Number(m.task_id)))
    const gameCards = (cards.data ?? []).filter((c) => c.game_id === g.id).map((c) => ({ user_id: c.user_id, task_ids: c.task_ids.map(Number) }))
    parts.push(...bingoParticipations({ id: g.id, task_ids: g.task_ids.map(Number) }, gameCards, gameMarks, streamer?.id ?? null))
  }

  const ids = [...new Set(parts.map((p) => p.userId))]
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, display_name, twitch_login, avatar_url").in("id", ids)
    : { data: [] }
  const names = new Map((profiles ?? []).map((p) => [p.id, { name: p.display_name ?? p.twitch_login ?? "Unbekannt", avatar: p.avatar_url }]))
  return { parts, names }
}
