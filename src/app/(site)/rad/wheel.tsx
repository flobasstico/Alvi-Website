"use client"

import { useMotionValue } from "framer-motion"
import { useMemo, useState } from "react"
import { SaveChallenge } from "@/components/save-challenge"
import { buildSlices, spinTo, WheelSvg } from "@/components/wheel-svg"
import { celebrate } from "@/lib/confetti"
import { weightedIndex } from "@/lib/random"

type Rule = { id: number; text: string; weight: number }

export function Wheel({ rules, isAdmin }: { rules: Rule[]; isAdmin: boolean }) {
  const [excluded, setExcluded] = useState<Set<number>>(new Set())
  const [results, setResults] = useState<Rule[]>([])
  const [spinning, setSpinning] = useState(false)
  const [noRepeat, setNoRepeat] = useState(true)
  const rotation = useMotionValue(0)

  // Gezogene Regel bleibt sichtbar, bis das Rad erneut gedreht wird – sonst verrutschen die Segmente unter dem Zeiger
  const [pendingExclude, setPendingExclude] = useState<number | null>(null)
  const active = useMemo(() => rules.filter((r) => !excluded.has(r.id)), [rules, excluded])
  const slices = useMemo(() => buildSlices(active), [active])
  const remaining = active.filter((r) => r.id !== pendingExclude)

  async function spin() {
    if (spinning || remaining.length < 1) return
    setSpinning(true)
    let current = slices
    if (pendingExclude !== null) {
      current = buildSlices(remaining)
      setExcluded((e) => new Set(e).add(pendingExclude))
      setPendingExclude(null)
    }
    const idx = weightedIndex(current.map((s) => s.item.weight))
    const slice = current[idx]
    await spinTo(rotation, slice)
    setResults((r) => [...r, slice.item])
    if (noRepeat) setPendingExclude(slice.item.id)
    setSpinning(false)
    celebrate()
  }

  function reset() {
    setResults([])
    setExcluded(new Set())
    setPendingExclude(null)
  }

  const title = results.map((r) => r.text).join(" + ")

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="panel flex flex-col items-center gap-6">
        <WheelSvg slices={slices} rotation={rotation} />
        <button className="btn-primary px-10 py-4 font-display text-2xl" onClick={spin} disabled={spinning || remaining.length === 0}>
          {spinning ? "Dreht…" : "DREHEN!"}
        </button>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={noRepeat} onChange={(e) => setNoRepeat(e.target.checked)} />
          Gezogene Regeln aus dem Rad entfernen
        </label>
      </div>

      <aside className="panel flex flex-col gap-4">
        <h2 className="font-display text-2xl">Aktive Regeln</h2>
        {results.length === 0 ? (
          <p className="text-muted">Noch nichts gedreht.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {results.map((r, i) => (
              <li key={`${r.id}-${i}`} className="rounded-xl border border-accent/50 bg-accent/10 px-3 py-2 text-lg font-bold">
                {i + 1}. {r.text}
              </li>
            ))}
          </ol>
        )}
        <div className="mt-auto flex flex-col gap-3">
          {results.length > 0 && (
            <button className="btn-secondary" onClick={reset} disabled={spinning}>
              Zurücksetzen
            </button>
          )}
          {isAdmin && results.length > 0 && (
            <SaveChallenge source="rad" title={title} config={{ rules: results.map((r) => r.text) }} disabled={spinning} />
          )}
        </div>
      </aside>
    </div>
  )
}
