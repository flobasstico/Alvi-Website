import { describe, expect, it } from "vitest"
import { rateQuip, streaks, successRate } from "./stats"

const c = (status: string, day: number) => ({ status, played_at: `2026-01-${String(day).padStart(2, "0")}T00:00:00Z`, created_at: "" })

describe("stats", () => {
  it("successRate rundet und fängt 0 ab", () => {
    expect(successRate(0, 0)).toBe(0)
    expect(successRate(3, 13)).toBe(23)
  })

  it("streaks zählt chronologisch und ignoriert offene", () => {
    const s = streaks([c("geschafft", 3), c("gescheitert", 1), c("gescheitert", 2), c("geplant", 4), c("geschafft", 5), c("geschafft", 6)])
    expect(s.bestFail).toBe(2)
    expect(s.bestWin).toBe(3)
    expect(s.current).toEqual({ status: "geschafft", count: 3 })
  })

  it("rateQuip hat für jede Quote einen Text", () => {
    for (const r of [0, 10, 23, 50, 70, 100]) expect(rateQuip(r, 5).length).toBeGreaterThan(0)
  })
})
