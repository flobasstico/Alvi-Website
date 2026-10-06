"use client"

import clsx from "clsx"
import { useActionState, useState } from "react"
import { RARITIES, RARITY_CLASS, RARITY_LABEL } from "@/lib/constants"
import { createLoadoutSession } from "./actions"

export function CreateLoadoutSession() {
  const [state, action, pending] = useActionState(createLoadoutSession, undefined)
  const [rarities, setRarities] = useState<string[]>([...RARITIES])
  const [maxPlayers, setMaxPlayers] = useState(8)
  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="title">Titel (optional)</label>
        <input id="title" name="title" className="input" placeholder="z. B. Squad-Abend mit Kevin" />
      </div>
      <div>
        <span className="label">Spieler (max.)</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Spieleranzahl">
          {[2, 3, 4, 5, 6, 7, 8].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={maxPlayers === n}
              className={clsx("h-9 w-9 rounded-lg font-bold", maxPlayers === n ? "bg-accent text-black" : "bg-panel-2 text-muted hover:text-white")}
              onClick={() => setMaxPlayers(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <input type="hidden" name="max_players" value={maxPlayers} />
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
      <p className="text-xs text-muted">Bis zu 8 Spieler. Danach den Einladungslink (mit Join-Code) an die Mitspieler schicken. Jeder würfelt an seinem Gerät.</p>
      {state?.error && <p className="text-sm text-fail">{state.error}</p>}
    </form>
  )
}
