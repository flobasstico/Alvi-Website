"use client"

import { ScoreBoard } from "@/components/olympiade/score-board"
import { useOlympic } from "@/components/olympiade/use-olympic"
import type { OlympicState } from "@/lib/olympiade"

export function OlympicOverlay({ initial, follow }: { initial: OlympicState | null; follow: boolean }) {
  const { state } = useOlympic(initial, { follow, pollMs: 3000 })
  if (!state) return <div className="m-2 rounded-2xl bg-black/70 p-3 font-display text-2xl text-white">Olympiade startet gleich…</div>
  return (
    <div className="max-w-[460px] p-2">
      <ScoreBoard state={state} overlay />
    </div>
  )
}
