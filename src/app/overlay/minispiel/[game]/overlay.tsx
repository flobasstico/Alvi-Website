"use client"

import { useEffect, useState } from "react"
import { minigame, type MinigameKey } from "@/lib/minigames"
import { createClient } from "@/lib/supabase/client"

type Row = { run_id: number; name: string | null; avatar: string | null; score: number }

/** Kleine Anzeige: Tages-Top-3 eines Minispiels, aktualisiert alle 20 Sekunden */
export function MinigameOverlay({ game }: { game: MinigameKey }) {
  const info = minigame(game)
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    const supabase = createClient()
    const load = () =>
      supabase.rpc("minigame_board", { p_game: game, p_period: "heute", p_limit: 3 }).then(({ data }) => {
        if (data) setRows(data)
      })
    load()
    const id = setInterval(load, 20000)
    return () => clearInterval(id)
  }, [game])

  return (
    <div className="m-2 inline-block min-w-[260px] rounded-2xl bg-black/75 p-3 text-white shadow-xl">
      <div className="font-display text-xl text-accent">
        {info.emoji} {info.title} · Tages-Highscore
      </div>
      {rows.length ? (
        <ol className="mt-1 flex flex-col gap-1">
          {rows.map((r, i) => (
            <li key={r.run_id} className={i === 0 ? "flex items-center gap-2 text-lg font-bold" : "flex items-center gap-2 text-sm"}>
              <span>{["🥇", "🥈", "🥉"][i]}</span>
              {r.avatar && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.avatar} alt="" className="h-6 w-6 rounded-full" />
              )}
              <span className="flex-1 truncate">{r.name}</span>
              <span className="font-display tabular-nums text-accent">{r.score.toLocaleString("de-DE")}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-1 text-sm text-white/70">Heute noch kein Highscore – wer legt vor?</div>
      )}
    </div>
  )
}
