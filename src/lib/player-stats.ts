/** Spiele, die in die Spieler-Statistik eingehen: Mehrspieler-Runden (Login) und Alvis Solo-Challenges */
export const PLAYER_GAMES = ["eskalation", "loadout", "auktion", "bingo", "olympiade", "rad", "drop", "winchallenge", "manuell"] as const
export type PlayerGame = (typeof PLAYER_GAMES)[number]
export const PLAYER_GAME_LABEL: Record<PlayerGame, string> = {
  eskalation: "Regel-Eskalation",
  loadout: "Loadout-Würfel",
  auktion: "Loot-Auktion",
  bingo: "Bingo",
  olympiade: "Olympiade",
  rad: "Glücksrad",
  drop: "Drop-Spot",
  winchallenge: "Winchallenge",
  manuell: "Manuell",
}
/** Spiele mit Punkten */
export const POINT_GAMES: readonly PlayerGame[] = ["bingo", "olympiade"]

/** Eine Teilnahme einer Person an einer abgeschlossenen Runde */
export type Participation = { userId: string; game: PlayerGame; round: string; won: boolean; points: number | null }

type ChallengeRow = { id: number; source: string; status: string }

/**
 * Alvis Solo-Challenges (Glücksrad, Drop-Spot, Winchallenge, Solo-Loadout …) als Teilnahmen von Alvi:
 * geschafft = Sieg. Einträge, die aus einer Mehrspieler-Runde stammen (linked), zählen dort schon.
 */
export function soloParticipations(challenges: readonly ChallengeRow[], linked: ReadonlySet<number>, alviId: string): Participation[] {
  return challenges
    .filter((c) => !linked.has(c.id) && (c.status === "geschafft" || c.status === "gescheitert"))
    .filter((c) => (PLAYER_GAMES as readonly string[]).includes(c.source))
    .map((c) => ({ userId: alviId, game: c.source as PlayerGame, round: `ch-${c.id}`, won: c.status === "geschafft", points: null }))
}

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
