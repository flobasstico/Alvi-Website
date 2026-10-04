"use client"

import Link from "next/link"
import { useActionState } from "react"
import { createEscalation } from "./actions"

export function CreateEscalation({ poolSize }: { poolSize: number }) {
  const [state, action, pending] = useActionState(createEscalation, undefined)
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
