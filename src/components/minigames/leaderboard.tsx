"use client"

import clsx from "clsx"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { PERIODS, type MinigameKey, type Period } from "@/lib/minigames"
import { createClient } from "@/lib/supabase/client"

export type BoardRow = { run_id: number; user_id: string; name: string | null; login: string | null; avatar: string | null; score: number; is_alvi: boolean }

/** Bestenliste eines Minispiels mit Zeitraum-Umschalter; reload ändert sich nach jeder eingereichten Runde */
export function Leaderboard({
  game,
  myId,
  isAdmin,
  reload = 0,
  initialPeriod = "heute",
}: {
  game: MinigameKey
  myId: string | null
  isAdmin: boolean
  reload?: number
  initialPeriod?: Period
}) {
  const [period, setPeriod] = useState<Period>(initialPeriod)
  const [rows, setRows] = useState<BoardRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await createClient().rpc("minigame_board", { p_game: game, p_period: period, p_limit: 50 })
    if (error) return setError(error.message)
    setError(null)
    setRows(data ?? [])
  }, [game, period])

  useEffect(() => {
    load()
  }, [load, reload])

  async function remove(r: BoardRow) {
    if (!confirm(`Alle ${r.name}-Runden in diesem Spiel löschen?`)) return
    const { error } = await createClient().from("minigame_runs").delete().eq("user_id", r.user_id).eq("game", game)
    if (error) return setError(error.message)
    load()
  }

  return (
    <div>
      <div className="mb-3 flex gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={clsx("rounded-lg px-3 py-1 text-sm font-bold", period === p.key ? "bg-accent text-black" : "bg-panel-2 text-muted hover:text-white")}
          >
            {p.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-fail">{error}</p>}
      {rows === null ? (
        <p className="text-sm text-muted">Lädt…</p>
      ) : rows.length ? (
        <ol className="divide-y divide-line/50">
          {rows.map((r, i) => (
            <li key={r.run_id} className={clsx("-mx-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm", r.user_id === myId && "bg-accent/10")}>
              <span className="w-8 shrink-0 font-display tabular-nums text-muted">{["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`}</span>
              {r.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.avatar} alt="" className="h-6 w-6 shrink-0 rounded-full" />
              ) : (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-line text-xs">👤</span>
              )}
              <span className="min-w-0 flex-1 truncate font-semibold">
                {r.login ? (
                  <Link href={`/profil/${r.login}`} className="hover:text-accent hover:underline">
                    {r.name}
                  </Link>
                ) : (
                  r.name
                )}
                {r.is_alvi && <span className="chip ml-1.5 px-1.5 py-0 text-[10px]">Streamer</span>}
              </span>
              <span className="font-bold tabular-nums text-accent">{r.score.toLocaleString("de-DE")}</span>
              {isAdmin && (
                <button type="button" onClick={() => remove(r)} className="text-muted hover:text-fail" title="Einträge löschen">
                  🗑
                </button>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted">Noch keine Einträge {period === "heute" ? "heute" : period === "woche" ? "diese Woche" : ""}.</p>
      )}
    </div>
  )
}
