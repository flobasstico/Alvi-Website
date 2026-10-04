"use client"

import Link from "next/link"
import { useActionState, useState } from "react"
import { createEscalation } from "./actions"

export function CreateEscalation({ poolSize }: { poolSize: number }) {
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
      <fieldset className="flex flex-col gap-2">
        <legend className="label">Modus</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="mode" value="zufall" checked={mode === "zufall"} onChange={() => setMode("zufall")} className="mt-1" />
          <span><b>Zufall</b> – jede neue Regel wird zufällig gezogen.</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="mode" value="chat" checked={mode === "chat"} onChange={() => setMode("chat")} className="mt-1" />
          <span>
            <b>Chat-Abstimmung</b> – der Twitch-Chat stimmt mit !1/!2/!3 über die nächste Regel ab (3 Optionen).
          </span>
        </label>
      </fieldset>
      {mode === "chat" && (
        <div>
          <label className="label" htmlFor="channel">Twitch-Kanal</label>
          <input id="channel" name="channel" className="input" placeholder="alvivb" defaultValue="alvivb" pattern="#?[A-Za-z0-9_]{3,25}" />
        </div>
      )}
      <p className="text-sm text-muted">
        {poolSize} Regeln im Pool.{" "}
        <Link href="/admin?tab=eskalation" className="text-accent-2 underline">Regelpool bearbeiten</Link>
      </p>
      <button className="btn-primary" disabled={pending || poolSize === 0}>Runde eröffnen</button>
      {poolSize === 0 && <p className="text-sm text-fail">Der Regelpool ist leer – zuerst Regeln anlegen.</p>}
      {state?.error && <p className="text-sm text-fail">{state.error}</p>}
    </form>
  )
}
