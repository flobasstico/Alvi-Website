"use client"

import clsx from "clsx"
import { useActionState, useState } from "react"
import { RARITIES, RARITY_CLASS, RARITY_LABEL } from "@/lib/constants"
import { createLoadoutSession } from "./actions"

export function CreateLoadoutSession() {
  const [state, action, pending] = useActionState(createLoadoutSession, undefined)
  const [rarities, setRarities] = useState<string[]>([...RARITIES])
  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="title">Titel (optional)</label>
        <input id="title" name="title" className="input" placeholder="z. B. Squad-Abend mit Kevin" />
      </div>
      <fieldset>
        <legend className="label">Seltenheiten</legend>
        <div className="flex flex-wrap gap-2">
          {RARITIES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRarities((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]))}
              className={clsx(
                "rounded-lg border-2 bg-gradient-to-b px-3 py-1 text-sm font-bold transition",
                RARITY_CLASS[r],
                !rarities.includes(r) && "opacity-30 grayscale",
              )}
            >
              {RARITY_LABEL[r]}
            </button>
          ))}
        </div>
        {rarities.map((r) => (
          <input key={r} type="hidden" name="rarity" value={r} />
        ))}
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="mustHeal" defaultChecked />
        Mindestens eine Heilung garantieren
      </label>
      <button className="btn-primary" disabled={pending || rarities.length === 0}>Runde eröffnen</button>
      <p className="text-xs text-muted">Danach den Seitenlink an die Mitspieler schicken. Jeder würfelt an seinem Gerät.</p>
      {state?.error && <p className="text-sm text-fail">{state.error}</p>}
    </form>
  )
}
