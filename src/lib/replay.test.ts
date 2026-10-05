import { describe, expect, it } from "vitest"
import { dropCircles, radRules, replayHref } from "./replay"

describe("Nachspielen-Links", () => {
  const done = { status: "geschafft" }
  it("je nach Challenge-Art", () => {
    expect(replayHref({ ...done, id: 1, source: "rad", config: { rules: ["Kein Bauen"] } })).toBe("/rad?nachspielen=1")
    expect(replayHref({ ...done, id: 2, source: "drop", config: { circles: [{ cx: 1, cy: 2, r: 3 }] } })).toBe("/drop?nachspielen=2")
    expect(replayHref({ ...done, id: 3, source: "eskalation", config: { session_id: 7 } })).toBe("/eskalation/7")
    expect(replayHref({ ...done, id: 4, source: "winchallenge", config: { win_challenge_id: 9 } })).toBe("/winchallenge/9")
  })
  it("keine Option für Auktion, Loadout, alte Bingo-/Drop-Einträge und offene Challenges", () => {
    expect(replayHref({ ...done, id: 5, source: "auktion", config: {} })).toBeNull()
    expect(replayHref({ ...done, id: 6, source: "loadout", config: { items: [] } })).toBeNull()
    expect(replayHref({ ...done, id: 7, source: "bingo", config: {} })).toBeNull() // alte Bingo-Runden
    expect(replayHref({ ...done, id: 10, source: "bingo", config: { round_id: 4 } })).toBe("/bingo/4")
    expect(replayHref({ ...done, id: 8, source: "drop", config: { spot: "Burg" } })).toBeNull()
    expect(replayHref({ status: "aktiv", id: 9, source: "rad", config: { rules: ["x"] } })).toBeNull()
  })
  it("liest Kreise und Regeln robust", () => {
    expect(dropCircles({ circles: [{ player: "Alvi", spot: "Burg", cx: 10, cy: 20, r: 5 }, { cx: "x" }], rule: "Kein Bauen" })).toEqual({
      circles: [{ player: "Alvi", spot: "Burg", cx: 10, cy: 20, r: 5 }],
      rule: "Kein Bauen",
    })
    expect(radRules({ rules: ["A", "B"] })).toEqual(["A", "B"])
    expect(radRules(null)).toEqual([])
  })
})
