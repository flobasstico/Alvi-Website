import { describe, expect, it } from "vitest"
import { BINGO_CELLS, BINGO_LINES, completedLines, hasBingo, markedCells } from "./bingo"

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
