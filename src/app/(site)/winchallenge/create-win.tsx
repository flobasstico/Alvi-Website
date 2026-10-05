"use client"

import { useActionState, useState } from "react"
import { createWinChallenge } from "./actions"

type Row = { key: number; name: string; target: number }

export function CreateWin() {
  const [state, action, pending] = useActionState(createWinChallenge, undefined)
  const [rows, setRows] = useState<Row[]>([{ key: 1, name: "", target: 1 }])
  const update = (key: number, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)))

  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="title">Titel (optional)</label>
        <input id="title" name="title" className="input" placeholder="z. B. 10 Siege in 5 Spielen" maxLength={80} />
      </div>
      <div>
        <label className="label" htmlFor="minutes">Timer (Minuten, 0 = ohne Zeitlimit)</label>
        <input id="minutes" name="minutes" type="number" min={0} max={1440} step={1} defaultValue={60} className="input" />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="label">Spiele und benötigte Siege</legend>
        {rows.map((r, i) => (
          <div key={r.key} className="flex gap-2">
            <input
              name="game_name"
              value={r.name}
              onChange={(e) => update(r.key, { name: e.target.value })}
              placeholder={i === 0 ? "z. B. Fortnite" : "Spiel"}
              maxLength={60}
              className="input flex-1"
              aria-label={`Spiel ${i + 1}`}
            />
            <input
              name="game_target"
              type="number"
              min={1}
              max={999}
              value={r.target}
              onChange={(e) => update(r.key, { target: Number(e.target.value) })}
              className="input w-20"
              aria-label={`Siege für Spiel ${i + 1}`}
              title="Benötigte Siege"
            />
            <button
              type="button"
              className="btn-secondary px-2"
              onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs))}
              disabled={rows.length === 1}
              aria-label="Spiel entfernen"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary self-start px-3 py-1 text-sm"
          onClick={() => setRows((rs) => [...rs, { key: Math.max(...rs.map((x) => x.key)) + 1, name: "", target: 1 }])}
        >
          + Spiel hinzufügen
        </button>
      </fieldset>
      <button className="btn-primary" disabled={pending}>Winchallenge anlegen</button>
      {state?.error && <p className="text-sm text-fail">{state.error}</p>}
    </form>
  )
}
