"use client"

import { useState, useTransition } from "react"
import { LoadoutSlot } from "@/components/loadout-bar"
import { createClient } from "@/lib/supabase/client"
import { setLootIcon } from "./actions"

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
    const supabase = createClient()
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png"
    const path = `items/${itemId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type })
    if (error) return setError(error.message)
    start(() => setLootIcon(itemId, supabase.storage.from("media").getPublicUrl(path).data.publicUrl))
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
