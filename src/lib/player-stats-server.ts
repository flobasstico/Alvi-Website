import type { createClient } from "@/lib/supabase/server"
import { soloParticipations, type Participation } from "./player-stats"

type Client = Awaited<ReturnType<typeof createClient>>

const ALVI_FALLBACK = "main-creator"

/** Alle Teilnahmen an abgeschlossenen Mehrspieler-Runden und Alvis Solo-Challenges + Namen der Personen */
export async function loadPlayerStats(supabase: Client) {
  const [esc, escPlayers, lo, loPlayers, auc, aucPlayers, bingo, cards, oly, olyPlayers, challenges, linked, setting] = await Promise.all([
    supabase.from("escalation_sessions").select("id, winner_id").eq("status", "beendet"),
    supabase.from("escalation_players").select("session_id, user_id"),
    supabase.from("loadout_sessions").select("id, winner_id").eq("status", "beendet"),
    supabase.from("loadout_players").select("session_id, user_id"),
    supabase.from("auctions").select("id, winner_id").not("decided_at", "is", null),
    supabase.from("auction_players").select("auction_id, user_id"),
    supabase.from("bingo_rounds").select("id").eq("status", "beendet").eq("official", true),
    supabase.from("bingo_round_players").select("round_id, user_id, points, won"),
    supabase.from("olympics").select("id").eq("status", "beendet").eq("official", true),
    supabase.from("olympic_players").select("olympic_id, user_id, points, won"),
    supabase.from("challenges").select("id, source, status").in("status", ["geschafft", "gescheitert"]),
    // Statistik-Einträge, die aus Mehrspieler-Runden stammen (dort schon gezählt)
    Promise.all([
      supabase.from("escalation_sessions").select("challenge_id").not("challenge_id", "is", null),
      supabase.from("loadout_sessions").select("challenge_id").not("challenge_id", "is", null),
      supabase.from("auctions").select("challenge_id").not("challenge_id", "is", null),
      supabase.from("bingo_rounds").select("challenge_id").not("challenge_id", "is", null),
      supabase.from("olympics").select("challenge_id").not("challenge_id", "is", null),
    ]),
    supabase.from("site_settings").select("value").eq("key", "main_creator_login").maybeSingle(),
  ])
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

  // Bingo: Punkte und Sieg stehen nach dem Beenden fest
  const bingoDone = new Set((bingo.data ?? []).map((r) => r.id))
  for (const p of cards.data ?? [])
    if (bingoDone.has(p.round_id)) parts.push({ userId: p.user_id, game: "bingo", round: `bingo-${p.round_id}`, won: p.won, points: p.points ?? 0 })

  // Olympiade: Punkte (Spiel n = n Punkte) und Sieg stehen nach dem Beenden fest
  const olyDone = new Set((oly.data ?? []).map((o) => o.id))
  for (const p of olyPlayers.data ?? [])
    if (olyDone.has(p.olympic_id)) parts.push({ userId: p.user_id, game: "olympiade", round: `oly-${p.olympic_id}`, won: p.won, points: p.points })

  // Alvis Solo-Challenges: Alvi ist der main creator (auch ohne eigenen Login auf der Seite)
  const alviLogin = setting.data?.value?.trim().toLowerCase() || "alvivb"
  const { data: alvi } = await supabase.from("profiles").select("id").ilike("twitch_login", alviLogin).maybeSingle()
  const alviId = alvi?.id ?? ALVI_FALLBACK
  const linkedIds = new Set(linked.flatMap((r) => (r.data ?? []).map((x) => x.challenge_id as number)))
  parts.push(...soloParticipations(challenges.data ?? [], linkedIds, alviId))

  const ids = [...new Set(parts.map((p) => p.userId))].filter((id) => id !== ALVI_FALLBACK)
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, display_name, twitch_login, avatar_url").in("id", ids)
    : { data: [] }
  const names = new Map((profiles ?? []).map((p) => [p.id, { name: p.display_name ?? p.twitch_login ?? "Unbekannt", avatar: p.avatar_url }]))
  if (!names.has(alviId)) names.set(alviId, { name: "Alvi", avatar: null })
  return { parts, names, alviId }
}
