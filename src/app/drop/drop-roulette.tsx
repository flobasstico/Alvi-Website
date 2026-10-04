"use client"

import clsx from "clsx"
import { motion } from "framer-motion"
import { useState } from "react"
import { IslandMap } from "@/components/island-map"
import { SaveChallenge } from "@/components/save-challenge"
import { celebrate } from "@/lib/confetti"
import { pick, randomInt, weightedIndex } from "@/lib/random"

type Spot = { id: number; name: string; x: number; y: number }
type Rule = { id: number; text: string; weight: number }

export function DropRoulette({
  spots,
  rules,
  mapUrl,
  isAdmin,
}: {
  spots: Spot[]
  rules: Rule[]
  mapUrl?: string | null
  isAdmin: boolean
}) {
  const [highlight, setHighlight] = useState<Spot | null>(null)
  const [result, setResult] = useState<{ spot: Spot; rule: Rule | null } | null>(null)
  const [withRule, setWithRule] = useState(true)
  const [rolling, setRolling] = useState(false)

  async function roll() {
    if (rolling || spots.length === 0) return
    setRolling(true)
    setResult(null)
    const steps = 18 + randomInt(6)
    for (let t = 0; t < steps; t++) {
      setHighlight(pick(spots))
      await new Promise((r) => setTimeout(r, 50 + t * t * 0.9))
    }
    const spot = pick(spots)
    setHighlight(spot)
    const rule = withRule && rules.length ? rules[weightedIndex(rules.map((r) => r.weight))] : null
    setResult({ spot, rule })
    setRolling(false)
    celebrate()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="panel p-2">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl">
          <IslandMap imageUrl={mapUrl} />
          {spots.map((s) => {
            const active = highlight?.id === s.id
            return (
              <div
                key={s.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
              >
                <motion.div
                  animate={{ scale: active ? 1.6 : 1 }}
                  className={clsx(
                    "h-4 w-4 rounded-full border-2 border-white shadow",
                    active ? "bg-accent" : "bg-fail/80",
                  )}
                />
                <div
                  className={clsx(
                    "absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap rounded px-1.5 text-xs font-bold",
                    active ? "bg-accent text-black" : "bg-black/60 text-white",
                  )}
                >
                  {s.name}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <aside className="panel flex flex-col gap-4">
        <button className="btn-primary py-4 font-display text-2xl" onClick={roll} disabled={rolling || spots.length === 0}>
          {rolling ? "Bus fliegt…" : "ABSPRINGEN!"}
        </button>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={withRule} onChange={(e) => setWithRule(e.target.checked)} />
          Mit Zusatzregel
        </label>
        {spots.length === 0 && <p className="text-muted">Noch keine Drop-Spots – im Admin-Bereich anlegen.</p>}
        {result && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col gap-3">
            <div>
              <div className="text-sm text-muted">Landeort</div>
              <div className="font-display text-4xl text-accent">{result.spot.name}</div>
            </div>
            {result.rule && (
              <div className="rounded-xl border border-accent-2/50 bg-accent-2/10 p-3">
                <div className="text-sm text-muted">Zusatzregel</div>
                <div className="text-lg font-bold">{result.rule.text}</div>
              </div>
            )}
            {isAdmin && (
              <SaveChallenge
                source="drop"
                title={`Drop: ${result.spot.name}${result.rule ? ` – ${result.rule.text}` : ""}`}
                config={{ spot: result.spot.name, rule: result.rule?.text ?? null }}
              />
            )}
          </motion.div>
        )}
      </aside>
    </div>
  )
}
