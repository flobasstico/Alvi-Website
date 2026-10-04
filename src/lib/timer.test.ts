import { describe, expect, it } from "vitest"
import { formatClock, remainingSeconds, resumeStartedAt } from "./timer"

const base = { duration_s: 600, started_at: null, paused_remaining_s: null }

describe("timer", () => {
  it("bereit zeigt volle Dauer", () => {
    expect(remainingSeconds({ ...base, status: "bereit" })).toBe(600)
  })

  it("läuft zählt ab started_at", () => {
    const now = Date.parse("2026-01-01T00:05:00Z")
    expect(remainingSeconds({ ...base, status: "laeuft", started_at: "2026-01-01T00:00:00Z" }, now)).toBe(300)
    expect(remainingSeconds({ ...base, status: "laeuft", started_at: "2025-12-31T00:00:00Z" }, now)).toBe(0)
  })

  it("Pause und Fortsetzen erhalten die Restzeit", () => {
    const now = Date.parse("2026-01-01T01:00:00Z")
    const startedAt = resumeStartedAt({ ...base, status: "pausiert" }, 123, now)
    expect(remainingSeconds({ ...base, status: "laeuft", started_at: startedAt }, now)).toBe(123)
    expect(remainingSeconds({ ...base, status: "pausiert", paused_remaining_s: 77 })).toBe(77)
  })

  it("formatClock", () => {
    expect(formatClock(0)).toBe("00:00")
    expect(formatClock(1805)).toBe("30:05")
  })
})
