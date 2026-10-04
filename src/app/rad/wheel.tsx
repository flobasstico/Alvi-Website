"use client"

import { animate, motion, useMotionValue } from "framer-motion"
import { useMemo, useState } from "react"
import { SaveChallenge } from "@/components/save-challenge"
import { celebrate } from "@/lib/confetti"
import { randomInt, weightedIndex } from "@/lib/random"

type Rule = { id: number; text: string; weight: number }

const COLORS = ["#7c3aed", "#0ea5e9", "#f59e0b", "#ec4899", "#22c55e", "#ef4444", "#6366f1", "#14b8a6"]
const SIZE = 500
const R = SIZE / 2

function polar(angleDeg: number, radius: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return [R + radius * Math.cos(a), R + radius * Math.sin(a)]
}

function slicePath(start: number, end: number) {
  const [x1, y1] = polar(start, R - 4)
  const [x2, y2] = polar(end, R - 4)
  const large = end - start > 180 ? 1 : 0
  return `M ${R} ${R} L ${x1} ${y1} A ${R - 4} ${R - 4} 0 ${large} 1 ${x2} ${y2} Z`
}

function buildSlices(list: Rule[]) {
  const total = list.reduce((s, r) => s + r.weight, 0)
  let acc = 0
  return list.map((rule, i) => {
    const start = (acc / total) * 360
    acc += rule.weight
    const end = (acc / total) * 360
    return { rule, start, end, color: COLORS[i % COLORS.length] }
  })
}

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
    const idx = weightedIndex(current.map((s) => s.rule.weight))
    const slice = current[idx]
    // Zufällige Position innerhalb des Segments, nicht genau mittig
    const margin = (slice.end - slice.start) * 0.15
    const target = slice.start + margin + (randomInt(1000) / 1000) * (slice.end - slice.start - 2 * margin)
    const now = rotation.get()
    const base = now - (now % 360)
    const final = base + 360 * (6 + randomInt(3)) + (360 - target)
    await animate(rotation, final, { duration: 5.5, ease: [0.12, 0.8, 0.2, 1] })
    setResults((r) => [...r, slice.rule])
    if (noRepeat) setPendingExclude(slice.rule.id)
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
        <div className="relative w-full max-w-[520px]">
          <div className="absolute left-1/2 top-[-6px] z-10 -translate-x-1/2 text-5xl text-accent drop-shadow-[0_2px_4px_rgba(0,0,0,.8)]">▼</div>
          <motion.svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full drop-shadow-2xl" style={{ rotate: rotation }}>
            <circle cx={R} cy={R} r={R - 1} fill="#0b0a1f" stroke="#ffd60a" strokeWidth="4" />
            {slices.map(({ rule, start, end, color }) => {
              const mid = (start + end) / 2
              const [tx, ty] = polar(mid, R * 0.6)
              const label = rule.text.length > 26 ? rule.text.slice(0, 25) + "…" : rule.text
              return (
                <g key={rule.id}>
                  <path d={slicePath(start, end)} fill={color} stroke="#0b0a1f" strokeWidth="3" />
                  {slices.length === 1 && <circle cx={R} cy={R} r={R - 4} fill={color} />}
                  <text
                    x={tx}
                    y={ty}
                    fill="white"
                    fontSize={slices.length > 10 ? 14 : 17}
                    fontWeight="700"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${mid - 90} ${tx} ${ty})`}
                    style={{ paintOrder: "stroke", stroke: "#0008", strokeWidth: 3 }}
                  >
                    {label}
                  </text>
                </g>
              )
            })}
            <circle cx={R} cy={R} r={34} fill="#ffd60a" stroke="#0b0a1f" strokeWidth="4" />
          </motion.svg>
        </div>
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
