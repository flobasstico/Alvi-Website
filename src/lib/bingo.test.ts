import { describe, expect, it } from "vitest"
import { BINGO_CELLS, BINGO_LINES, bingoScore, completedLines, hasBingo, MAX_POINTS, markedCells, rankEntries, type RankEntry } from "./bingo"

const card = Array.from({ length: BINGO_CELLS }, (_, i) => i + 100)

describe("bingo 3×3", () => {
  it("hat 9 Felder und 8 Gewinnlinien", () => {
    expect(BINGO_CELLS).toBe(9)
    expect(BINGO_LINES).toEqual([
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ])
  })

  it("kein Freifeld: leere Karte hat nichts markiert", () => {
    expect(markedCells(card, new Set()).some(Boolean)).toBe(false)
  })

  it.each(BINGO_LINES.map((l, i) => [i, l] as const))("Linie %i ergibt Bingo", (i, line) => {
    const cells = markedCells(card, new Set(line.map((c) => card[c])))
    expect(hasBingo(cells)).toBe(true)
    expect(completedLines(cells)).toContain(i)
  })

  it("4 Felder ohne volle Linie reichen nicht", () => {
    expect(hasBingo(markedCells(card, new Set([card[0], card[1], card[5], card[6]])))).toBe(false)
  })
})

describe("Punkte", () => {
  const score = (idx: number[]) => bingoScore(markedCells(card, new Set(idx.map((i) => card[i]))))

  it("1 Punkt pro Feld, kein Bingo", () => {
    expect(score([0, 1])).toEqual({ fields: 2, bingos: 0, points: 2, full: false })
  })

  it("eine Reihe: 3 Felder + 3 Bonus", () => {
    expect(score([0, 1, 2])).toEqual({ fields: 3, bingos: 1, points: 6, full: false })
  })

  it("Kreuz aus Reihe und Spalte: 5 Felder + 2 Bingos", () => {
    expect(score([3, 4, 5, 1, 7]).points).toBe(5 + 2 * 3)
  })

  it("volle Karte: 9 Felder + 8 Bingos = 33", () => {
    expect(score([0, 1, 2, 3, 4, 5, 6, 7, 8])).toEqual({ fields: 9, bingos: 8, points: 33, full: true })
    expect(MAX_POINTS).toBe(33)
  })

  it("Rangliste: Punkte absteigend, bei Gleichstand früher dabei zuerst", () => {
    const e = (key: string, points: number, joinedAt: string): RankEntry => ({
      key, name: key, avatar: null, streamer: false, joinedAt, score: { fields: 0, bingos: 0, points, full: false },
    })
    const ranked = rankEntries([e("a", 3, "2026-01-01T10:00"), e("b", 9, "2026-01-01T10:05"), e("c", 3, "2026-01-01T09:00")])
    expect(ranked.map((r) => r.key)).toEqual(["b", "c", "a"])
  })
})
