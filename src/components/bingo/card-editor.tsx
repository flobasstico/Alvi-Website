"use client"

import { useState } from "react"
import { BINGO_CELLS } from "@/lib/bingo"
import { shuffle } from "@/lib/random"
import { createClient } from "@/lib/supabase/client"

/** Eigene 3×3-Bingo-Karte zusammenstellen; gespeichert wird sie mit dem Twitch-Namen */
export function CardEditor({ pool, onCreated }: { pool: string[]; onCreated: (id: number) => void }) {
  const [tasks, setTasks] = useState<string[]>(Array(BINGO_CELLS).fill(""))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Leere Felder mit zufälligen Aufgaben aus dem Pool auffüllen (keine Doppelten)
  function fillRandom() {
    const used = new Set(tasks.map((t) => t.trim().toLowerCase()).filter(Boolean))
    const free = shuffle(pool.filter((t) => !used.has(t.toLowerCase())))
    setTasks((cur) => cur.map((t) => (t.trim() ? t : (free.shift() ?? ""))))
  }

  async function save() {
    setBusy(true)
    setError(null)
    const { data, error } = await createClient().rpc("bingo_card_create", { p_title: "", p_tasks: tasks })
    setBusy(false)
    if (error) return setError(error.message)
    setTasks(Array(BINGO_CELLS).fill(""))
    onCreated(data)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">Die Karte bekommt automatisch deinen Twitch-Namen (bei mehreren Karten durchnummeriert).</p>
      <div className="grid grid-cols-3 gap-2">
        {tasks.map((t, i) => (
          <textarea
            key={i}
            value={t}
            onChange={(e) => setTasks((cur) => cur.map((x, j) => (j === i ? e.target.value.replace(/\n/g, " ") : x)))}
            maxLength={80}
            placeholder={`Aufgabe ${i + 1}`}
            aria-label={`Aufgabe ${i + 1}`}
            className="input aspect-square resize-none p-2 text-center text-sm font-semibold"
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {pool.length > 0 && (
          <button type="button" className="btn-secondary" onClick={fillRandom} disabled={busy}>
            🎲 Leere Felder zufällig füllen
          </button>
        )}
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>
          {busy ? "Speichere…" : "Karte speichern"}
        </button>
      </div>
      {error && <p className="text-sm text-fail">{error}</p>}
    </div>
  )
}

/** Kleine Vorschau einer Karte */
export function CardPreview({ tasks }: { tasks: string[] }) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {tasks.map((t, i) => (
        <div key={i} className="flex aspect-square items-center justify-center rounded-md border border-line bg-bg/60 p-1 text-center text-[10px] font-semibold leading-tight">
          {t}
        </div>
      ))}
    </div>
  )
}
