import { describe, expect, it } from "vitest"
import { aggregatePlayers, bingoParticipations, sortPlayers, type Participation } from "./player-stats"

const prof = new Map([
  ["alvi", { name: "Alvi", avatar: null }],
  ["kev", { name: "Kevin", avatar: null }],
  ["flo", { name: "Flo", avatar: null }],
])
const p = (userId: string, game: Participation["game"], won: boolean, points: number | null = null, round = Math.random().toString()): Participation => ({
  userId, game, round, won, points,
})

describe("Spieler-Statistik", () => {
  const parts = [
    p("alvi", "eskalation", true),
    p("kev", "eskalation", false),
    p("alvi", "eskalation", false),
    p("kev", "eskalation", true),
    p("kev", "loadout", true),
    p("alvi", "auktion", false),
    p("kev", "auktion", false),
    p("alvi", "bingo", true, 12),
    p("flo", "bingo", false, 4),
    p("alvi", "bingo", false, 3),
    p("flo", "bingo", true, 7),
  ]

  it("zählt Teilnahmen, Siege und Punkte über alle Spiele", () => {
    const rows = new Map(aggregatePlayers(parts, prof).map((r) => [r.userId, r]))
    expect(rows.get("alvi")).toMatchObject({ rounds: 5, wins: 2, points: 15, pointRounds: 2, avgPoints: 7.5 })
    expect(rows.get("kev")).toMatchObject({ rounds: 4, wins: 2, points: 0, avgPoints: null })
    // Auktion zählt nicht in die Siegquote: Kevin 2 Siege aus 3 gewerteten Runden
    expect(rows.get("kev")!.winRate).toBe(67)
    expect(rows.get("flo")).toMatchObject({ rounds: 2, wins: 1, winRate: 50, points: 11, avgPoints: 5.5 })
  })

  it("filtert nach Spiel", () => {
    const rows = aggregatePlayers(parts, prof, "bingo")
    expect(rows.map((r) => r.userId).sort()).toEqual(["alvi", "flo"])
    expect(aggregatePlayers(parts, prof, "loadout")).toEqual([expect.objectContaining({ userId: "kev", rounds: 1, wins: 1, winRate: 100 })])
  })

  it("sortiert nach Siegen, bei Gleichstand nach Quote", () => {
    expect(sortPlayers(aggregatePlayers(parts, prof)).map((r) => r.name)).toEqual(["Kevin", "Alvi", "Flo"])
    expect(sortPlayers(aggregatePlayers(parts, prof), "punkte").map((r) => r.name)).toEqual(["Alvi", "Flo", "Kevin"])
    expect(sortPlayers(aggregatePlayers(parts, prof), "schnitt")[0].name).toBe("Alvi")
  })

  it("Bingo: Sieger ist die höchste Punktzahl, Alvi spielt mit seiner Karte mit", () => {
    const game = { id: 1, task_ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }
    const cards = [
      { user_id: "kev", task_ids: [1, 2, 3, 10, 11, 12, 4, 5, 6] }, // obere Reihe 1,2,3 → 3 + 3 = 6
      { user_id: "flo", task_ids: [10, 11, 12, 4, 5, 6, 7, 8, 9] }, // nichts
    ]
    const res = bingoParticipations(game, cards, new Set([1, 2, 3]), "alvi")
    expect(res).toEqual([
      { userId: "alvi", game: "bingo", round: "bingo-1", won: true, points: 6 },
      { userId: "kev", game: "bingo", round: "bingo-1", won: true, points: 6 },
      { userId: "flo", game: "bingo", round: "bingo-1", won: false, points: 0 },
    ])
  })

  it("Bingo ohne erledigte Aufgaben: kein Sieger", () => {
    const res = bingoParticipations({ id: 2, task_ids: [1, 2, 3, 4, 5, 6, 7, 8, 9] }, [], new Set(), "alvi")
    expect(res).toEqual([{ userId: "alvi", game: "bingo", round: "bingo-2", won: false, points: 0 }])
  })
})
