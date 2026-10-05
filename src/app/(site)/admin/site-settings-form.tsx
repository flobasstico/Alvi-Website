"use client"

import { useActionState } from "react"
import { CHANNELS } from "@/lib/site"
import { saveSiteSettings } from "./actions"

export function SiteSettingsForm({ values }: { values: Record<string, string> }) {
  const [state, action, pending] = useActionState(saveSiteSettings, undefined)
  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <section className="panel flex h-fit flex-col gap-3">
        <h2 className="font-display text-2xl">Alvis Kanäle</h2>
        <p className="text-sm text-muted">Erscheinen unten auf jeder Seite. Leere Felder werden nicht angezeigt.</p>
        {CHANNELS.map((c) => (
          <div key={c.key}>
            <label className="label" htmlFor={c.key}>{c.label}</label>
            <input id={c.key} name={c.key} defaultValue={values[c.key] ?? ""} placeholder="https://…" className="input" />
          </div>
        ))}
      </section>
      <section className="panel flex flex-col gap-4">
        <h2 className="font-display text-2xl">Impressum &amp; Datenschutz</h2>
        <p className="text-sm text-muted">
          Vorlagen mit [Platzhaltern] – vor einer Veröffentlichung ausfüllen. Zeilen mit „## “ werden Überschriften, eine Leerzeile
          trennt Absätze. Keine Rechtsberatung: im Zweifel mit einem Generator (z. B. e-recht24) oder anwaltlich prüfen lassen.
        </p>
        <div>
          <label className="label" htmlFor="impressum">Impressum (/impressum)</label>
          <textarea id="impressum" name="impressum" defaultValue={values.impressum ?? ""} className="input min-h-64 font-mono text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="datenschutz">Datenschutzerklärung (/datenschutz)</label>
          <textarea id="datenschutz" name="datenschutz" defaultValue={values.datenschutz ?? ""} className="input min-h-96 font-mono text-xs" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" disabled={pending}>{pending ? "Speichere…" : "Speichern"}</button>
          {state?.error && <span className="text-sm text-fail">{state.error}</span>}
          {state?.ok && !pending && <span className="text-sm text-win">Gespeichert ✓</span>}
        </div>
      </section>
    </form>
  )
}
