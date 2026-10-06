import { describe, expect, it } from "vitest"
import { DROP_JUMPS, landingPoints, rollRarity, runScore, runSpeed } from "./minigames"

describe("Minispiele", () => {
  it("Drop-Zone: Punkte nach Abstand, perfekt +50, nie mehr als die Datenbank erlaubt", () => {
    expect(landingPoints(0)).toBe(150)
    expect(landingPoints(6)).toBe(145)
    expect(landingPoints(7)).toBe(94)
    expect(landingPoints(60)).toBe(50)
    expect(landingPoints(-60)).toBe(50)
    expect(landingPoints(120)).toBe(0)
    expect(landingPoints(500)).toBe(0)
    expect(landingPoints(0) * DROP_JUMPS).toBeLessThanOrEqual(450)
  })

  it("Sturm-Lauf: Seltenheiten, Tempo und Punkte", () => {
    expect(rollRarity(0).key).toBe("grau")
    expect(rollRarity(0.5).key).toBe("gruen")
    expect(rollRarity(0.999).key).toBe("gold")
    expect(runSpeed(0)).toBe(260)
    expect(runSpeed(1000)).toBe(700)
    expect(runScore(400, 7)).toBe(17)
    // Höchsttempo + sehr viel Loot bleibt unter der Grenze der Datenbank (100 Punkte/s)
    expect(runSpeed(1000) / 40 + 5 * 6).toBeLessThan(100)
  })
})
