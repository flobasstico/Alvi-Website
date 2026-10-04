"use client"

import clsx from "clsx"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { SaveChallenge } from "@/components/save-challenge"
import { celebrate } from "@/lib/confetti"
import { ITEM_TYPE_LABEL, RARITIES, RARITY_CLASS, RARITY_LABEL, type Rarity } from "@/lib/constants"
import { filterPool, LOADOUT_SLOTS, rollLoadout, type LootItem } from "@/lib/loadout"
import { pick } from "@/lib/random"

const empty = () => Array<LootItem | null>(LOADOUT_SLOTS).fill(null)

export function LoadoutDice({ items, isAdmin }: { items: LootItem[]; isAdmin: boolean }) {
  const [slots, setSlots] = useState<(LootItem | null)[]>(empty)
  const [locked, setLocked] = useState<boolean[]>(Array(LOADOUT_SLOTS).fill(false))
  const [rarities, setRarities] = useState<string[]>([...RARITIES])
  const [mustHeal, setMustHeal] = useState(true)
  const [rolling, setRolling] = useState(false)
  const [rollKey, setRollKey] = useState(0)

  const opts = { rarities, mustHeal }
  const pool = filterPool(items, opts)

  async function roll(onlySlot?: number) {
    if (rolling) return
    setRolling(true)
    const lockMask = onlySlot === undefined ? locked : locked.map((_, i) => i !== onlySlot)
    // Kurzes "Durchrattern" für die Spannung
    for (let t = 0; t < 12; t++) {
      setSlots((s) => s.map((item, i) => (lockMask[i] ? item : pool.length ? pick(pool) : null)))
      await new Promise((r) => setTimeout(r, 60 + t * 12))
    }
    setSlots((s) => rollLoadout(items, s, lockMask, opts))
    setRollKey((k) => k + 1)
    setRolling(false)
    if (onlySlot === undefined) celebrate()
  }

  const filled = slots.filter(Boolean) as LootItem[]
  const title = `Loadout: ${filled.map((i) => `${i.name} (${RARITY_LABEL[i.rarity as Rarity] ?? i.rarity})`).join(", ")}`

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {slots.map((item, i) => (
          <div key={i} className="flex flex-col gap-2">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={`${rollKey}-${i}-${item?.id ?? "leer"}`}
                initial={{ rotateY: 90, opacity: 0.4 }}
                animate={{ rotateY: 0, opacity: 1 }}
                transition={{ duration: 0.15 }}
                className={clsx(
                  "flex aspect-[3/4] flex-col justify-between rounded-2xl border-2 bg-gradient-to-b p-3 shadow-lg",
                  item ? RARITY_CLASS[item.rarity as Rarity] : "border-dashed border-line from-panel to-panel",
                  locked[i] && "ring-4 ring-accent",
                )}
              >
                <span className="text-xs font-bold uppercase opacity-80">Slot {i + 1}</span>
                {item ? (
                  <div>
                    <div className="text-lg font-black leading-tight drop-shadow">{item.name}</div>
                    <div className="text-xs font-semibold opacity-90">
                      {RARITY_LABEL[item.rarity as Rarity]} · {ITEM_TYPE_LABEL[item.type as keyof typeof ITEM_TYPE_LABEL]}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-4xl opacity-40">?</div>
                )}
              </motion.div>
            </AnimatePresence>
            <div className="flex gap-1">
              <button
                className={clsx("btn flex-1 px-2 py-1 text-xs", locked[i] ? "bg-accent text-black" : "btn-secondary")}
                onClick={() => setLocked((l) => l.map((v, j) => (j === i ? !v : v)))}
                disabled={!item}
              >
                {locked[i] ? "Gesperrt" : "Sperren"}
              </button>
              <button className="btn-secondary px-2 py-1 text-xs" onClick={() => roll(i)} disabled={rolling || locked[i]} title="Nur diesen Slot würfeln">
                🎲
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary px-8 py-3 font-display text-2xl" onClick={() => roll()} disabled={rolling || pool.length === 0}>
          {rolling ? "Würfelt…" : "WÜRFELN!"}
        </button>
        {isAdmin && filled.length > 0 && !rolling && (
          <SaveChallenge source="loadout" title={title} config={{ items: filled.map(({ name, rarity, type }) => ({ name, rarity, type })) }} />
        )}
      </div>

      <div className="panel flex flex-col gap-4">
        <h2 className="font-display text-xl">Optionen</h2>
        <div className="flex flex-wrap gap-2">
          {RARITIES.map((r) => (
            <button
              key={r}
              onClick={() => setRarities((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]))}
              className={clsx(
                "rounded-lg border-2 bg-gradient-to-b px-3 py-1 text-sm font-bold transition",
                RARITY_CLASS[r],
                !rarities.includes(r) && "opacity-30 grayscale",
              )}
            >
              {RARITY_LABEL[r]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={mustHeal} onChange={(e) => setMustHeal(e.target.checked)} />
          Mindestens eine Heilung garantieren
        </label>
        <p className="text-sm text-muted">
          {pool.length} Items im Pool{pool.length < LOADOUT_SLOTS && " – zu wenige für 5 Slots, Filter lockern oder Loot-Pool im Admin erweitern."}
        </p>
      </div>
    </div>
  )
}
