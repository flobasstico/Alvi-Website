"use client"

import clsx from "clsx"
import { useEffect, useRef } from "react"
import { BINGO_LINES, bingoScore, completedLines } from "@/lib/bingo"
import { celebrate } from "@/lib/confetti"

/** 3×3-Karte mit Häkchen, fertigen Linien und Punktestand. Mit onToggle sind die Felder anklickbar. */
export function BingoGrid({
  tasks,
  marks,
  title,
  onToggle,
  highlight,
  overlay,
  compact,
}: {
  tasks: string[]
  marks: boolean[]
  title: string
  onToggle?: (index: number) => void
  highlight?: boolean
  overlay?: boolean
  compact?: boolean
}) {
  const cells = tasks.map((_, i) => !!marks[i])
  const lines = new Set(completedLines(cells).flatMap((i) => BINGO_LINES[i]))
  const score = bingoScore(cells)
  const lastBingos = useRef(score.bingos)

  // Konfetti bei jedem neuen Bingo
  useEffect(() => {
    if (score.bingos > lastBingos.current && !compact) celebrate()
    lastBingos.current = score.bingos
  }, [score.bingos, compact])

  return (
    <section className={clsx(overlay ? "rounded-2xl bg-black/70 p-3 shadow-2xl" : "panel", highlight && !overlay && "border-accent/60", compact && "p-3")}>
      <div className={clsx("flex flex-wrap items-center gap-x-3 gap-y-1", compact ? "mb-2" : "mb-3")}>
        <h3 className={clsx("min-w-0 truncate font-display", overlay ? "text-3xl text-accent" : compact ? "text-lg" : "text-2xl")}>{title}</h3>
        <span className={clsx("ml-auto font-display text-accent tabular-nums", compact ? "text-xl" : "text-3xl")}>{score.points} P</span>
        {!compact && (
          <span className="w-full text-right text-xs text-muted">
            {score.fields} {score.fields === 1 ? "Feld" : "Felder"} · {score.bingos} {score.bingos === 1 ? "Bingo" : "Bingos"}
            {score.full && " · VOLLE KARTE!"}
          </span>
        )}
      </div>
      <div className={clsx("grid grid-cols-3", compact ? "gap-1" : "gap-2")}>
        {tasks.map((task, i) => {
          const Cell = onToggle ? "button" : "div"
          return (
            <Cell
              key={i}
              {...(onToggle ? { type: "button" as const, onClick: () => onToggle(i), "aria-pressed": cells[i] } : {})}
              className={clsx(
                "flex aspect-square items-center justify-center rounded-xl border-2 text-center font-bold leading-tight transition",
                overlay ? "p-2 text-[clamp(10px,4.2vw,22px)]" : compact ? "p-1 text-[10px]" : "p-2 text-sm sm:text-base",
                onToggle && "cursor-pointer hover:border-accent active:scale-95",
                lines.has(i) ? "border-accent bg-accent text-black" : cells[i] ? "border-win bg-win/40 text-white" : "border-line bg-bg/80 text-white",
              )}
            >
              {cells[i] && !lines.has(i) && !compact && <span className="mr-1">✅</span>}
              {task}
            </Cell>
          )
        })}
      </div>
    </section>
  )
}
