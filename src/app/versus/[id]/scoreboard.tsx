"use client"

import clsx from "clsx"
import Link from "next/link"
import { useEffect, useState, useTransition } from "react"
import type { Database, Tables } from "@/lib/database.types"
import { celebrate } from "@/lib/confetti"
import { createClient } from "@/lib/supabase/client"
import { formatClock, remainingSeconds, resumeStartedAt } from "@/lib/timer"
import { finishMatch } from "../actions"

type Match = Tables<"versus_matches">
type Item = Tables<"versus_checklist">
type MatchPatch = Database["public"]["Tables"]["versus_matches"]["Update"]

export function Scoreboard({
  initialMatch,
  initialChecklist,
  isAdmin,
}: {
  initialMatch: Match
  initialChecklist: Item[]
  isAdmin: boolean
}) {
  const [supabase] = useState(createClient)
  const [match, setMatch] = useState(initialMatch)
  const [items, setItems] = useState(initialChecklist)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel(`versus-${match.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "versus_matches", filter: `id=eq.${match.id}` },
        (p) => setMatch(p.new as Match),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "versus_checklist", filter: `match_id=eq.${match.id}` },
        (p) => {
          if (p.eventType === "DELETE") setItems((cur) => cur.filter((i) => i.id !== (p.old as Item).id))
          else
            setItems((cur) => {
              const n = p.new as Item
              const rest = cur.filter((i) => i.id !== n.id)
              return [...rest, n].sort((a, b) => a.position - b.position)
            })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, match.id])

  const remaining = remainingSeconds(match, now)

  async function update(patch: MatchPatch) {
    setError(null)
    setMatch((m) => ({ ...m, ...patch }))
    const { error } = await supabase.from("versus_matches").update(patch).eq("id", match.id)
    if (error) setError(error.message)
  }

  async function toggle(item: Item, side: "alvi_done" | "opponent_done") {
    const patch = side === "alvi_done" ? { alvi_done: !item.alvi_done } : { opponent_done: !item.opponent_done }
    setItems((cur) => cur.map((i) => (i.id === item.id ? { ...i, ...patch } : i)))
    const { error } = await supabase.from("versus_checklist").update(patch).eq("id", item.id)
    if (error) setError(error.message)
  }

  const startTimer = () =>
    update({ status: "laeuft", started_at: resumeStartedAt(match, remainingSeconds(match)), paused_remaining_s: null })
  const pauseTimer = () => update({ status: "pausiert", paused_remaining_s: remainingSeconds(match) })
  const resetTimer = () => update({ status: "bereit", started_at: null, paused_remaining_s: null })

  const finished = match.status === "beendet"
  const alviDone = items.filter((i) => i.alvi_done).length
  const oppDone = items.filter((i) => i.opponent_done).length

  return (
    <div className="flex flex-col gap-6">
      <Link href="/versus" className="text-sm text-muted hover:text-white">← Alle Duelle</Link>

      <section className="panel text-center">
        {match.title && <div className="mb-2 text-lg font-semibold text-muted">{match.title}</div>}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <Side name="Alvi" score={match.score_alvi} color="text-accent" leading={match.score_alvi > match.score_opponent}>
            {isAdmin && !finished && (
              <ScoreButtons onChange={(d) => update({ score_alvi: Math.max(0, match.score_alvi + d) })} />
            )}
          </Side>
          <div className="flex flex-col items-center gap-2">
            <div
              className={clsx(
                "font-display text-5xl tabular-nums sm:text-7xl",
                remaining <= 60 && match.status === "laeuft" ? "animate-pulse text-fail" : "text-white",
              )}
            >
              {formatClock(remaining)}
            </div>
            <div className="text-xs uppercase tracking-widest text-muted">
              {{ bereit: "Bereit", laeuft: "Läuft", pausiert: "Pausiert", beendet: "Beendet" }[match.status]}
            </div>
          </div>
          <Side name={match.opponent_name} score={match.score_opponent} color="text-accent-2" leading={match.score_opponent > match.score_alvi}>
            {isAdmin && !finished && (
              <ScoreButtons onChange={(d) => update({ score_opponent: Math.max(0, match.score_opponent + d) })} />
            )}
          </Side>
        </div>

        {isAdmin && !finished && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {match.status !== "laeuft" ? (
              <button className="btn-primary" onClick={startTimer} disabled={remaining === 0}>
                {match.status === "pausiert" ? "Fortsetzen" : "Timer starten"}
              </button>
            ) : (
              <button className="btn-secondary" onClick={pauseTimer}>Pause</button>
            )}
            <button className="btn-secondary" onClick={resetTimer}>Timer zurücksetzen</button>
            <button
              className="btn-win"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await finishMatch(match.id, true, remaining)
                  celebrate()
                })
              }
            >
              Alvi gewinnt
            </button>
            <button className="btn-danger" disabled={pending} onClick={() => start(() => finishMatch(match.id, false, remaining))}>
              Alvi verliert
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-fail">{error}</p>}
      </section>

      {items.length > 0 && (
        <section className="panel">
          <h2 className="mb-3 font-display text-2xl">Checkliste</h2>
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-2">
            <div />
            <div className="text-center text-sm font-bold text-accent">Alvi ({alviDone}/{items.length})</div>
            <div className="text-center text-sm font-bold text-accent-2">
              {match.opponent_name} ({oppDone}/{items.length})
            </div>
            {items.map((item) => (
              <div key={item.id} className="contents">
                <div className="font-semibold">{item.text}</div>
                <Check done={item.alvi_done} disabled={!isAdmin || finished} onClick={() => toggle(item, "alvi_done")} />
                <Check done={item.opponent_done} disabled={!isAdmin || finished} onClick={() => toggle(item, "opponent_done")} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Side({ name, score, color, leading, children }: { name: string; score: number; color: string; leading: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="max-w-full truncate text-xl font-bold sm:text-2xl">{leading && "👑 "}{name}</div>
      <div className={clsx("font-display text-7xl tabular-nums sm:text-9xl", color)}>{score}</div>
      {children}
    </div>
  )
}

function ScoreButtons({ onChange }: { onChange: (delta: number) => void }) {
  return (
    <div className="flex gap-2">
      <button className="btn-secondary w-12" onClick={() => onChange(-1)}>−</button>
      <button className="btn-primary w-12" onClick={() => onChange(1)}>+</button>
    </div>
  )
}

function Check({ done, disabled, onClick }: { done: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "mx-auto flex h-9 w-9 items-center justify-center rounded-lg border-2 text-lg font-black transition disabled:cursor-default",
        done ? "border-win bg-win text-black" : "border-line bg-bg/40",
      )}
    >
      {done ? "✓" : ""}
    </button>
  )
}
