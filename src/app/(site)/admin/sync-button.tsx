"use client"

import { useState, useTransition } from "react"
import { syncChannelVideos } from "./actions"

/** „Kanäle jetzt abgleichen“ – zeigt während des Abgleichs einen Hinweis (kann beim ersten Mal etwas dauern) */
export function SyncButton() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn-primary px-4 py-1.5 text-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null)
            try {
              await syncChannelVideos()
            } catch {
              setError("Abgleich fehlgeschlagen – bitte neu laden und nochmal versuchen")
            }
          })
        }
      >
        {pending ? "Gleicht ab…" : "🔄 Kanäle jetzt abgleichen"}
      </button>
      {pending && <span className="text-xs text-muted">Beim ersten Mal werden alle Videos geladen, das kann bis zu einer Minute dauern.</span>}
      {error && <span className="text-xs text-fail">{error}</span>}
    </div>
  )
}
