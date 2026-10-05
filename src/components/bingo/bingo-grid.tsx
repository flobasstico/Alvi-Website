"use client"

import clsx from "clsx"
import { useEffect, useRef } from "react"
import { BINGO_LINES, bingoScore, completedLines, markedCells } from "@/lib/bingo"
import { celebrate } from "@/lib/confetti"

/** 3×3-Karte mit abgehakten Feldern, fertigen Linien und Punktestand */
export function BingoGrid({
  ids,
  marks,
  taskText,
  title,
  highlight,
  overlay,
}: {
  ids: number[]
  marks: ReadonlySet<number>
  taskText: Map<number, string>
  title: string
  highlight?: boolean
  overlay?: boolean
}) {
  const cells = markedCells(ids, marks)
  const lines = new Set(completedLines(cells).flatMap((i) => BINGO_LINES[i]))
  const score = bingoScore(cells)
  const lastBingos = useRef(score.bingos)

  // Konfetti bei jedem neuen Bingo
  useEffect(() => {
    if (score.bingos > lastBingos.current) celebrate()
    lastBingos.current = score.bingos
  }, [score.bingos])

  return (
    <section className={clsx(overlay ? "rounded-2xl bg-black/70 p-3 shadow-2xl" : "panel", highlight && !overlay && "border-accent/60")}>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className={clsx("font-display", overlay ? "text-3xl text-accent" : "text-2xl")}>{title}</h3>
        <span className="ml-auto font-display text-3xl text-accent tabular-nums">{score.points} P</span>
        <span className="w-full text-right text-xs text-muted">
          {score.fields} {score.fields === 1 ? "Feld" : "Felder"} · {score.bingos} {score.bingos === 1 ? "Bingo" : "Bingos"}
          {score.full && " · VOLLE KARTE!"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {ids.map((id, i) => (
          <div
            key={i}
            className={clsx(
              "flex aspect-square items-center justify-center rounded-xl border-2 p-2 text-center font-bold leading-tight transition",
              overlay ? "text-[clamp(10px,4.2vw,22px)]" : "text-sm sm:text-base",
              lines.has(i) ? "border-accent bg-accent text-black" : cells[i] ? "border-win bg-win/40 text-white" : "border-line bg-bg/80 text-white",
            )}
          >
            {cells[i] && !lines.has(i) && <span className="mr-1">✅</span>}
            {taskText.get(id) ?? "?"}
          </div>
        ))}
      </div>
    </section>
  )
}
