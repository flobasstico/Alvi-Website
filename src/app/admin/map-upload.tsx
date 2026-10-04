"use client"

import { useState, useTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import { setSeasonMap } from "./actions"

export function MapUpload({ seasonId, current }: { seasonId: number; current: string | null }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  async function upload(file: File) {
    setError(null)
    const supabase = createClient()
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png"
    const path = `maps/season-${seasonId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("media").upload(path, file, { upsert: false, contentType: file.type })
    if (error) return setError(error.message)
    const { data } = supabase.storage.from("media").getPublicUrl(path)
    start(() => setSeasonMap(seasonId, data.publicUrl))
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current} alt="Map" className="h-16 w-16 rounded-lg border border-line object-cover" />
      ) : (
        <span className="text-muted">Keine Map (Platzhalter wird genutzt)</span>
      )}
      <label className="btn-secondary cursor-pointer px-3 py-1 text-xs">
        {pending ? "Speichere…" : "Map hochladen"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </label>
      {current && (
        <button className="btn-secondary px-3 py-1 text-xs" disabled={pending} onClick={() => start(() => setSeasonMap(seasonId, null))}>
          Entfernen
        </button>
      )}
      {error && <span className="text-fail">{error}</span>}
    </div>
  )
}
