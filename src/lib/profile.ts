/** Zuschauerprofil: Kennzahlen je Spiel und Abzeichen (rein, ohne Datenbank) */
import { PLAYER_GAMES, type Participation, type PlayerGame } from "./player-stats"

export type GameLine = { game: PlayerGame; rounds: number; wins: number; viewerRounds: number; viewerWins: number }
export type Totals = { rounds: number; wins: number; points: number }

/** Offizielle und Zuschauer-Runden einer Person, je Spiel */
export function gameLines(official: readonly Participation[], viewer: readonly Participation[]): GameLine[] {
  return PLAYER_GAMES.map((game) => {
    const o = official.filter((p) => p.game === game)
    const v = viewer.filter((p) => p.game === game)
    return { game, rounds: o.length, wins: o.filter((p) => p.won).length, viewerRounds: v.length, viewerWins: v.filter((p) => p.won).length }
  }).filter((l) => l.rounds || l.viewerRounds)
}

export function totals(parts: readonly Participation[]): Totals {
  return {
    rounds: parts.length,
    wins: parts.filter((p) => p.won).length,
    points: parts.reduce((s, p) => s + (p.points ?? 0), 0),
  }
}

export type BadgeInput = {
  rounds: number
  wins: number
  games: number
  bingoWins: number
  olympiadeWins: number
  suggestions: number
  bestSuggestionLikes: number
  cards: number
  watchMinutes: number | null
}
export type Badge = { key: string; emoji: string; title: string; text: string; earned: boolean }

/** Alle Abzeichen, freigeschaltete zuerst */
export function badges(i: BadgeInput): Badge[] {
  const list: Badge[] = [
    { key: "erste-runde", emoji: "🎮", title: "Mitspieler", text: "Erste Runde gespielt", earned: i.rounds >= 1 },
    { key: "stammspieler", emoji: "🔁", title: "Stammspieler", text: "25 Runden gespielt", earned: i.rounds >= 25 },
    { key: "erster-sieg", emoji: "🏆", title: "Erster Sieg", text: "Eine Runde gewonnen", earned: i.wins >= 1 },
    { key: "seriensieger", emoji: "👑", title: "Seriensieger", text: "10 Runden gewonnen", earned: i.wins >= 10 },
    { key: "allrounder", emoji: "🧭", title: "Allrounder", text: "4 verschiedene Spiele gespielt", earned: i.games >= 4 },
    { key: "bingo", emoji: "🔢", title: "Bingo-Profi", text: "Eine Bingo-Runde gewonnen", earned: i.bingoWins >= 1 },
    { key: "olympia", emoji: "🥇", title: "Olympionike", text: "Eine Olympiade gewonnen", earned: i.olympiadeWins >= 1 },
    { key: "ideengeber", emoji: "💡", title: "Ideengeber", text: "Einen Vorschlag eingereicht", earned: i.suggestions >= 1 },
    { key: "volltreffer", emoji: "🔥", title: "Volltreffer", text: "Ein Vorschlag mit 10 Likes", earned: i.bestSuggestionLikes >= 10 },
    { key: "kartenbauer", emoji: "🃏", title: "Kartenbauer", text: "Eine Bingo-Karte erstellt", earned: i.cards >= 1 },
    { key: "treue-seele", emoji: "⏱️", title: "Treue Seele", text: "100 Stunden Watchtime", earned: (i.watchMinutes ?? 0) >= 6000 },
    { key: "urgestein", emoji: "🗿", title: "Urgestein", text: "1.000 Stunden Watchtime", earned: (i.watchMinutes ?? 0) >= 60000 },
  ]
  return [...list.filter((b) => b.earned), ...list.filter((b) => !b.earned)]
}
