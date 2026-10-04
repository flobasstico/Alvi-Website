"use client"

import clsx from "clsx"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { BINGO_LINES, completedLines, FREE_INDEX, hasBingo, markedCells } from "@/lib/bingo"
import type { Tables } from "@/lib/database.types"
import { celebrate } from "@/lib/confetti"
import { sample } from "@/lib/random"
import { createClient } from "@/lib/supabase/client"
import { endBingo } from "./actions"

type Task = { id: number; text: string }

export function BingoBoard({
  game,
  tasks,
  initialMarks,
  myCard,
  winners,
  loggedIn,
  isAdmin,
}: {
  game: Tables<"bingo_games">
  tasks: Task[]
  initialMarks: number[]
  myCard: number[] | null
  winners: { name: string; at: string }[]
  loggedIn: boolean
  isAdmin: boolean
}) {
  const router = useRouter()
  const [supabase] = useState(createClient)
  const [marks, setMarks] = useState(() => new Set(initialMarks))
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const taskText = useMemo(() => new Map(tasks.map((t) => [t.id, t.text])), [tasks])
  const running = game.status === "laeuft"

  useEffect(() => setMarks(new Set(initialMarks)), [initialMarks])

  useEffect(() => {
    const channel = supabase
      .channel(`bingo-${game.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bingo_marks", filter: `game_id=eq.${game.id}` }, (p) =>
        setMarks((m) => new Set(m).add((p.new as { task_id: number }).task_id)),
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "bingo_marks" }, () => router.refresh())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bingo_cards", filter: `game_id=eq.${game.id}` }, () =>
        router.refresh(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "bingo_games" }, () => router.refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, router, game.id])

  async function toggleMark(taskId: number) {
    setError(null)
    const has = marks.has(taskId)
    setMarks((m) => {
      const n = new Set(m)
      if (has) n.delete(taskId)
      else n.add(taskId)
      return n
    })
    const { error } = has
      ? await supabase.from("bingo_marks").delete().eq("game_id", game.id).eq("task_id", taskId)
      : await supabase.from("bingo_marks").insert({ game_id: game.id, task_id: taskId })
    if (error) setError(error.message)
  }

  async function joinGame() {
    setError(null)
    const { error } = await supabase.from("bingo_cards").insert({ game_id: game.id, task_ids: sample(game.task_ids, 25) })
    if (error) setError(error.message)
    router.refresh()
  }

  const alviCard = game.task_ids.slice(0, 25)

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
              start(async () => {
                if (await endBingo(game.id)) celebrate()
              })
            }
          >
            Runde beenden & werten
          </button>
        )}
      </div>
      {error && <p className="text-sm text-fail">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Alvis Karte" ids={alviCard} marks={marks} taskText={taskText} highlight />
        {myCard ? (
          <Card title="Deine Karte" ids={myCard} marks={marks} taskText={taskText} />
        ) : (
          <div className="panel flex flex-col items-center justify-center gap-3 text-center">
            <div className="text-5xl">🎟️</div>
            {!running ? (
              <p className="text-muted">Diese Runde ist vorbei.</p>
            ) : loggedIn ? (
              <>
                <p className="text-muted">Hol dir eine zufällige Karte und spiel mit – wer zuerst Bingo hat, landet auf der Bestenliste.</p>
                <button className="btn-primary" onClick={joinGame}>Karte holen</button>
              </>
            ) : (
              <p className="text-muted">Mit Twitch einloggen, um eine eigene Karte zu bekommen.</p>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {isAdmin && running ? (
          <section className="panel">
            <h2 className="mb-3 font-display text-2xl">Aufgaben abhaken</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {game.task_ids.map((id) => (
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
        <section className="panel h-fit">
          <h2 className="mb-3 font-display text-2xl">Bingo-Bestenliste</h2>
          <ol className="flex flex-col gap-1">
            {winners.map((w, i) => (
              <li key={i} className="flex justify-between">
                <span>{i === 0 ? "🏆" : `${i + 1}.`} {w.name}</span>
                <span className="text-sm text-muted">{new Date(w.at).toLocaleTimeString("de-DE")}</span>
              </li>
            ))}
            {winners.length === 0 && <li className="text-muted">Noch niemand hat Bingo.</li>}
          </ol>
        </section>
      </div>
    </div>
  )
}

function Card({
  title,
  ids,
  marks,
  taskText,
  highlight,
}: {
  title: string
  ids: number[]
  marks: Set<number>
  taskText: Map<number, string>
  highlight?: boolean
}) {
  const cells = markedCells(ids, marks)
  const lines = new Set(completedLines(cells).flatMap((i) => BINGO_LINES[i]))
  const bingo = hasBingo(cells)
  const wasBingo = useRef(bingo)

  useEffect(() => {
    if (bingo && !wasBingo.current) celebrate()
    wasBingo.current = bingo
  }, [bingo])

  return (
    <section className={clsx("panel", highlight && "border-accent/60")}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-2xl">{title}</h3>
        {bingo && <span className="animate-bounce font-display text-3xl text-accent">BINGO!</span>}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {ids.map((id, i) => {
          const free = i === FREE_INDEX
          return (
            <div
              key={i}
              className={clsx(
                "flex aspect-square items-center justify-center rounded-lg border p-1 text-center text-[10px] font-bold leading-tight transition sm:text-xs",
                lines.has(i) ? "border-accent bg-accent text-black" : cells[i] ? "border-win bg-win/30" : "border-line bg-bg/50",
              )}
            >
              {free ? "⭐ FREI" : taskText.get(id)}
            </div>
          )
        })}
      </div>
    </section>
  )
}
