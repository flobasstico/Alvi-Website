import { liveSince, liveStream } from "@/lib/twitch-live"

/** „Alvi ist live“ – nur sichtbar, wenn der Stream läuft; Klick öffnet den Stream auf Twitch */
export async function LiveBanner({ login }: { login: string }) {
  const live = await liveStream(login)
  if (!live) return null
  return (
    <a
      href={`https://www.twitch.tv/${live.login}`}
      target="_blank"
      rel="noreferrer"
      className="group flex w-full min-w-0 max-w-lg items-center gap-3 lg:max-w-md rounded-2xl border-2 border-[#9146ff] bg-[#9146ff]/15 px-3 py-2 text-left shadow-[0_0_24px_rgba(145,70,255,.45)] transition hover:-translate-y-0.5 hover:bg-[#9146ff]/25"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {live.thumbnail && <img src={live.thumbnail} alt="" className="hidden h-12 w-[86px] shrink-0 rounded-lg object-cover sm:block" />}
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2 text-sm font-bold">
          <span className="flex items-center gap-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            Live
          </span>
          <span className="truncate">{live.name} ist jetzt live!</span>
        </span>
        <span className="truncate text-xs text-white/80">{live.title}</span>
        <span className="truncate text-xs text-muted">
          {live.game && `${live.game} · `}
          {live.viewers.toLocaleString("de-DE")} Zuschauer · {liveSince(live.startedAt)}
        </span>
      </span>
      <span className="ml-auto hidden shrink-0 text-sm font-bold text-[#c4a3ff] group-hover:text-white sm:inline">Zum Stream →</span>
    </a>
  )
}
