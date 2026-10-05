import { bingoScore, markedCells } from "./bingo"

/** Spiele mit Teilnehmern (Login), die in die Spieler-Statistik eingehen */
export const PLAYER_GAMES = ["eskalation", "loadout", "auktion", "bingo"] as const
export type PlayerGame = (typeof PLAYER_GAMES)[number]
export const PLAYER_GAME_LABEL: Record<PlayerGame, string> = {
  eskalation: "Regel-Eskalation",
  loadout: "Loadout-Würfel",
  auktion: "Loot-Auktion",
  bingo: "Bingo",
}
/** Spiele mit Punkten */
export const POINT_GAMES: readonly PlayerGame[] = ["bingo"]

/** Eine Teilnahme einer Person an einer abgeschlossenen Runde */
export type Participation = { userId: string; game: PlayerGame; round: string; won: boolean; points: number | null }

export type PlayerRow = {
  userId: string
  name: string
  avatar: string | null
  rounds: number
  wins: number
  winRate: number
  pointRounds: number
  points: number
  avgPoints: number | null
}

export type SortKey = "siege" | "teilnahmen" | "quote" | "punkte" | "schnitt"

export function aggregatePlayers(
  parts: readonly Participation[],
  profiles: ReadonlyMap<string, { name: string; avatar: string | null }>,
  game?: PlayerGame,
): PlayerRow[] {
  const rows = new Map<string, PlayerRow>()
  for (const p of parts) {
    if (game && p.game !== game) continue
    const r =
      rows.get(p.userId) ??
      ({
        userId: p.userId,
        name: profiles.get(p.userId)?.name ?? "Unbekannt",
        avatar: profiles.get(p.userId)?.avatar ?? null,
        rounds: 0,
        wins: 0,
        winRate: 0,
        pointRounds: 0,
        points: 0,
        avgPoints: null,
      } satisfies PlayerRow)
    r.rounds++
    if (p.won) r.wins++
    if (p.points != null) {
      r.pointRounds++
      r.points += p.points
    }
    rows.set(p.userId, r)
  }
  for (const r of rows.values()) {
    r.winRate = Math.round((r.wins / r.rounds) * 100)
    r.avgPoints = r.pointRounds ? Math.round((r.points / r.pointRounds) * 10) / 10 : null
  }
  return [...rows.values()]
}

export function sortPlayers(rows: PlayerRow[], key: SortKey = "siege"): PlayerRow[] {
  const val: Record<SortKey, (r: PlayerRow) => number> = {
    siege: (r) => r.wins,
    teilnahmen: (r) => r.rounds,
    quote: (r) => r.winRate,
    punkte: (r) => r.points,
    schnitt: (r) => r.avgPoints ?? -1,
  }
  // Tiebreak: Siege, Quote, Punkte, Teilnahmen, Name
  return [...rows].sort(
    (a, b) =>
      val[key](b) - val[key](a) ||
      b.wins - a.wins ||
      b.winRate - a.winRate ||
      b.points - a.points ||
      b.rounds - a.rounds ||
      a.name.localeCompare(b.name, "de"),
  )
}

/**
 * Bingo-Teilnahmen einer beendeten Runde: Alvis Karte (erste 9 Aufgaben) und alle Zuschauer-Karten.
 * Sieg = höchste Punktzahl der Runde (bei Gleichstand alle Punktgleichen, mindestens 1 Punkt).
 */
export function bingoParticipations(
  game: { id: number; task_ids: number[] },
  cards: readonly { user_id: string; task_ids: number[] }[],
  marks: ReadonlySet<number>,
  streamerId: string | null,
): Participation[] {
  const entries = [
    ...(streamerId ? [{ userId: streamerId, ids: game.task_ids.slice(0, 9) }] : []),
    ...cards.filter((c) => c.user_id !== streamerId).map((c) => ({ userId: c.user_id, ids: c.task_ids })),
  ].map((e) => ({ userId: e.userId, points: bingoScore(markedCells(e.ids, marks)).points }))
  const best = Math.max(0, ...entries.map((e) => e.points))
  return entries.map((e) => ({ userId: e.userId, game: "bingo", round: `bingo-${game.id}`, won: best > 0 && e.points === best, points: e.points }))
}
