"use client"

import { useState, useTransition } from "react"
import { LoadoutSlot } from "@/components/loadout-bar"
import { createClient } from "@/lib/supabase/client"
import { setLootIcon, setLootIconAll } from "./actions"

/** Lädt ein Bild in den Speicher hoch und gibt die öffentliche Adresse zurück */
async function uploadImage(itemId: number, file: File) {
  const supabase = createClient()
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png"
  const path = `items/${itemId}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type })
  if (error) throw error
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl
}

const SAVE_FAILED = "Speichern fehlgeschlagen – bitte neu laden"
const FOCUS = "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-white"

export function ItemIconUpload({
  itemId,
  current,
  rarity,
  type,
  name,
  size = "sm",
}: {
  itemId: number
  current: string | null
  rarity: string
  type: string
  name: string
  size?: "sm" | "md"
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  async function upload(file: File) {
    setError(null)
    try {
      const url = await uploadImage(itemId, file)
      // Fehler der Server-Action abfangen, statt die Admin-Seite in die Fehleransicht zu schicken
      start(async () => {
        try {
          await setLootIcon(itemId, url)
        } catch {
          setError(SAVE_FAILED)
        }
      })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <span className="relative">
      <label className={`relative block cursor-pointer rounded-lg ${FOCUS}`} title={current ? "Bild ersetzen" : "Bild hochladen"}>
        <LoadoutSlot item={{ name, rarity, type, iconUrl: current }} index={0} size={size} />
        <span className="absolute -bottom-1 -right-1 rounded-full bg-accent px-1 text-[10px] font-bold text-black">
          {pending ? "…" : "⬆"}
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label={`Bild für ${name} hochladen`}
          onChange={(e) => {
            if (e.target.files?.[0]) upload(e.target.files[0])
            e.target.value = ""
          }}
        />
      </label>
      {error && <span className="absolute left-14 top-0 z-10 whitespace-nowrap rounded bg-bg px-1 text-xs text-fail">{error}</span>}
    </span>
  )
}

/** Ein Bild für alle Seltenheiten eines Items */
export function ItemIconUploadAll({ itemId }: { itemId: number }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  async function upload(file: File) {
    setError(null)
    try {
      const url = await uploadImage(itemId, file)
      start(async () => {
        try {
          await setLootIconAll(itemId, url)
        } catch {
          setError(SAVE_FAILED)
        }
      })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <label
        className={`cursor-pointer rounded-md bg-panel-2 px-2 py-0.5 text-xs font-semibold text-muted hover:text-white ${FOCUS}`}
        title="Dieses Bild wird bei allen Seltenheiten eingesetzt"
      >
        {pending ? "Wird gespeichert …" : "🖼 Ein Bild für alle Seltenheiten"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.[0]) upload(e.target.files[0])
            e.target.value = ""
          }}
        />
      </label>
      {error && <span className="text-xs text-fail">{error}</span>}
    </span>
  )
}
