"use client"

import clsx from "clsx"
import { useMemo, useState, useTransition } from "react"
import { BingoGrid } from "@/components/bingo/bingo-grid"
import { RankingList } from "@/components/bingo/ranking-list"
import { useBingo } from "@/components/bingo/use-bingo"
import { CopyButton } from "@/components/session/players"
import { BINGO_CELLS } from "@/lib/bingo"
import { ranking, streamerCard, type BingoState } from "@/lib/bingo-live"
import { celebrate } from "@/lib/confetti"
import { sample } from "@/lib/random"
import { endBingo } from "./actions"

export function BingoBoard({ initial, userId, isAdmin }: { initial: BingoState; userId: string | null; isAdmin: boolean }) {
  const { state, setState, refetch, supabase } = useBingo(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const game = state.game!
  const marks = useMemo(() => new Set(state.marks), [state.marks])
  const taskText = useMemo(() => new Map(state.tasks.map((t) => [Number(t.id), t.text])), [state.tasks])
  const myCard = state.cards.find((c) => c.user_id === userId) ?? null
  const ranked = useMemo(() => ranking(state, marks), [state, marks])
  const running = game.status === "laeuft"

  async function toggleMark(taskId: number) {
    setError(null)
    const has = marks.has(taskId)
    // Sofort anzeigen, Realtime/Polling bestätigt
    setState((s) => ({ ...s, marks: has ? s.marks.filter((m) => m !== taskId) : [...s.marks, taskId] }))
    const { error } = has
      ? await supabase.from("bingo_marks").delete().eq("game_id", game.id).eq("task_id", taskId)
      : await supabase.from("bingo_marks").insert({ game_id: game.id, task_id: taskId })
    if (error) setError(error.message)
    await refetch()
  }

  async function joinGame() {
    setError(null)
    const { error } = await supabase.from("bingo_cards").insert({ game_id: game.id, task_ids: sample(game.task_ids, BINGO_CELLS) })
    if (error) setError(error.message)
    await refetch()
  }

  const origin = typeof window === "undefined" ? "" : location.origin

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl">{game.title ?? `Runde #${game.id}`}</h2>
        <span className={clsx("chip", running ? "border-win text-win" : "")}>{running ? "Läuft" : "Beendet"}</span>
        <span className="text-sm text-muted">{marks.size} Aufgaben erledigt</span>
        {isAdmin && running && (
          <button
            className="btn-secondary ml-auto"
            disabled={pending}
            onClick={() =>
              confirm("Runde beenden und werten? Geschafft ist sie nur mit voller Karte.") &&
              start(async () => {
                if (await endBingo(game.id)) celebrate()
                await refetch()
              })
            }
          >
            Runde beenden & werten
          </button>
        )}
      </div>
      {error && <p className="text-sm text-fail">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <BingoGrid title={`${state.streamerName}s Karte`} ids={streamerCard(game)} marks={marks} taskText={taskText} highlight />
        {myCard ? (
          <BingoGrid title="Deine Karte" ids={myCard.task_ids} marks={marks} taskText={taskText} />
        ) : (
          <div className="panel flex flex-col items-center justify-center gap-3 text-center">
            <div className="text-5xl">🎟️</div>
            {!running ? (
              <p className="text-muted">Diese Runde ist vorbei.</p>
            ) : userId ? (
              <>
                <p className="text-muted">Hol dir eine zufällige Karte und sammle Punkte, wenn Alvi deine Aufgaben schafft.</p>
                <button className="btn-primary" onClick={joinGame}>Karte holen</button>
              </>
            ) : (
              <p className="text-muted">Mit Twitch einloggen, um eine eigene Karte zu bekommen.</p>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {isAdmin && running ? (
          <section className="panel">
            <h2 className="mb-3 font-display text-2xl">Aufgaben abhaken</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {game.task_ids.map(Number).map((id) => (
                <button
                  key={id}
                  onClick={() => toggleMark(id)}
                  className={clsx(
                    "rounded-lg border px-3 py-2 text-left text-sm font-semibold transition",
                    marks.has(id) ? "border-win bg-win/20" : "border-line bg-bg/40 hover:border-accent",
                  )}
                >
                  {marks.has(id) ? "✅ " : "⬜ "}
                  {taskText.get(id)}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <div />
        )}
        <div className="flex flex-col gap-6">
          <section className="panel h-fit">
            <h2 className="mb-3 font-display text-2xl">Punkte-Rangliste</h2>
            <RankingList entries={ranked} me={userId} />
          </section>
          {isAdmin && (
            <section className="panel flex flex-col gap-3">
              <h2 className="font-display text-xl">OBS-Overlays</h2>
              <p className="text-sm text-muted">
                Als <b>Browserquelle</b> einfügen, Hintergrund ist transparent. Die Links bleiben gleich und zeigen immer die neueste Runde.
              </p>
              <OverlayLink label="Karte (z. B. 600 × 680)" url={`${origin}/overlay/bingo/karte`} />
              <OverlayLink label="Rangliste (z. B. 460 × 700)" url={`${origin}/overlay/bingo/rangliste`} />
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function OverlayLink({ label, url }: { label: string; url: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="flex gap-2">
        <input readOnly value={url} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
        <CopyButton text={url} />
      </div>
    </div>
  )
}
