"use client"

import { useMemo } from "react"
import { BingoGrid } from "@/components/bingo/bingo-grid"
import { RankingList } from "@/components/bingo/ranking-list"
import { useBingo } from "@/components/bingo/use-bingo"
import { ranking, streamerCard, type BingoState } from "@/lib/bingo-live"

// OBS-Overlays: häufiger nachladen, falls Realtime in der Browserquelle hängt
const POLL_MS = 3000

export function CardOverlay({ initial }: { initial: BingoState }) {
  const { state } = useBingo(initial, POLL_MS)
  const marks = useMemo(() => new Set(state.marks), [state.marks])
  const taskText = useMemo(() => new Map(state.tasks.map((t) => [Number(t.id), t.text])), [state.tasks])
  if (!state.game) return <Waiting />
  return (
    <div className="p-2">
      <BingoGrid title="BINGO" ids={streamerCard(state.game)} marks={marks} taskText={taskText} overlay />
    </div>
  )
}

export function RankingOverlay({ initial }: { initial: BingoState }) {
  const { state } = useBingo(initial, POLL_MS)
  const marks = useMemo(() => new Set(state.marks), [state.marks])
  const ranked = useMemo(() => ranking(state, marks), [state, marks])
  if (!state.game) return <Waiting />
  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="rounded-2xl bg-black/70 px-3 py-2 font-display text-3xl text-accent">BINGO-PUNKTE</div>
      <RankingList entries={ranked} overlay />
    </div>
  )
}

function Waiting() {
  return <div className="m-2 rounded-2xl bg-black/70 p-3 font-display text-2xl text-white">Bingo startet gleich…</div>
}
