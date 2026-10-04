import { describe, expect, it } from "vitest"
import { parseLootList } from "./loot-import"

const sample = `Waffen
Assault Rifles
	•	Assault Rifle (Common)
	•	Heavy Assault Rifle (Legendary)
Pistols & Spezial
	•	Rebecca’s Guns (Epic)
	•	Kingdom Key (Epic)

Healing & Consumables
	•	Chug Jug (Legendary)
	•	Candy Corn

Mobility & Utility
	•	Witch Broom (Epic)
	•	Snack-O’-Lantern Gizmo
	•	Bush (Legendary)`

describe("parseLootList", () => {
  const items = parseLootList(sample)

  it("liest Items mit Seltenheit und überspringt Überschriften", () => {
    expect(items).toHaveLength(9)
    expect(items[0]).toEqual({ name: "Assault Rifle", rarity: "grau", type: "waffe" })
    expect(items[1]).toEqual({ name: "Heavy Assault Rifle", rarity: "gold", type: "waffe" })
  })

  it("setzt den Typ anhand der Überschriften", () => {
    expect(items.find((i) => i.name === "Chug Jug")?.type).toBe("heilung")
    expect(items.find((i) => i.name === "Witch Broom")?.type).toBe("utility")
    expect(items.find((i) => i.name === "Kingdom Key")?.type).toBe("waffe")
  })

  it("Items ohne Seltenheit bekommen null, Apostrophe werden vereinheitlicht", () => {
    expect(items.find((i) => i.name === "Candy Corn")?.rarity).toBeNull()
    expect(items.map((i) => i.name)).toContain("Rebecca's Guns")
    expect(items.map((i) => i.name)).toContain("Snack-O'-Lantern Gizmo")
  })

  it("ohne Aufzählungszeichen ist jede Zeile ein Item, deutsche Seltenheiten gehen auch", () => {
    expect(parseLootList("Pump-Shotgun (Legendär)\nVerband (Gewöhnlich)\nMedikit", "heilung")).toEqual([
      { name: "Pump-Shotgun", rarity: "gold", type: "heilung" },
      { name: "Verband", rarity: "grau", type: "heilung" },
      { name: "Medikit", rarity: null, type: "heilung" },
    ])
  })

  it("unbekannte Klammern bleiben Teil des Namens", () => {
    expect(parseLootList("- Bow (Flame)")[0]).toEqual({ name: "Bow (Flame)", rarity: null, type: "waffe" })
  })
})
