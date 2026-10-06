/** Minispiele: Drop-Zone und Sturm-Lauf – Punkte-Regeln (rein, testbar). Die Datenbank prüft die Grenzen nochmal. */

export const MINIGAMES = [
  {
    key: "dropzone",
    emoji: "🪂",
    title: "Drop-Zone",
    text: "Spring aus dem Battle Bus und lande mit dem Gleiter so genau wie möglich auf dem Ziel. Wind und Sturmwolken machen es schwer – 3 Sprünge pro Runde.",
    controls: "Springen: Leertaste / Tippen · Lenken: ← → bzw. A D / linke oder rechte Bildschirmhälfte gedrückt halten",
  },
  {
    key: "sturmlauf",
    emoji: "🌀",
    title: "Sturm-Lauf",
    text: "Der Sturm ist dir auf den Fersen! Spring über Hindernisse, sammle Loot und Schilde – es wird immer schneller.",
    controls: "Springen: Leertaste / ↑ / Tippen",
  },
] as const
export type MinigameKey = (typeof MINIGAMES)[number]["key"]
export const isMinigame = (v: string | undefined): v is MinigameKey => MINIGAMES.some((g) => g.key === v)
export const minigame = (key: MinigameKey) => MINIGAMES.find((g) => g.key === key)!

export const PERIODS = [
  { key: "heute", label: "Heute" },
  { key: "woche", label: "Woche" },
  { key: "ewig", label: "Ewig" },
] as const
export type Period = (typeof PERIODS)[number]["key"]

// ---------- Drop-Zone ----------
export const DROP_JUMPS = 3
export const DROP_RADIUS = 120 // ab dieser Entfernung zum Ziel gibt es 0 Punkte
export const DROP_PERFECT = 6 // so nah = „Perfekt“ (+50)

/** Punkte für eine Landung mit Abstand d (Pixel) zur Zielmitte: 0–100, perfekt +50 → max. 150 */
export function landingPoints(d: number) {
  const base = Math.max(0, Math.round(100 * (1 - Math.abs(d) / DROP_RADIUS)))
  return base + (Math.abs(d) <= DROP_PERFECT ? 50 : 0)
}

// ---------- Sturm-Lauf ----------
export const RARITIES = [
  { key: "grau", color: "#9ca3af", points: 1, weight: 45 },
  { key: "gruen", color: "#22c55e", points: 2, weight: 25 },
  { key: "blau", color: "#3b82f6", points: 3, weight: 15 },
  { key: "lila", color: "#a855f7", points: 4, weight: 10 },
  { key: "gold", color: "#f59e0b", points: 5, weight: 5 },
] as const

/** Seltenheit für eine Zufallszahl r in [0, 1) */
export function rollRarity(r: number) {
  const total = RARITIES.reduce((s, x) => s + x.weight, 0)
  let acc = 0
  for (const x of RARITIES) {
    acc += x.weight / total
    if (r < acc) return x
  }
  return RARITIES[RARITIES.length - 1]
}

/** Laufgeschwindigkeit (Pixel/s) nach t Sekunden: wird schneller, gedeckelt */
export const runSpeed = (t: number) => Math.min(700, 260 + 12 * t)
/** Pixel Laufstrecke pro Punkt */
export const DISTANCE_PER_POINT = 40
export const runScore = (distance: number, loot: number) => Math.floor(distance / DISTANCE_PER_POINT) + loot
