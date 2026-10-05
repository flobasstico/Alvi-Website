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

/**
 * Würfelt alle nicht gesperrten Slots neu. Keine doppelten Items,
 * optional mindestens eine Heilung. Gibt null zurück, wenn der Pool nicht reicht.
 */
export function rollLoadout(
  pool: readonly LootItem[],
  current: readonly (LootItem | null)[],
  locked: readonly boolean[],
  opts: LoadoutOptions,
): (LootItem | null)[] {
  const filtered = filterPool(pool, opts)
  const keep = current.map((item, i) => (locked[i] ? item : null))
  const usedIds = new Set(keep.filter(Boolean).map((i) => i!.id))
  const free = filtered.filter((i) => !usedIds.has(i.id))
  const openSlots = keep.flatMap((item, i) => (item ? [] : [i]))

  const drawn = shuffle(free).slice(0, openSlots.length)
  const result = [...keep]
  openSlots.forEach((slot, n) => (result[slot] = drawn[n] ?? null))

  if (opts.mustHeal && !result.some((i) => i?.type === "heilung") && openSlots.length > 0) {
    const heals = free.filter((i) => i.type === "heilung" && !result.some((r) => r?.id === i.id))
    if (heals.length > 0) result[pick(openSlots)] = pick(heals)
  }
  return result
}
