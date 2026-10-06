import { describe, expect, it } from "vitest"
import type { Participation } from "./player-stats"
import { badges, gameLines, totals } from "./profile"

const part = (game: Participation["game"], won: boolean, points: number | null = null): Participation => ({ userId: "u", game, round: Math.random().toString(), won, points })

describe("Zuschauerprofil", () => {
  it("trennt offizielle und Zuschauer-Runden je Spiel", () => {
    const lines = gameLines([part("bingo", true, 6), part("loadout", false)], [part("bingo", false, 2), part("bingo", true, 5)])
    expect(lines).toEqual([
      { game: "loadout", rounds: 1, wins: 0, viewerRounds: 0, viewerWins: 0 },
      { game: "bingo", rounds: 1, wins: 1, viewerRounds: 2, viewerWins: 1 },
    ])
    expect(totals([part("bingo", true, 6), part("bingo", false, 2), part("rad", false)])).toEqual({ rounds: 3, wins: 1, points: 8 })
  })

  it("vergibt Abzeichen und sortiert freigeschaltete nach vorne", () => {
    const none = { rounds: 0, wins: 0, games: 0, bingoWins: 0, olympiadeWins: 0, suggestions: 0, bestSuggestionLikes: 0, cards: 0, watchMinutes: null }
    expect(badges(none).every((b) => !b.earned)).toBe(true)
    const b = badges({ ...none, rounds: 3, wins: 1, suggestions: 1, watchMinutes: 6000 })
    expect(b.filter((x) => x.earned).map((x) => x.key)).toEqual(["erste-runde", "erster-sieg", "ideengeber", "treue-seele"])
    expect(b[0].earned && !b[b.length - 1].earned).toBe(true)
  })
})
