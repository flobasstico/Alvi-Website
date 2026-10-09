"use client"

import Link from "next/link"
import { useSyncExternalStore } from "react"
import { DEFAULT_GAME, gameBySlug } from "@/lib/games"
import { onModeChange, readMode } from "@/lib/lobby-mode"
import { GameThumb } from "../game-thumb"

/** Unten rechts in der Lobby: ausgewählter Modus mit „Modus wechseln“ und dem großen SPIELEN-Button */
export function SelectedMode({ thumbs, mapUrl }: { thumbs: Record<string, string>; mapUrl: string | null }) {
  const slug = useSyncExternalStore(onModeChange, readMode, () => DEFAULT_GAME)
  const game = gameBySlug(slug) ?? gameBySlug(DEFAULT_GAME)!
  return (
    <div className="flex flex-col gap-2">
      <Link
        href="/entdecken"
        className="group block overflow-hidden rounded-md border-2 border-white/20 bg-panel shadow-[0_10px_30px_#0007] hover:border-accent"
        title="Modus wechseln"
      >
        <div className="relative overflow-hidden">
          <GameThumb game={game} image={thumbs[game.slug]} mapUrl={mapUrl} className="transition duration-300 group-hover:scale-[1.03]" />
          <span className="absolute right-2 top-2 -skew-x-6 bg-black/70 px-2 py-0.5 font-display text-sm text-accent-2 group-hover:text-accent">Modus wechseln ›</span>
        </div>
        <div className="bg-gradient-to-b from-panel-2 to-panel px-3 py-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Ausgewählter Modus</div>
          <div className="font-display text-xl leading-tight">{game.title}</div>
        </div>
      </Link>
      <Link href={game.href} className="btn-primary w-full py-4 text-3xl tracking-widest">
        Spielen
      </Link>
    </div>
  )
}
