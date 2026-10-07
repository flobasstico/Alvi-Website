import type { createClient } from "@/lib/supabase/server"
import { selectAll } from "./supabase/select-all"
import { soloParticipations, type Participation, type PlayerGame } from "./player-stats"

type Client = Awaited<ReturnType<typeof createClient>>

const ALVI_FALLBACK = "main-creator"

/** Alle Teilnahmen an abgeschlossenen Mehrspieler-Runden und Alvis Solo-Challenges + Namen der Personen */
/** keepUser: diese Person auch bei privatem Profil mitzählen (für die eigene Profilseite) */
export async function loadPlayerStats(supabase: Client, keepUser?: string) {
  const [esc, escPlayers, lo, loPlayers, auc, aucPlayers, bingo, cards, oly, olyPlayers, challenges, linked, setting, vRounds, vPlayers] = await Promise.all([
    selectAll((a, b) => supabase.from("escalation_sessions").select("id, winner_id").eq("status", "beendet").eq("official", true).order("id").range(a, b)),
    selectAll((a, b) => supabase.from("escalation_players").select("session_id, user_id").order("session_id").order("user_id").range(a, b)),
    selectAll((a, b) => supabase.from("loadout_sessions").select("id, winner_id").eq("status", "beendet").eq("official", true).order("id").range(a, b)),
    selectAll((a, b) => supabase.from("loadout_players").select("session_id, user_id").order("session_id").order("user_id").range(a, b)),
    selectAll((a, b) => supabase.from("auctions").select("id, winner_id").not("decided_at", "is", null).eq("official", true).order("id").range(a, b)),
    selectAll((a, b) => supabase.from("auction_players").select("auction_id, user_id").order("auction_id").order("user_id").range(a, b)),
    selectAll((a, b) => supabase.from("bingo_rounds").select("id").eq("status", "beendet").eq("official", true).order("id").range(a, b)),
    selectAll((a, b) => supabase.from("bingo_round_players").select("round_id, user_id, points, won").order("round_id").order("user_id").range(a, b)),
    selectAll((a, b) => supabase.from("olympics").select("id").eq("status", "beendet").eq("official", true).order("id").range(a, b)),
    selectAll((a, b) => supabase.from("olympic_players").select("olympic_id, user_id, points, won").order("olympic_id").order("user_id").range(a, b)),
    selectAll((a, b) => supabase.from("challenges").select("id, source, status").in("status", ["geschafft", "gescheitert"]).order("id").range(a, b)),
    // Statistik-Einträge, die aus Mehrspieler-Runden stammen (dort schon gezählt)
    Promise.all([
      selectAll((a, b) => supabase.from("escalation_sessions").select("challenge_id").not("challenge_id", "is", null).order("challenge_id").range(a, b)),
      selectAll((a, b) => supabase.from("loadout_sessions").select("challenge_id").not("challenge_id", "is", null).order("challenge_id").range(a, b)),
      selectAll((a, b) => supabase.from("auctions").select("challenge_id").not("challenge_id", "is", null).order("challenge_id").range(a, b)),
      selectAll((a, b) => supabase.from("bingo_rounds").select("challenge_id").not("challenge_id", "is", null).order("challenge_id").range(a, b)),
      selectAll((a, b) => supabase.from("olympics").select("challenge_id").not("challenge_id", "is", null).order("challenge_id").range(a, b)),
    ]),
    supabase.from("site_settings").select("value").eq("key", "main_creator_login").maybeSingle(),
    // Zuschauer-Runden (ohne Admin): Ergebnisse werden beim Beenden festgehalten
    selectAll((a, b) => supabase.from("viewer_rounds").select("id, game").order("id").range(a, b)),
    selectAll((a, b) => supabase.from("viewer_round_players").select("round_id, user_id, won, points").order("round_id").order("user_id").range(a, b)),
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
  const { data: alvi } = await supabase.from("profiles").select("id").ilike("twitch_login", alviLogin.replace(/[%_\\]/g, "\\$&")).limit(1).maybeSingle()
  const alviId = alvi?.id ?? ALVI_FALLBACK
  const linkedIds = new Set(linked.flatMap((r) => (r.data ?? []).map((x) => x.challenge_id as number)))
  parts.push(...soloParticipations(challenges.data ?? [], linkedIds, alviId))

  const gameOf = new Map((vRounds.data ?? []).map((r) => [r.id, r.game as PlayerGame]))
  const viewerParts: Participation[] = (vPlayers.data ?? [])
    .filter((p) => gameOf.has(p.round_id))
    .map((p) => ({ userId: p.user_id, game: gameOf.get(p.round_id)!, round: `zs-${p.round_id}`, won: p.won, points: p.points }))

  const ids = [...new Set([...parts, ...viewerParts].map((p) => p.userId))].filter((id) => id !== ALVI_FALLBACK)
  // in Paketen laden, damit die Anfrage-URL bei vielen Personen nicht zu lang wird
  const chunks = Array.from({ length: Math.ceil(ids.length / 150) }, (_, i) => ids.slice(i * 150, i * 150 + 150))
  const profiles = (
    await Promise.all(
      chunks.map(async (chunk) => {
        const { data, error } = await supabase.from("profiles").select("id, display_name, twitch_login, avatar_url, is_public").in("id", chunk)
        if (error) throw new Error(error.message)
        return data ?? []
      }),
    )
  ).flat()
  // Nur ausdrücklich öffentliche Profile tauchen in Tabellen auf (fehlt ein Profil, bleibt es ausgeblendet)
  const shown = new Set([...profiles.filter((p) => p.is_public).map((p) => p.id), ALVI_FALLBACK, ...(keepUser ? [keepUser] : [])])
  const names = new Map(
    profiles.map((p) => [p.id, { name: p.display_name ?? p.twitch_login ?? "Unbekannt", avatar: p.avatar_url, login: p.twitch_login }]),
  )
  if (!names.has(alviId)) names.set(alviId, { name: "Alvi", avatar: null, login: null })
  const visible = (p: Participation) => shown.has(p.userId)
  return { parts: parts.filter(visible), viewerParts: viewerParts.filter(visible), names, alviId }
}
