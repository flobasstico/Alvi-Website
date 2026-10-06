"use client"

import Link from "next/link"
import { useActionState, useState } from "react"
import { createEscalation } from "./actions"

export function CreateEscalation({ baseCount, extraCount, isAdmin }: { baseCount: number; extraCount: number; isAdmin: boolean }) {
  const missing = baseCount === 0 ? "Grundregeln" : extraCount === 0 ? "Zusatzregeln" : null
  const [state, action, pending] = useActionState(createEscalation, undefined)
  const [mode, setMode] = useState<"zufall" | "chat">("zufall")
  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="title">Titel (optional)</label>
        <input id="title" name="title" className="input" placeholder="z. B. Squad-Abend mit Kevin" />
      </div>
      <div>
        <label className="label" htmlFor="minutes">Neue Regel alle … Minuten</label>
        <input id="minutes" name="minutes" type="number" min={0.5} max={60} step={0.5} defaultValue={4} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="max_players">Spieler (max.)</label>
        <input id="max_players" name="max_players" type="number" min={2} max={8} defaultValue={4} className="input" />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="label">Modus</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="mode" value="zufall" checked={mode === "zufall"} onChange={() => setMode("zufall")} className="mt-1" />
          <span><b>Zufall</b> – jede neue Regel wird zufällig gezogen.</span>
        </label>
        {isAdmin && (
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="mode" value="chat" checked={mode === "chat"} onChange={() => setMode("chat")} className="mt-1" />
          <span>
            <b>Chat-Abstimmung</b> – der Twitch-Chat stimmt mit !1/!2/!3 über die nächste Regel ab (3 Optionen).
          </span>
        </label>
        )}
      </fieldset>
      {mode === "chat" && (
        <div>
          <label className="label" htmlFor="channel">Twitch-Kanal</label>
          <input id="channel" name="channel" className="input" placeholder="alvivb" defaultValue="alvivb" pattern="#?[A-Za-z0-9_]{3,25}" />
        </div>
      )}
      <p className="text-sm text-muted">
        {baseCount} Grundregeln, {extraCount} Zusatzregeln.{" "}
        {isAdmin && <Link href="/admin?tab=eskalation" className="text-accent-2 underline">Regelpool bearbeiten</Link>}
      </p>
      <button className="btn-primary" disabled={pending || !!missing}>Runde eröffnen</button>
      {!isAdmin && <p className="text-xs text-muted">Runden ohne Admin erscheinen nicht in Übersichten und Stats und werden nach dem Ende nicht gespeichert.</p>}
      {missing && <p className="text-sm text-fail">Noch keine aktiven {missing} – zuerst im Admin-Bereich anlegen.</p>}
      {state?.error && <p className="text-sm text-fail">{state.error}</p>}
    </form>
  )
}
