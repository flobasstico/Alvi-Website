"use client"

import { useWin } from "@/components/winchallenge/use-win"
import { WinBoard } from "@/components/winchallenge/win-board"
import type { WinState } from "@/lib/winchallenge"

export function WinOverlay({ initial, serverNow, follow }: { initial: WinState | null; serverNow: number; follow: boolean }) {
  const { state, now } = useWin(initial, serverNow, { follow, pollMs: 3000 })
  if (!state) return <div className="m-2 rounded-2xl bg-black/70 p-3 text-xl font-bold text-white">Winchallenge startet gleich…</div>
  return (
    <div className="p-2">
      <WinBoard state={state} now={now} />
    </div>
  )
}
