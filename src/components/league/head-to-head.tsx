"use client"

import { useState } from "react"
import { headToHead, swatchStyle, textColor, type LeagueResult } from "@/lib/league"

type C = { id: number; name: string; color: string }

/** Kopf-an-Kopf: zwei Creator wählen, direkte Bilanz aus gemeinsamen Challenges */
export function HeadToHeadBox({ creators, results }: { creators: C[]; results: LeagueResult[] }) {
  const [a, setA] = useState(creators[0]?.id ?? 0)
  const [b, setB] = useState(creators[1]?.id ?? 0)
  if (creators.length < 2) return <p className="text-sm text-muted">Mindestens zwei Creator nötig.</p>
  const ca = creators.find((c) => c.id === a)!
  const cb = creators.find((c) => c.id === b)!
  const h = headToHead(results, a, b)
  const total = h.aBetter + h.bBetter + h.even
  const pick = (value: number, onChange: (v: number) => void, other: number, label: string) => (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="input w-auto py-1 font-bold" aria-label={label}>
      {creators.map((c) => (
        <option key={c.id} value={c.id} disabled={c.id === other}>
          {c.name}
        </option>
      ))}
    </select>
  )
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {pick(a, setA, b, "Creator 1")}
        <span className="font-display text-xl text-muted">vs.</span>
        {pick(b, setB, a, "Creator 2")}
      </div>
      {h.shared === 0 ? (
        <p className="text-center text-sm text-muted">Noch keine gemeinsame Challenge.</p>
      ) : (
        <>
          <div className="flex items-center justify-center gap-4 font-display text-5xl tabular-nums">
            <span style={{ color: textColor(ca.color) }}>{h.aBetter}</span>
            <span className="text-2xl text-muted">:</span>
            <span style={{ color: textColor(cb.color) }}>{h.bBetter}</span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-line" aria-hidden>
            <div style={{ width: `${(h.aBetter / total) * 100}%`, ...swatchStyle(ca.color) }} />
            <div style={{ width: `${(h.even / total) * 100}%` }} className="bg-white/30" />
            <div style={{ width: `${(h.bBetter / total) * 100}%`, ...swatchStyle(cb.color) }} />
          </div>
          <p className="text-center text-sm text-muted">
            {h.shared} gemeinsame {h.shared === 1 ? "Challenge" : "Challenges"} – öfter besser platziert: {ca.name} {h.aBetter}×, {cb.name} {h.bBetter}×
            {h.even ? `, gleich ${h.even}×` : ""}. Siege dabei: {ca.name} {h.aWins}, {cb.name} {h.bWins}.
          </p>
        </>
      )}
    </div>
  )
}
