import { describe, expect, it } from "vitest"
import { pick, randomInt, sample, shuffle, weightedIndex } from "./random"

describe("random", () => {
  it("randomInt bleibt im Bereich", () => {
    for (let i = 0; i < 1000; i++) {
      const n = randomInt(7)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(7)
    }
  })

  it("weightedIndex respektiert Gewichte", () => {
    const counts = [0, 0]
    for (let i = 0; i < 20000; i++) counts[weightedIndex([1, 3])]++
    const ratio = counts[1] / counts[0]
    expect(ratio).toBeGreaterThan(2.6)
    expect(ratio).toBeLessThan(3.4)
  })

  it("weightedIndex ignoriert Gewicht 0", () => {
    for (let i = 0; i < 200; i++) expect(weightedIndex([0, 5, 0])).toBe(1)
  })

  it("shuffle ist eine Permutation", () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8]
    expect(shuffle(a).sort()).toEqual(a)
  })

  it("sample liefert n verschiedene Elemente", () => {
    const s = sample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5)
    expect(new Set(s).size).toBe(5)
  })

  it("pick wirft bei leerer Liste", () => {
    expect(() => pick([])).toThrow()
  })
})
