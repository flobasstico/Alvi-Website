"use client"

import clsx from "clsx"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { DEFAULT_GAME, GAMES, gameBySlug, type Game } from "@/lib/games"
import { onModeChange, readMode, saveMode } from "@/lib/lobby-mode"
import { GameThumb } from "../game-thumb"

const ROWS: { title: string; filter: (g: Game) => boolean }[] = [
  { title: "Alvis Challenges", filter: (g) => g.category === "challenge" },
  { title: "Mit Freunden spielen", filter: (g) => g.multiplayer },
  { title: "Minispiele", filter: (g) => g.category === "minispiel" },
  { title: "Community & Stats", filter: (g) => g.category === "community" },
]

/** Entdecken wie in Fortnite: großes Feature-Banner, darunter wischbare Reihen; Klick öffnet die Modus-Info */
export function DiscoverRows({
  thumbs,
  mapUrl,
  featured,
  running,
}: {
  thumbs: Record<string, string>
  mapUrl: string | null
  featured: string
  running: string | null
}) {
  const [open, setOpen] = useState<Game | null>(null)
  const selected = useSyncExternalStore(onModeChange, readMode, () => DEFAULT_GAME)
  const feature = gameBySlug(featured)!

  return (
    <>
      {/* Feature-Banner */}
      <section className="relative mb-8 overflow-hidden rounded-md border-2 border-white/15 shadow-[0_10px_40px_#0008]">
        <GameThumb game={feature} image={thumbs[feature.slug]} mapUrl={mapUrl} motifRight className="aspect-[16/9] sm:aspect-[21/8]" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        <div className="absolute inset-y-0 left-0 flex max-w-lg flex-col justify-end gap-2 p-4 sm:justify-center sm:p-8">
          <span className="w-fit -skew-x-6 bg-accent px-2 py-0.5 font-display text-xs text-black sm:text-sm">Im Rampenlicht</span>
          <h2 className="font-display text-3xl leading-none drop-shadow-[0_3px_0_#000] sm:text-6xl">{feature.title}</h2>
          <p className="hidden text-sm text-white/85 sm:block">{feature.text}</p>
          {running && <p className="text-xs font-semibold text-accent sm:text-sm">▶ Läuft gerade: {running}</p>}
          <div className="mt-1 flex flex-wrap gap-2">
            <Link href={feature.href} className="btn-primary px-5 text-lg">
              Spielen
            </Link>
            <button type="button" className="btn-secondary px-4" onClick={() => setOpen(feature)}>
              Infos
            </button>
          </div>
        </div>
      </section>

      {ROWS.map((row) => (
        <Row key={row.title} title={row.title} games={GAMES.filter(row.filter)} thumbs={thumbs} mapUrl={mapUrl} selected={selected} onOpen={setOpen} />
      ))}

      {open && <ModeInfo game={open} image={thumbs[open.slug]} mapUrl={mapUrl} selected={selected === open.slug} onClose={() => setOpen(null)} />}
    </>
  )
}

function Row({
  title,
  games,
  thumbs,
  mapUrl,
  selected,
  onOpen,
}: {
  title: string
  games: Game[]
  thumbs: Record<string, string>
  mapUrl: string | null
  selected: string
  onOpen: (g: Game) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" })
  return (
    <section className="mb-8">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-2xl drop-shadow-[0_2px_0_#0008]">{title}</h2>
        <div className="hidden gap-1 sm:flex">
          <button type="button" onClick={() => scroll(-1)} className="btn-secondary h-8 w-10 px-0" aria-label={`${title} zurück`}>
            ‹
          </button>
          <button type="button" onClick={() => scroll(1)} className="btn-secondary h-8 w-10 px-0" aria-label={`${title} weiter`}>
            ›
          </button>
        </div>
      </div>
      <div ref={ref} className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-3 [scrollbar-width:none]">
        {games.map((g) => (
          <button
            key={g.slug}
            type="button"
            onClick={() => onOpen(g)}
            className="group w-[72%] shrink-0 snap-start text-left sm:w-[300px]"
          >
            <div
              className={clsx(
                "relative overflow-hidden rounded-md border-[3px] shadow-lg transition group-hover:border-accent",
                selected === g.slug ? "border-accent" : "border-white/15",
              )}
            >
              <GameThumb game={g} image={thumbs[g.slug]} mapUrl={mapUrl} className="transition duration-300 group-hover:scale-105" />
              {selected === g.slug && (
                <span className="absolute left-2 top-2 -skew-x-6 bg-accent px-1.5 py-0.5 font-display text-[11px] text-black">Ausgewählt</span>
              )}
              {g.players && <span className="absolute bottom-2 right-2 rounded-sm bg-black/70 px-1.5 py-0.5 text-xs font-semibold">👥 {g.players}</span>}
            </div>
            <div className="mt-1.5 truncate font-display text-lg leading-tight group-hover:text-accent">{g.title}</div>
          </button>
        ))}
      </div>
    </section>
  )
}

/** Modus-Info wie die Map-Infos bei Fortnite: Beschreibung, Spielerzahl, SPIELEN oder in der Lobby auswählen */
function ModeInfo({
  game,
  image,
  mapUrl,
  selected,
  onClose,
}: {
  game: Game
  image?: string
  mapUrl: string | null
  selected: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const box = useRef<HTMLDivElement>(null)
  const play = useRef<HTMLAnchorElement>(null)
  const close = useRef(onClose)
  close.current = onClose

  // Fokus ins Fenster (auf SPIELEN), Tab bleibt im Fenster, Seite dahinter scrollt nicht; beim Schließen Fokus zurück zur Karte
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    play.current?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close.current()
      if (e.key !== "Tab" || !box.current) return
      const items = [...box.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")]
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener("keydown", key)
    return () => {
      document.removeEventListener("keydown", key)
      document.body.style.overflow = overflow
      trigger?.focus?.()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={game.title}
        className="w-full max-w-xl overflow-hidden rounded-t-xl border-2 border-white/20 bg-gradient-to-b from-panel-2 to-bg shadow-2xl sm:rounded-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <GameThumb game={game} image={image} mapUrl={mapUrl} showTitle />
          <button type="button" onClick={onClose} className="absolute right-2 top-2 h-9 w-9 rounded-sm bg-black/60 text-lg hover:bg-black/80" aria-label="Schließen">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap gap-2">
            {game.players && <span className="chip">👥 {game.players} Spieler</span>}
            {game.multiplayer && <span className="chip">Mit Freunden</span>}
            {selected && <span className="chip border-accent text-accent">In der Lobby ausgewählt</span>}
          </div>
          <p className="text-sm text-white/85">{game.text}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link ref={play} href={game.href} className="btn-primary py-3 text-xl">
              Spielen
            </Link>
            <button
              type="button"
              className="btn-secondary py-3"
              onClick={() => {
                saveMode(game.slug)
                router.push("/")
              }}
            >
              In Lobby auswählen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
