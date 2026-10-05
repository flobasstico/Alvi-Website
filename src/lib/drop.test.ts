import { describe, expect, it } from "vitest"
import { rollCircles, type DropSpot } from "./drop"

const spots: DropSpot[] = [
  { id: 1, name: "Nordwest", x: 30, y: 30 },
  { id: 2, name: "Nordost", x: "70.00", y: "35.00" },
  { id: 3, name: "Süd", x: 45, y: 72 },
  { id: 4, name: "Rand", x: 2, y: 98 },
]

describe("rollCircles", () => {
  it("Spot liegt im Kreis, Kreis bleibt auf der Karte", () => {
    for (let n = 0; n < 300; n++) {
      const [c] = rollCircles(spots, 1, 20)!
      const s = spots.find((x) => x.id === c.spotId)!
      expect(Math.hypot(c.cx - Number(s.x), c.cy - Number(s.y))).toBeLessThanOrEqual(c.r + 1e-9)
      expect(c.cx - c.r).toBeGreaterThanOrEqual(-1e-9)
      expect(c.cy + c.r).toBeLessThanOrEqual(100 + 1e-9)
      expect(c.r).toBe(10)
    }
  })

  it("mehrere Spieler: verschiedene Spots, keine Überschneidung", () => {
    for (let n = 0; n < 200; n++) {
      const cs = rollCircles(spots, 3, 15)!
      expect(new Set(cs.map((c) => c.spotId)).size).toBe(3)
      for (let i = 0; i < cs.length; i++)
        for (let j = i + 1; j < cs.length; j++) expect(Math.hypot(cs[i].cx - cs[j].cx, cs[i].cy - cs[j].cy)).toBeGreaterThanOrEqual(cs[i].r + cs[j].r)
    }
  })

  it("nicht möglich → null", () => {
    expect(rollCircles(spots, 5, 10)).toBeNull() // mehr Spieler als Spots
    expect(rollCircles(spots.slice(0, 2), 2, 60)).toBeNull() // Kreise zu groß
    expect(rollCircles([], 1, 10)).toBeNull()
  })
})
