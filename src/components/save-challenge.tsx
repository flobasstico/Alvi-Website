"use client"

import { useState, useTransition } from "react"
import { saveChallenge } from "@/app/actions"
import type { Json } from "@/lib/database.types"
import type { Source } from "@/lib/constants"

export function SaveChallenge({
  source,
  title,
  config,
  disabled,
}: {
  source: Source
  title: string
  config: Json
  disabled?: boolean
}) {
  const [pending, start] = useTransition()
  const [savedId, setSavedId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const save = (status: "geplant" | "aktiv") =>
    start(async () => {
      setError(null)
      try {
        setSavedId(await saveChallenge({ source, title, config, status }))
      } catch (e) {
        setError(e instanceof Error ? e.message : "Fehler beim Speichern")
      }
    })

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn-primary" disabled={disabled || pending} onClick={() => save("aktiv")}>
        Challenge starten
      </button>
      <button className="btn-secondary" disabled={disabled || pending} onClick={() => save("geplant")}>
        Für später merken
      </button>
      {savedId && <span className="text-sm text-win">Gespeichert (#{savedId}) – Ergebnis im Admin/Stats eintragen.</span>}
      {error && <span className="text-sm text-fail">{error}</span>}
    </div>
  )
}
