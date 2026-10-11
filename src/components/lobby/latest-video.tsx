import Image from "next/image"
import { PlatformIcon } from "@/components/channel-icons"
import { latestVideo, timeAgo } from "@/lib/youtube"

/**
 * Lobby: Alvis neuestes YouTube-Video (aus dem öffentlichen Kanal-Feed, alle 30 Minuten aktualisiert).
 * Das Vorschaubild läuft über die Bildoptimierung des eigenen Servers – Besucher laden nichts von YouTube,
 * erst der Klick öffnet das Video in einem neuen Tab. Ohne Video (Fehler, kein Kanal) bleibt der Kasten weg.
 */
export async function LatestVideo({ channelUrl }: { channelUrl: string | null }) {
  const video = channelUrl ? await latestVideo(channelUrl) : null
  if (!video) return null
  const fresh = Date.now() - Date.parse(video.published) < 48 * 3600 * 1000
  return (
    <a href={video.url} target="_blank" rel="noreferrer" className="panel group flex flex-col gap-2 p-3 hover:border-accent" title={`„${video.title}“ auf YouTube ansehen`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-xl">
          <PlatformIcon platform="link_youtube" className="h-6 w-6" /> Neuestes Video
        </h2>
        {fresh && <span className="-skew-x-6 bg-accent px-1.5 py-0.5 font-display text-xs text-black">Neu</span>}
      </div>
      <div className="relative aspect-video overflow-hidden rounded-sm bg-black">
        <Image
          src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
          alt=""
          fill
          sizes="(min-width: 1024px) 300px, 100vw"
          className="object-cover transition duration-300 group-hover:scale-105"
        />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-12 w-16 items-center justify-center rounded-xl bg-[#ff0033] text-2xl text-white shadow-lg transition group-hover:scale-110">▶</span>
        </span>
      </div>
      <div>
        <div className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-accent">{video.title}</div>
        <div className="text-xs text-muted">{timeAgo(video.published)}</div>
      </div>
    </a>
  )
}

/** Platzhalter in gleicher Größe, solange der Feed lädt */
export function LatestVideoSkeleton() {
  return (
    <div className="panel flex flex-col gap-2 p-3" aria-hidden>
      <div className="h-6 w-40 animate-pulse bg-white/10" />
      <div className="aspect-video animate-pulse rounded-sm bg-black/30" />
      <div className="h-9 animate-pulse bg-white/10" />
    </div>
  )
}
