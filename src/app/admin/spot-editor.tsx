"use client"

import { useRef, useState, useTransition } from "react"
import { IslandMap } from "@/components/island-map"
import { addDropSpot } from "./actions"

type Spot = { id: number; name: string; x: number; y: number; active: boolean }

export function SpotEditor({ spots, mapUrl, disabled }: { spots: Spot[]; mapUrl: string | null; disabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function onClick(e: React.MouseEvent) {
    const rect = ref.current!.getBoundingClientRect()
    setPos({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 })
  }

  return (
    <section className="panel">
      <h2 className="mb-2 font-display text-2xl">Spot setzen</h2>
      <p className="mb-3 text-sm text-muted">Auf die Karte klicken, Namen eingeben, speichern.</p>
      <div ref={ref} onClick={onClick} className="relative aspect-square w-full cursor-crosshair overflow-hidden rounded-xl">
        <IslandMap imageUrl={mapUrl} />
        {spots.map((s) => (
          <div
            key={s.id}
            className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-fail"
            style={{ left: `${s.x}%`, top: `${s.y}%`, opacity: s.active ? 1 : 0.4 }}
            title={s.name}
          />
        ))}
        {pos && (
          <div
            className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-2 border-black bg-accent"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          />
        )}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!pos || !name.trim()) return
          start(async () => {
            setError(null)
            try {
              await addDropSpot({ name, ...pos })
              setName("")
              setPos(null)
            } catch (err) {
              setError(err instanceof Error ? err.message : "Fehler")
            }
          })
        }}
      >
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name des Spots" />
        <button className="btn-primary" disabled={disabled || pending || !pos || !name.trim()}>Speichern</button>
      </form>
      {error && <p className="mt-2 text-sm text-fail">{error}</p>}
    </section>
  )
}
