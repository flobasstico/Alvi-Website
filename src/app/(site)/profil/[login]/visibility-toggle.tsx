"use client"

import clsx from "clsx"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

/** Eigenes Profil öffentlich oder privat schalten */
export function VisibilityToggle({ isPublic }: { isPublic: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function set(next: boolean) {
    if (next === isPublic) return
    setBusy(true)
    setError(null)
    const { error } = await createClient().rpc("set_profile_public", { p_public: next })
    setBusy(false)
    if (error) return setError(error.message)
    router.refresh()
  }

  return (
    <div className="w-full sm:w-auto sm:max-w-xs">
      <div className="mb-1 text-xs font-bold uppercase text-muted">Sichtbarkeit</div>
      <div className="flex gap-1 rounded-xl bg-panel-2 p-1">
        {[
          { v: true, label: "🌍 Öffentlich" },
          { v: false, label: "🔒 Privat" },
        ].map((o) => (
          <button
            key={String(o.v)}
            type="button"
            disabled={busy}
            onClick={() => set(o.v)}
            aria-pressed={isPublic === o.v}
            className={clsx("flex-1 rounded-lg px-3 py-1.5 text-sm font-bold", isPublic === o.v ? "bg-accent text-black" : "text-muted hover:text-white")}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-muted">
        {isPublic
          ? "Dein Profil ist für alle sichtbar und du erscheinst in den Tabellen der Website."
          : "Nur du siehst dein Profil. Du erscheinst in keiner Tabelle oder Rangliste der Website."}
      </p>
      {error && <p className="mt-1 text-xs text-fail">{error}</p>}
    </div>
  )
}
