import { describe, expect, it } from "vitest"
import { BINGO_LINES, completedLines, FREE_INDEX, hasBingo, markedCells } from "./bingo"

const card = Array.from({ length: 25 }, (_, i) => i + 100)

describe("bingo", () => {
  it("hat 12 Gewinnlinien", () => {
    expect(BINGO_LINES).toHaveLength(12)
  })

  it("Mitte ist immer frei", () => {
    expect(markedCells(card, new Set())[FREE_INDEX]).toBe(true)
    expect(hasBingo(markedCells(card, new Set()))).toBe(false)
  })

  it.each(BINGO_LINES.map((l, i) => [i, l] as const))("Linie %i ergibt Bingo", (i, line) => {
    const marked = new Set(line.filter((c) => c !== FREE_INDEX).map((c) => card[c]))
    const cells = markedCells(card, marked)
    expect(hasBingo(cells)).toBe(true)
    expect(completedLines(cells)).toContain(i)
  })

  it("4 von 5 ohne Mitte reicht nicht", () => {
    const marked = new Set([card[0], card[1], card[2], card[3]])
    expect(hasBingo(markedCells(card, marked))).toBe(false)
  })
})
