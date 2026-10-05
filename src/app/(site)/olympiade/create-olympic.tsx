"use client"

import clsx from "clsx"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { StaleNote } from "@/components/replay-button"
import { parseGames } from "@/lib/olympiade"
import { createClient } from "@/lib/supabase/client"

export function CreateOlympic() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [text, setText] = useState("")
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const games = parseGames(text)

  async function create() {
    setBusy(true)
    setError(null)
    const { data, error } = await createClient().rpc("olympic_create", { p_title: title, p_games: games, p_max_players: maxPlayers })
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    router.push(`/olympiade/${data}`)
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="ol-title">Titel (optional)</label>
        <input id="ol-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="input" placeholder="z. B. Sommer-Olympiade" />
      </div>
      <div>
        <label className="label" htmlFor="ol-games">Spiele – eins pro Zeile</label>
        <textarea
          id="ol-games"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          className="input"
          placeholder={"Boxfight\nZonewars\nNur Pistolen\nBuild-Battle"}
        />
        <p className="mt-1 text-xs text-muted">
          {games.length} {games.length === 1 ? "Spiel" : "Spiele"} · gleiche Chancen auf dem Rad · bis {games.length * (games.length + 1) / 2 || 0} Punkte insgesamt
        </p>
      </div>
      <div>
        <span className="label">Spieler (max.)</span>
        <div className="flex flex-wrap gap-1">
          {[2, 3, 4, 5, 6, 7, 8].map((n) => (
            <button
              key={n}
              type="button"
              className={clsx("h-9 w-9 rounded-lg font-bold", maxPlayers === n ? "bg-accent text-black" : "bg-panel-2 text-muted hover:text-white")}
              onClick={() => setMaxPlayers(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <button className="btn-primary" onClick={create} disabled={busy || games.length < 2}>
        {busy ? "Öffne…" : "Lobby öffnen"}
      </button>
      <p className="text-xs text-muted">Mindestens 2 Spiele und 2 Spieler. Olympiaden ohne Admin werden nach dem Ende nicht gespeichert.</p>
      <StaleNote game="olympiade" />
      {error && <p className="text-sm text-fail">{error}</p>}
    </div>
  )
}
