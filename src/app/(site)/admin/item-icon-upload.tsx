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
      start(() => setLootIcon(itemId, url))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <label
      className="relative cursor-pointer"
      title={current ? "Bild ersetzen" : "Bild hochladen"}
    >
      <LoadoutSlot item={{ name, rarity, type, iconUrl: current }} index={0} size={size} />
      <span className="absolute -bottom-1 -right-1 rounded-full bg-accent px-1 text-[10px] font-bold text-black">
        {pending ? "…" : "⬆"}
      </span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      {error && <span className="absolute left-14 top-0 whitespace-nowrap text-xs text-fail">{error}</span>}
    </label>
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
      start(() => setLootIconAll(itemId, url))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <label className="cursor-pointer rounded-md bg-panel-2 px-2 py-0.5 text-xs font-semibold text-muted hover:text-white" title="Dieses Bild wird bei allen Seltenheiten eingesetzt">
      {pending ? "Wird gespeichert …" : "🖼 Ein Bild für alle Seltenheiten"}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) upload(e.target.files[0])
          e.target.value = ""
        }}
      />
      {error && <span className="ml-2 text-fail">{error}</span>}
    </label>
  )
}
