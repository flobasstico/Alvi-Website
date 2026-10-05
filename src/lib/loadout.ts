import { pick, shuffle } from "./random"

export const LOADOUT_SLOTS = 5

export type LootItem = { id: number; name: string; rarity: string; type: string; icon_url?: string | null }

export type LoadoutOptions = {
  rarities: readonly string[]
  mustHeal: boolean
  maxWeapons?: number
}

export function filterPool(items: readonly LootItem[], opts: LoadoutOptions): LootItem[] {
  return items.filter((i) => opts.rarities.includes(i.rarity))
}

const nameKey = (i: LootItem) => i.name.trim().toLowerCase()

/**
 * Würfelt alle nicht gesperrten Slots neu. Jedes Item (Name) höchstens einmal, auch nicht in einer
 * anderen Seltenheit; optional mindestens eine Heilung. Reicht der Pool nicht, bleiben Slots leer (null).
 */
export function rollLoadout(
  pool: readonly LootItem[],
  current: readonly (LootItem | null)[],
  locked: readonly boolean[],
  opts: LoadoutOptions,
): (LootItem | null)[] {
  const result = current.map((item, i) => (locked[i] ? item : null))
  const usedNames = new Set(result.filter(Boolean).map((i) => nameKey(i!)))
  const free = shuffle(filterPool(pool, opts).filter((i) => !usedNames.has(nameKey(i))))
  const openSlots = result.flatMap((item, i) => (item ? [] : [i]))

  for (const slot of openSlots) {
    const next = free.find((i) => !usedNames.has(nameKey(i)))
    if (!next) break
    result[slot] = next
    usedNames.add(nameKey(next))
  }

  if (opts.mustHeal && !result.some((i) => i?.type === "heilung") && openSlots.length > 0) {
    const slot = pick(openSlots)
    const others = new Set(result.filter((i, n) => i && n !== slot).map((i) => nameKey(i!)))
    const heals = free.filter((i) => i.type === "heilung" && !others.has(nameKey(i)))
    if (heals.length > 0) result[slot] = pick(heals)
  }
  return result
}

/** Prüft ein Loadout auf doppelte Items (gleicher Name). */
export function hasDuplicateNames(items: readonly (LootItem | null)[]): boolean {
  const names = items.filter(Boolean).map((i) => nameKey(i!))
  return new Set(names).size !== names.length
}
