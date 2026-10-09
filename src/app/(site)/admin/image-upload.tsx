"use client"

import { useState, useTransition } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * Bild hochladen und über eine Server-Action speichern (z. B. Vorschaubild eines Modus, Skin eines Creators).
 * `save(null)` setzt zurück.
 */
export function ImageUpload({
  folder,
  name,
  current,
  save,
  label,
  resetLabel = "Zurücksetzen",
  preview,
}: {
  folder: string
  name: string
  current: string | null
  save: (url: string | null) => Promise<void>
  label: string
  resetLabel?: string
  preview?: React.ReactNode
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  async function upload(file: File) {
    setError(null)
    if (file.size > 4_000_000) return setError("Bild ist größer als 4 MB")
    const supabase = createClient()
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png"
    const path = `${folder}/${name}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type })
    if (error) return setError(error.message)
    start(() => save(supabase.storage.from("media").getPublicUrl(path).data.publicUrl))
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      {preview}
      <div className="flex flex-wrap items-center gap-2">
        <label className="btn-secondary cursor-pointer px-2 py-1 text-xs">
          {pending ? "Speichere…" : label}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) upload(e.target.files[0])
              e.target.value = ""
            }}
          />
        </label>
        {current && (
          <button type="button" className="text-muted underline hover:text-fail" disabled={pending} onClick={() => start(() => save(null))}>
            {resetLabel}
          </button>
        )}
        {error && <span className="text-fail">{error}</span>}
      </div>
    </div>
  )
}
