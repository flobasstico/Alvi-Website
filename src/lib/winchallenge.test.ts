import { describe, expect, it } from "vitest"
import { elapsedSeconds, formatClock, progress, remainingSeconds } from "./winchallenge"

const t0 = Date.parse("2026-10-05T12:00:00Z")
const base = { status: "laeuft", elapsed_s: 90, started_at: "2026-10-05T12:00:00Z", duration_s: 600 }

describe("Winchallenge-Timer", () => {
  it("läuft: Vorlauf + aktueller Abschnitt", () => {
    expect(elapsedSeconds(base, t0 + 30_000)).toBe(120)
    expect(remainingSeconds(base, t0 + 30_000)).toBe(480)
  })
  it("pausiert: Zeit steht", () => {
    const p = { ...base, status: "pausiert", started_at: null }
    expect(remainingSeconds(p, t0 + 999_000)).toBe(510)
  })
  it("nie unter 0, ohne Zeitlimit null", () => {
    expect(remainingSeconds(base, t0 + 10_000_000)).toBe(0)
    expect(remainingSeconds({ ...base, duration_s: 0 }, t0)).toBeNull()
  })
  it("Uhrzeit-Format", () => {
    expect(formatClock(75)).toBe("1:15")
    expect(formatClock(3725)).toBe("1:02:05")
    expect(formatClock(59.9)).toBe("0:59")
  })
})

describe("Fortschritt", () => {
  it("zählt Siege bis zum Ziel, Überschuss zählt nicht doppelt", () => {
    expect(progress([{ wins: 3, target: 2 }, { wins: 1, target: 3 }])).toEqual({ wins: 3, target: 5, done: 1, total: 2, complete: false })
    expect(progress([{ wins: 2, target: 2 }]).complete).toBe(true)
    expect(progress([]).complete).toBe(false)
  })
})
