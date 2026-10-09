/* eslint-disable @next/next/no-img-element */
import clsx from "clsx"
import type { Game } from "@/lib/games"
import { BingoIcon, GoldBarsIcon, LeagueIcon, MapIcon, WheelIcon } from "./tile-icons"

const MOTIF = "h-[52%] w-auto drop-shadow-[0_6px_10px_rgba(0,0,0,.45)]"

/** Großes Motiv in der Mitte des Vorschaubilds (vorhandene Icons, sonst das Emoji) */
function Motif({ game, mapUrl }: { game: Game; mapUrl?: string | null }) {
  switch (game.slug) {
    case "rad":
      return <WheelIcon className={MOTIF} />
    case "bingo":
      return <BingoIcon className={MOTIF} />
    case "auktion":
      return <GoldBarsIcon className={MOTIF} />
    case "liga":
      return <LeagueIcon className={MOTIF} />
    case "drop":
      if (mapUrl) return <MapIcon url={mapUrl} className="aspect-square h-[58%] -rotate-3 shadow-2xl" />
  }
  return <span className="text-[clamp(2.5rem,9cqw,6rem)] leading-none drop-shadow-[0_6px_10px_rgba(0,0,0,.45)]">{game.emoji}</span>
}

/**
 * Vorschaubild eines Modus im Stil der Fortnite-Map-Bilder (16:9):
 * Himmel-Verlauf, Lichtstrahlen, Insel-Silhouette und großes Motiv – oder das im Admin hochgeladene Bild.
 */
export function GameThumb({
  game,
  image,
  mapUrl,
  showTitle = false,
  motifRight = false,
  className,
}: {
  game: Game
  image?: string | null
  mapUrl?: string | null
  showTitle?: boolean
  /** Motiv nach rechts rücken (Platz für Text links, z. B. im Feature-Banner) */
  motifRight?: boolean
  className?: string
}) {
  const [top, bottom] = game.sky
  return (
    <div className={clsx("relative aspect-video overflow-hidden bg-bg [container-type:inline-size]", className)}>
      {image ? (
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      ) : (
        <>
          <div className="absolute inset-0" style={{ background: `linear-gradient(170deg, ${top} 0%, ${bottom} 100%)` }} />
          {/* Lichtstrahlen von oben */}
          <div
            className="absolute -top-1/2 left-1/2 h-[200%] w-[200%] -translate-x-1/2 opacity-25"
            style={{ background: "repeating-conic-gradient(from 0deg at 50% 25%, #fff 0deg 6deg, transparent 6deg 18deg)" }}
          />
          <div className="absolute inset-0" style={{ background: "radial-gradient(60% 55% at 50% 30%, #ffffff55, transparent 70%)" }} />
          {/* Insel */}
          <svg viewBox="0 0 160 40" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[30%] w-full" aria-hidden>
            <path d="M0 26 C 25 12, 45 22, 70 16 S 120 6, 160 20 V40 H0 Z" fill="#000" opacity=".25" />
            <path d="M0 32 C 30 20, 55 30, 85 24 S 135 18, 160 28 V40 H0 Z" fill="#000" opacity=".35" />
          </svg>
          <div className={clsx("absolute inset-0 flex items-center pb-[6%]", motifRight ? "justify-end pr-[12%]" : "justify-center")}>
            <Motif game={game} mapUrl={mapUrl} />
          </div>
        </>
      )}
      {showTitle && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2 pt-8">
          <div className="font-display text-[clamp(1rem,6.5cqw,2.25rem)] leading-none text-white drop-shadow-[0_2px_0_#000]">{game.title}</div>
        </div>
      )}
    </div>
  )
}
