import type { Tables } from "./database.types"

export type Olympic = Tables<"olympics">
export type OlympicGame = Tables<"olympic_games">
export type OlympicPlayer = Tables<"olympic_players">
export type OlympicState = { olympic: Olympic; games: OlympicGame[]; players: OlympicPlayer[]; streamerId: string | null }

export const OLYMPIC_STATUS: Record<string, string> = { lobby: "Lobby", laeuft: "Läuft", beendet: "Beendet" }

/** Gezogene Spiele in Ziehungsreihenfolge (Position = Punkte) */
export function drawnGames(games: readonly OlympicGame[]) {
  return games.filter((g) => g.position != null).sort((a, b) => a.position! - b.position!)
}

/** Spiele, die noch auf dem Rad sind */
export function wheelGames(games: readonly OlympicGame[]) {
  return games.filter((g) => g.position == null).sort((a, b) => a.id - b.id)
}

/** Das gerade gedrehte Spiel, solange es noch keinen Sieger hat */
export function openGame(state: Pick<OlympicState, "olympic" | "games">) {
  const g = state.games.find((x) => x.id === state.olympic.current_game_id)
  return g && !g.winner_id ? g : null
}

/** Punkte je Spieler aus den Siegen (Spiel n bringt n Punkte) */
export function pointsByPlayer(games: readonly OlympicGame[]) {
  const pts = new Map<string, number>()
  for (const g of games) if (g.winner_id && g.position != null) pts.set(g.winner_id, (pts.get(g.winner_id) ?? 0) + g.position)
  return pts
}

export type Standing = { userId: string; name: string; avatar: string | null; points: number; wins: number; rank: number; streamer: boolean }

/** Rangliste: Punkte, dann Anzahl Siege, dann Beitritt. Gleiche Punkte = gleicher Platz. */
export function standings(state: Pick<OlympicState, "games" | "players" | "streamerId">): Standing[] {
  const pts = pointsByPlayer(state.games)
  const wins = new Map<string, number>()
  for (const g of state.games) if (g.winner_id && g.position != null) wins.set(g.winner_id, (wins.get(g.winner_id) ?? 0) + 1)
  const rows = [...state.players]
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at))
    .map((p) => ({
      userId: p.user_id,
      name: p.display_name ?? "Spieler",
      avatar: p.avatar_url,
      points: pts.get(p.user_id) ?? 0,
      wins: wins.get(p.user_id) ?? 0,
      rank: 0,
      streamer: p.user_id === state.streamerId,
    }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
  rows.forEach((r, i) => (r.rank = i > 0 && rows[i - 1].points === r.points ? rows[i - 1].rank : i + 1))
  return rows
}

/** Punkte, die insgesamt noch zu holen sind (für „Wer kann noch gewinnen?“) */
export function pointsLeft(games: readonly OlympicGame[]) {
  const drawn = games.filter((g) => g.position != null).length
  const open = games.filter((g) => g.position != null && !g.winner_id).reduce((s, g) => s + g.position!, 0)
  let left = open
  for (let i = 1; i <= games.length - drawn; i++) left += drawn + i
  return left
}

/** Spiele-Liste aus dem Textfeld: eine Zeile oder Komma je Spiel, ohne Duplikate */
export function parseGames(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split(/[\n,;]/)) {
    const name = raw.trim().slice(0, 60)
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    out.push(name)
  }
  return out
}
