import { randomFloat, sample } from "./random"

export type DropSpot = { id: number; name: string; x: number | string; y: number | string }

/** Kreis in Prozent der (quadratischen) Karte: Mittelpunkt cx/cy, Radius r */
export type DropCircle = { spotId: number; spotName: string; cx: number; cy: number; r: number }

/** Wie weit der Kreismittelpunkt höchstens vom Spot abweicht (Anteil des Radius) */
export const MAX_OFFSET = 0.6
export const MIN_DIAMETER = 6
export const MAX_DIAMETER = 30
export const MAX_PLAYERS = 8

export const PLAYER_COLORS = ["#facc15", "#22d3ee", "#f472b6", "#4ade80", "#fb923c", "#a78bfa", "#f87171", "#e5e7eb"]

/**
 * Würfelt für `count` Spieler je einen Kreis (Durchmesser in % der Kartenbreite) um verschiedene Spots.
 * Der Spot liegt immer im Kreis, aber nicht unbedingt in der Mitte; Kreise bleiben auf der Karte
 * und überschneiden sich nicht. Gibt null zurück, wenn das nicht möglich ist.
 */
export function rollCircles(spots: readonly DropSpot[], count: number, diameter: number, attempts = 400): DropCircle[] | null {
  const r = diameter / 2
  if (count < 1 || spots.length < count) return null
  for (let a = 0; a < attempts; a++) {
    const circles: DropCircle[] = []
    for (const spot of sample(spots, count)) {
      const sx = Number(spot.x)
      const sy = Number(spot.y)
      // Zufälliger Versatz, gleichverteilt in einer Kreisscheibe
      const angle = randomFloat() * 2 * Math.PI
      const dist = Math.sqrt(randomFloat()) * MAX_OFFSET * r
      const cx = clamp(sx + Math.cos(angle) * dist, r, 100 - r)
      const cy = clamp(sy + Math.sin(angle) * dist, r, 100 - r)
      if (Math.hypot(cx - sx, cy - sy) > r) break // Spot läge nach dem Verschieben außerhalb
      if (circles.some((c) => Math.hypot(c.cx - cx, c.cy - cy) < c.r + r)) break
      circles.push({ spotId: spot.id, spotName: spot.name, cx, cy, r })
    }
    if (circles.length === count) return circles
  }
  return null
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
