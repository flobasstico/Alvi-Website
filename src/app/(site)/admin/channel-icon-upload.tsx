"use client"

import { useState, useTransition } from "react"
import { PlatformIcon } from "@/components/channel-icons"
import { createClient } from "@/lib/supabase/client"
import { setChannelIcon } from "./actions"

/** Eigenes Icon für eine Plattform hochladen (z. B. das Merch-Logo) */
export function ChannelIconUpload({ channelKey, current }: { channelKey: string; current: string | null }) {
  const [icon, setIcon] = useState(current)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  async function upload(file: File) {
    setError(null)
    if (file.size > 2_000_000) return setError("Bild ist größer als 2 MB")
    const supabase = createClient()
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png"
    const path = `brand/${channelKey}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("media").upload(path, file, { upsert: false, contentType: file.type })
    if (error) return setError(error.message)
    const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl
    start(async () => {
      await setChannelIcon(channelKey, url)
      setIcon(url)
    })
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <PlatformIcon platform={channelKey} src={icon} className="h-9 w-9" />
      <label className="btn-secondary cursor-pointer px-2 py-1 text-xs">
        {pending ? "Speichere…" : icon ? "Logo ersetzen" : "Eigenes Logo hochladen"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </label>
      {icon && (
        <button
          type="button"
          className="btn-secondary px-2 py-1 text-xs"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setChannelIcon(channelKey, null)
              setIcon(null)
            })
          }
        >
          Standard-Icon
        </button>
      )}
      {error && <span className="text-fail">{error}</span>}
    </div>
  )
}
