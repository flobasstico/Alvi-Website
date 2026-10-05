import { describe, expect, it } from "vitest"
import { hasDuplicateNames, rollLoadout, type LootItem } from "./loadout"

const pool: LootItem[] = [
  ...Array.from({ length: 10 }, (_, i) => ({ id: i, name: `Waffe ${i}`, rarity: i < 5 ? "grau" : "gold", type: "waffe" })),
  { id: 100, name: "Medikit", rarity: "gruen", type: "heilung" },
]
const all = { rarities: ["grau", "gruen", "gold"], mustHeal: false }
const empty = Array(5).fill(null)
const unlocked = Array(5).fill(false)

describe("rollLoadout", () => {
  it("füllt 5 Slots ohne Duplikate", () => {
    for (let n = 0; n < 50; n++) {
      const r = rollLoadout(pool, empty, unlocked, all)
      expect(r.every(Boolean)).toBe(true)
      expect(new Set(r.map((i) => i!.id)).size).toBe(5)
    }
  })

  it("respektiert den Raritäts-Filter", () => {
    const r = rollLoadout(pool, empty, unlocked, { rarities: ["grau"], mustHeal: false })
    expect(r.every((i) => i!.rarity === "grau")).toBe(true)
  })

  it("garantiert Heilung, wenn verlangt", () => {
    for (let n = 0; n < 50; n++) {
      const r = rollLoadout(pool, empty, unlocked, { ...all, mustHeal: true })
      expect(r.some((i) => i?.type === "heilung")).toBe(true)
    }
  })

  it("behält gesperrte Slots", () => {
    const first = rollLoadout(pool, empty, unlocked, all)
    const locked = [true, false, true, false, false]
    for (let n = 0; n < 20; n++) {
      const r = rollLoadout(pool, first, locked, all)
      expect(r[0]).toBe(first[0])
      expect(r[2]).toBe(first[2])
      expect(new Set(r.map((i) => i!.id)).size).toBe(5)
    }
  })

  it("lässt Slots leer, wenn der Pool zu klein ist", () => {
    const r = rollLoadout(pool, empty, unlocked, { rarities: ["gruen"], mustHeal: false })
    expect(r.filter(Boolean)).toHaveLength(1)
  })

  it("nimmt jedes Item nur einmal, auch in anderer Seltenheit", () => {
    const variants: LootItem[] = [
      ...["grau", "gruen", "blau", "lila", "gold"].map((rarity, i) => ({ id: 200 + i, name: "Assault Rifle", rarity, type: "waffe" })),
      ...["grau", "gold"].map((rarity, i) => ({ id: 300 + i, name: "Medikit", rarity, type: "heilung" })),
      { id: 400, name: "Pump", rarity: "gold", type: "waffe" },
    ]
    for (let n = 0; n < 100; n++) {
      const r = rollLoadout(variants, empty, unlocked, { rarities: ["grau", "gruen", "blau", "lila", "gold"], mustHeal: true })
      expect(hasDuplicateNames(r)).toBe(false)
      expect(r.filter(Boolean)).toHaveLength(3)
      expect(r.some((i) => i?.type === "heilung")).toBe(true)
    }
  })

  it("würfelt neben gesperrten Slots keine Variante desselben Items", () => {
    const variants: LootItem[] = [
      { id: 1, name: "Pump", rarity: "grau", type: "waffe" },
      { id: 2, name: "Pump", rarity: "gold", type: "waffe" },
      { id: 3, name: "Medikit", rarity: "grau", type: "heilung" },
    ]
    const r = rollLoadout(variants, [variants[0], null, null, null, null], [true, false, false, false, false], all)
    expect(r.filter(Boolean).map((i) => i!.id)).toEqual([1, 3])
  })
})
