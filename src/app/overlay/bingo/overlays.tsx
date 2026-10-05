"use client"

import { useMemo } from "react"
import { BingoGrid } from "@/components/bingo/bingo-grid"
import { RankingList } from "@/components/bingo/ranking-list"
import { useBingoRound } from "@/components/bingo/use-bingo"
import { featuredPlayer, ranking, type BingoState } from "@/lib/bingo-live"

// OBS-Overlays folgen der neuesten offiziellen Runde und laden häufiger nach
const OPTS = { follow: true, pollMs: 3000 }

export function CardOverlay({ initial }: { initial: BingoState | null }) {
  const { state } = useBingoRound(initial, OPTS)
  const player = state ? featuredPlayer(state) : null
  if (!state || !player) return <Waiting />
  return (
    <div className="p-2">
      <BingoGrid title={`BINGO · ${player.display_name ?? ""}`} tasks={state.round.tasks} marks={player.marks} overlay />
    </div>
  )
}

export function RankingOverlay({ initial }: { initial: BingoState | null }) {
  const { state } = useBingoRound(initial, OPTS)
  const ranked = useMemo(() => (state ? ranking(state) : []), [state])
  if (!state) return <Waiting />
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
