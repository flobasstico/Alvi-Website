import clsx from "clsx"
import Image from "next/image"
import Link from "next/link"
import type { Creator, LeagueVideo } from "@/lib/league"
import { selectAll } from "@/lib/supabase/select-all"
import type { getViewer } from "@/lib/supabase/server"
import { matchesKeywords, parseKeywords, videoIdFromUrl } from "@/lib/youtube"
import { hasYoutubeKey } from "@/lib/youtube-sync"
import { saveLeagueKeywords, setChannelVideoHidden } from "./actions"
import { SyncButton } from "./sync-button"

type Supabase = Awaited<ReturnType<typeof getViewer>>["supabase"]
export type VideoFilter = {
  status: "offen" | "eingepflegt" | "ausgeblendet" | "alle"
  kanal: number | null
  ohne: boolean
  mehr: number
  /** Zeitraum (Upload-Datum, Berliner Zeit), jeweils YYYY-MM-DD, „bis“ einschließlich */
  von: string | null
  bis: string | null
}
const DATE = /^\d{4}-\d{2}-\d{2}$/

const STATUS = [
  { key: "offen", label: "Offen" },
  { key: "eingepflegt", label: "Eingepflegt" },
  { key: "ausgeblendet", label: "Ausgeblendet" },
  { key: "alle", label: "Alle" },
] as const

export function parseVideoFilter(p: { vstatus?: string; vkanal?: string; vohne?: string; vmehr?: string; vvon?: string; vbis?: string }): VideoFilter {
  return {
    status: STATUS.some((s) => s.key === p.vstatus) ? (p.vstatus as VideoFilter["status"]) : "offen",
    kanal: Number(p.vkanal) || null,
    ohne: p.vohne === "1",
    mehr: Math.min(20, Math.max(1, Number(p.vmehr) || 1)),
    von: p.vvon && DATE.test(p.vvon) ? p.vvon : null,
    bis: p.vbis && DATE.test(p.vbis) ? p.vbis : null,
  }
}

/**
 * Admin, Creator-Liga: Videos aus den Creator-Kanälen (per Abgleich gespeichert), gefiltert nach Stichwörtern.
 * Markiert, ob ein Video schon in der Liga steht; „Eintragen“ füllt das Formular oben vor.
 */
export async function ChannelVideos({
  supabase,
  creators,
  leagueVideos,
  keywordsValue,
  filter,
}: {
  supabase: Supabase
  creators: Creator[]
  leagueVideos: LeagueVideo[]
  keywordsValue: string | undefined
  filter: VideoFilter
}) {
  const [{ data: videos }, { data: syncs }] = await Promise.all([
    selectAll((a, b) => supabase.from("channel_videos").select("*").eq("is_short", false).order("published_at", { ascending: false }).order("video_id").range(a, b)),
    supabase.from("channel_sync").select("*"),
  ])
  const keywords = parseKeywords(keywordsValue)
  const nameOf = new Map(creators.map((c) => [c.id, c.name]))
  // Video-ID → Challenge, in der es schon steckt
  const inLeague = new Map<string, number>()
  for (const v of leagueVideos) {
    const id = videoIdFromUrl(v.url)
    if (id) inLeague.set(id, v.challenge_id)
  }

  // Upload-Tag in Berliner Zeit (YYYY-MM-DD) – Zeitraum gilt für Liste und Zähler
  const berlinDay = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })
  const candidates = videos
    .filter((v) => filter.ohne || matchesKeywords(v.title, keywords))
    .filter((v) => (!filter.von || berlinDay(v.published_at) >= filter.von) && (!filter.bis || berlinDay(v.published_at) <= filter.bis))
  const counts = {
    offen: candidates.filter((v) => !v.hidden && !inLeague.has(v.video_id)).length,
    eingepflegt: candidates.filter((v) => inLeague.has(v.video_id)).length,
    ausgeblendet: candidates.filter((v) => v.hidden && !inLeague.has(v.video_id)).length,
    alle: candidates.length,
  }
  const shown = candidates
    .filter((v) => !filter.kanal || v.creator_id === filter.kanal)
    .filter((v) =>
      filter.status === "offen"
        ? !v.hidden && !inLeague.has(v.video_id)
        : filter.status === "eingepflegt"
          ? inLeague.has(v.video_id)
          : filter.status === "ausgeblendet"
            ? v.hidden && !inLeague.has(v.video_id)
            : true,
    )
  const limit = filter.mehr * 50
  const lastSync = (syncs ?? []).map((s) => s.synced_at).filter(Boolean).sort().pop()
  const errors = (syncs ?? []).filter((s) => s.error)

  const href = (patch: Partial<VideoFilter>) => {
    const f = { ...filter, ...patch }
    const q = new URLSearchParams({ tab: "liga" })
    if (f.status !== "offen") q.set("vstatus", f.status)
    if (f.kanal) q.set("vkanal", String(f.kanal))
    if (f.ohne) q.set("vohne", "1")
    if (f.mehr > 1) q.set("vmehr", String(f.mehr))
    if (f.von) q.set("vvon", f.von)
    if (f.bis) q.set("vbis", f.bis)
    return `/admin?${q}#kanal-videos`
  }
  const day = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" })
  const dayOf = (d: string) => day(d + "T12:00:00Z")

  return (
    <section id="kanal-videos" className="panel lg:col-start-1">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl">Videos aus den Kanälen</h2>
        <span className="chip border-accent text-accent">{counts.offen} offen</span>
      </div>
      <p className="mb-3 text-sm text-muted">
        Challenge-Videos aller Creator-Kanäle (ohne Shorts). Erkannt über Stichwörter im Titel – unpassende einfach ausblenden.
        {lastSync && ` Letzter Abgleich: ${new Date(lastSync).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })}.`}
      </p>

      {!hasYoutubeKey() && (
        <p className="mb-3 rounded-md border border-accent/60 bg-accent/10 px-3 py-2 text-sm">
          ⚠️ Kein YouTube-API-Schlüssel eingerichtet – es werden nur die 15 neuesten Videos je Kanal gefunden. Für alle Videos in Vercel die Variable{" "}
          <code className="font-mono">YOUTUBE_API_KEY</code> setzen (Anleitung in der README).
        </p>
      )}
      {errors.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1 text-sm text-fail">
          {errors.map((e) => (
            <li key={e.creator_id}>
              ⚠️ {nameOf.get(e.creator_id) ?? "Kanal"}: {e.error}
            </li>
          ))}
        </ul>
      )}

      <div className="mb-4 flex flex-col gap-3">
        <SyncButton />
        <form action={saveLeagueKeywords} className="flex flex-wrap items-center gap-2">
          <label htmlFor="liga-keywords" className="text-sm text-muted">
            Stichwörter:
          </label>
          <input
            id="liga-keywords"
            name="keywords"
            defaultValue={keywords.join(", ")}
            className="input min-w-0 flex-1 py-1.5 text-sm"
            placeholder="Challenge, Wer zuerst, aber nur"
            maxLength={500}
          />
          <button className="btn-secondary px-3 py-1.5 text-sm">Speichern</button>
        </form>
      </div>

      {/* Zeitraum: nur Videos mit Upload-Datum in diesem Bereich (alle anderen Filter bleiben erhalten) */}
      <form action="/admin#kanal-videos" className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <input type="hidden" name="tab" value="liga" />
        {filter.status !== "offen" && <input type="hidden" name="vstatus" value={filter.status} />}
        {filter.kanal && <input type="hidden" name="vkanal" value={filter.kanal} />}
        {filter.ohne && <input type="hidden" name="vohne" value="1" />}
        <span className="text-muted">Zeitraum:</span>
        <label className="flex items-center gap-1">
          von
          <input type="date" name="vvon" defaultValue={filter.von ?? ""} className="input w-auto py-1 text-sm" />
        </label>
        <label className="flex items-center gap-1">
          bis
          <input type="date" name="vbis" defaultValue={filter.bis ?? ""} className="input w-auto py-1 text-sm" />
        </label>
        <button className="btn-secondary px-3 py-1 text-sm">Anwenden</button>
        {(filter.von || filter.bis) && (
          <Link href={href({ von: null, bis: null, mehr: 1 })} className="chip border-accent-2 text-accent-2" title="Zeitraum entfernen">
            {filter.von ? dayOf(filter.von) : "Anfang"} – {filter.bis ? dayOf(filter.bis) : "heute"} ✕
          </Link>
        )}
      </form>

      <div className="mb-3 flex flex-wrap gap-1.5 text-sm">
        {STATUS.map((s) => (
          <Link key={s.key} href={href({ status: s.key, mehr: 1 })} className={clsx("chip", filter.status === s.key && "border-accent bg-accent/15 text-accent")}>
            {s.label} ({counts[s.key]})
          </Link>
        ))}
        <span className="mx-1 text-line">|</span>
        <Link href={href({ kanal: null, mehr: 1 })} className={clsx("chip", !filter.kanal && "border-accent-2 text-accent-2")}>
          Alle Kanäle
        </Link>
        {creators
          .filter((c) => c.youtube_url)
          .map((c) => (
            <Link key={c.id} href={href({ kanal: c.id, mehr: 1 })} className={clsx("chip", filter.kanal === c.id && "border-accent-2 text-accent-2")}>
              {c.name}
            </Link>
          ))}
        <Link href={href({ ohne: !filter.ohne, mehr: 1 })} className={clsx("chip", filter.ohne && "border-accent-2 text-accent-2")}>
          {filter.ohne ? "☑" : "☐"} auch ohne Stichwort
        </Link>
      </div>

      {videos.length === 0 ? (
        <p className="text-muted">Noch keine Videos – oben „Kanäle jetzt abgleichen“ drücken.</p>
      ) : shown.length === 0 ? (
        <p className="text-muted">Keine Videos in dieser Ansicht.</p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.slice(0, limit).map((v) => {
            const challenge = inLeague.get(v.video_id)
            return (
              <li key={v.video_id} className={clsx("flex flex-wrap items-center gap-3 py-2", v.hidden && !challenge && "opacity-50")}>
                <a href={`https://www.youtube.com/watch?v=${v.video_id}`} target="_blank" rel="noreferrer" className="relative block aspect-video w-28 shrink-0 overflow-hidden rounded-sm bg-black" title="Auf YouTube ansehen">
                  <Image src={`https://i.ytimg.com/vi/${v.video_id}/mqdefault.jpg`} alt="" fill sizes="112px" className="object-cover" />
                </a>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-semibold">{v.title}</div>
                  <div className="text-xs text-muted">
                    {nameOf.get(v.creator_id)} · {day(v.published_at)}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {challenge ? (
                    <Link href={`/admin?tab=liga&bearbeiten=${challenge}`} className="chip border-win text-win">
                      ✅ Eingepflegt
                    </Link>
                  ) : (
                    <>
                      {!v.hidden && (
                        <Link href={`/admin?tab=liga&video=${v.video_id}`} className="btn-primary px-3 py-1 text-xs">
                          Eintragen
                        </Link>
                      )}
                      <form action={setChannelVideoHidden}>
                        <input type="hidden" name="video_id" value={v.video_id} />
                        <input type="hidden" name="hidden" value={String(!v.hidden)} />
                        <button className="text-xs text-muted underline hover:text-white">{v.hidden ? "Einblenden" : "Ausblenden"}</button>
                      </form>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {shown.length > limit && (
        <Link href={href({ mehr: filter.mehr + 1 })} className="mt-3 inline-block text-sm text-accent-2 underline">
          Mehr anzeigen ({shown.length - limit} weitere)
        </Link>
      )}
    </section>
  )
}
