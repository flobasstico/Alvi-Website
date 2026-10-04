import { describe, expect, it } from "vitest"
import { isoWeek, previousWeek } from "./week"

describe("week", () => {
  it("berechnet ISO-Wochen", () => {
    expect(isoWeek(new Date("2026-10-04T12:00:00Z"))).toBe("2026-W40")
    expect(isoWeek(new Date("2027-01-01T12:00:00Z"))).toBe("2026-W53")
    expect(isoWeek(new Date("2024-12-30T12:00:00Z"))).toBe("2025-W01")
  })

  it("nutzt Europe/Berlin (Sonntag 23:30 UTC = Montag in Berlin)", () => {
    expect(isoWeek(new Date("2026-10-04T23:30:00Z"))).toBe("2026-W41")
  })

  it("previousWeek über Jahreswechsel", () => {
    expect(previousWeek("2026-W40")).toBe("2026-W39")
    expect(previousWeek("2025-W01")).toBe("2024-W52")
  })
})
