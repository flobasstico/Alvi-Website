import { notFound } from "next/navigation"
import { isMinigame } from "@/lib/minigames"
import { MinigameOverlay } from "./overlay"

export const metadata = { title: "Minispiel-Highscore (Overlay)" }

export default async function Page({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params
  if (!isMinigame(game)) notFound()
  return (
    <>
      {/* Transparenter Hintergrund für OBS */}
      <style>{`html, body { background: transparent !important; min-height: 0; }`}</style>
      <MinigameOverlay game={game} />
    </>
  )
}
