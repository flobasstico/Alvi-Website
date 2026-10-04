"use client"

import { useState, useTransition } from "react"
import { startBingo } from "./actions"

export function StartBingo({ running }: { running: boolean }) {
  const [title, setTitle] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  return (
    <div className="panel mb-6 flex flex-wrap items-end gap-3">
      <div className="min-w-60 flex-1">
        <label className="label" htmlFor="bingo-title">Neue Runde (optionaler Titel)</label>
        <input id="bingo-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Stream vom Freitag" />
      </div>
      <button
        className="btn-primary"
        disabled={pending}
        onClick={() => {
          if (running && !confirm("Laufende Runde ohne Wertung beenden und neue starten?")) return
          start(async () => {
            setError(null)
            try {
              await startBingo(title)
              setTitle("")
            } catch (e) {
              setError(e instanceof Error ? e.message : "Fehler")
            }
          })
        }}
      >
        Neue Runde starten
      </button>
      {error && <p className="w-full text-sm text-fail">{error}</p>}
    </div>
  )
}
