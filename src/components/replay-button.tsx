"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

/** „Nachspielen“: legt eine identische Kopie einer abgeschlossenen Runde an, der Zuschauer ist Host */
export function ReplayButton({ kind, sourceId, loggedIn }: { kind: "eskalation" | "winchallenge"; sourceId: number; loggedIn: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!loggedIn) return <p className="text-sm text-muted">🔁 Mit Twitch einloggen, um diese Challenge nachzuspielen.</p>

  async function replay() {
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { data, error } =
      kind === "eskalation"
        ? await supabase.rpc("escalation_replay", { p_source: sourceId })
        : await supabase.rpc("win_replay", { p_source: sourceId })
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    router.push(`/${kind}/${data}`)
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button className="btn-primary px-6 py-2" onClick={replay} disabled={busy}>
        {busy ? "Wird angelegt…" : "🔁 Nachspielen"}
      </button>
      <p className="text-xs text-muted">Identische Challenge für dich und deine Freunde – ohne Admin wird sie nicht gespeichert.</p>
      {error && <p className="text-sm text-fail">{error}</p>}
    </div>
  )
}

/** Hinweis in Nachspiel-Runden ohne Admin */
export function UnofficialNote() {
  return (
    <p className="rounded-xl border border-accent-2/50 bg-accent-2/10 px-3 py-2 text-sm">
      🔁 <b>Nachspiel-Runde</b> – erscheint nicht in Übersichten und Stats und wird beim Beenden gelöscht (außer ein Admin spielt mit).
    </p>
  )
}

/** Anzeige, wenn eine Nachspiel-Runde beendet und dadurch gelöscht wurde */
export function GoneNote({ back }: { back: string }) {
  return (
    <div className="panel flex flex-col items-center gap-3 py-10 text-center">
      <div className="font-display text-3xl">Runde beendet</div>
      <p className="text-muted">Nachspiel-Runden ohne Admin werden nicht gespeichert.</p>
      <a href={back} className="btn-secondary">Zurück</a>
    </div>
  )
}
