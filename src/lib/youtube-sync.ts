/**
 * Abgleich der Creator-Kanäle mit der YouTube Data API v3 (nur serverseitig, Schlüssel YOUTUBE_API_KEY).
 * Ohne Schlüssel: Rückfall auf den öffentlichen RSS-Feed (nur die 15 neuesten Videos je Kanal).
 */
import { channelIdFromHtml, channelIdFromUrl, isoDurationSeconds, isShortVideo, videosFromFeed } from "./youtube"

const API = process.env.YOUTUBE_API_URL ?? "https://www.googleapis.com/youtube/v3"
const FEED_URL = process.env.YOUTUBE_FEED_URL ?? "https://www.youtube.com/feeds/videos.xml"
const MAX_PAGES = 100 // höchstens 5000 Videos je Kanal

export type ChannelVideo = { video_id: string; title: string; published_at: string; duration_s: number | null; is_short: boolean }
export type ChannelResult = { channelId: string | null; uploads: string | null; videos: ChannelVideo[]; error: string | null; full: boolean }

export const hasYoutubeKey = () => !!process.env.YOUTUBE_API_KEY

class YoutubeError extends Error {}

async function api<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY!
  const res = await fetch(`${API}/${path}?${new URLSearchParams({ ...params, key })}`, { cache: "no-store", signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string; errors?: { reason?: string }[] } } | null
    const reason = body?.error?.errors?.[0]?.reason
    if (reason === "quotaExceeded") throw new YoutubeError("Tageskontingent der YouTube-API aufgebraucht – morgen wieder")
    if (res.status === 400 || res.status === 403) throw new YoutubeError(`YouTube lehnt den Schlüssel ab (${body?.error?.message ?? res.status})`)
    throw new YoutubeError(`YouTube-API-Fehler ${res.status}`)
  }
  return res.json() as Promise<T>
}

type ChannelsResponse = { items?: { id: string; contentDetails?: { relatedPlaylists?: { uploads?: string } } }[] }

/** Kanal-ID und Upload-Playlist zu einer Kanal-Adresse (@handle, /channel/UC…, /user/…) */
async function resolveChannel(url: string): Promise<{ channelId: string; uploads: string }> {
  const byId = channelIdFromUrl(url)
  const handle = url.match(/youtube\.com\/(@[\w.-]+)/)?.[1]
  const user = url.match(/youtube\.com\/user\/([\w.-]+)/)?.[1]
  const params: Record<string, string> = byId ? { id: byId } : handle ? { forHandle: handle } : user ? { forUsername: user } : {}
  if (!Object.keys(params).length) throw new YoutubeError("Kanal-Link nicht erkannt (bitte https://youtube.com/@name)")
  const data = await api<ChannelsResponse>("channels", { part: "contentDetails", ...params })
  const item = data.items?.[0]
  const uploads = item?.contentDetails?.relatedPlaylists?.uploads
  if (!item || !uploads) throw new YoutubeError("Kanal bei YouTube nicht gefunden")
  return { channelId: item.id, uploads }
}

type PlaylistResponse = {
  nextPageToken?: string
  items?: { snippet?: { title?: string; resourceId?: { videoId?: string } }; contentDetails?: { videoId?: string; videoPublishedAt?: string } }[]
}

/** Seiten blättern, bis alles da ist – oder (bei späteren Abgleichen) bis eine ganze Seite schon bekannt ist */
export function pageAllKnown(ids: string[], known: ReadonlySet<string>) {
  return ids.length > 0 && ids.every((id) => known.has(id))
}

async function uploads(playlist: string, known: ReadonlySet<string>) {
  const out: { video_id: string; title: string; published_at: string }[] = []
  let token: string | undefined
  let full = true
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await api<PlaylistResponse>("playlistItems", {
      part: "snippet,contentDetails",
      playlistId: playlist,
      maxResults: "50",
      ...(token ? { pageToken: token } : {}),
    })
    const items = (data.items ?? []).flatMap((it) => {
      const id = it.contentDetails?.videoId ?? it.snippet?.resourceId?.videoId
      const published = it.contentDetails?.videoPublishedAt
      // Private/gelöschte Videos haben kein Veröffentlichungsdatum
      return id && published && it.snippet?.title ? [{ video_id: id, title: it.snippet.title, published_at: published }] : []
    })
    out.push(...items)
    if (pageAllKnown(items.map((i) => i.video_id), known)) {
      full = false
      break
    }
    token = data.nextPageToken
    if (!token) break
  }
  return { items: out, full }
}

type VideosResponse = { items?: { id: string; contentDetails?: { duration?: string } }[] }

/** Dauer je Video (50 pro Abruf, parallel) */
async function durations(ids: string[]) {
  const chunks = Array.from({ length: Math.ceil(ids.length / 50) }, (_, i) => ids.slice(i * 50, i * 50 + 50))
  const res = await Promise.all(chunks.map((c) => api<VideosResponse>("videos", { part: "contentDetails", id: c.join(","), maxResults: "50" })))
  return new Map(res.flatMap((r) => r.items ?? []).map((v) => [v.id, isoDurationSeconds(v.contentDetails?.duration)]))
}

/** Rückfall ohne Schlüssel: RSS-Feed (Kanal-ID notfalls aus der Kanalseite) */
async function viaFeed(url: string): Promise<ChannelResult> {
  let channelId = channelIdFromUrl(url)
  if (!channelId) {
    const page = await fetch(url, {
      headers: { "Accept-Language": "de-DE", Cookie: "SOCS=CAI; CONSENT=YES+1", "User-Agent": "Mozilla/5.0 Chrome/126.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    })
      .then((r) => (r.ok ? r.text() : ""))
      .catch(() => "")
    channelId = channelIdFromHtml(page)
  }
  if (!channelId) return { channelId: null, uploads: null, videos: [], error: "Kanal nicht gefunden", full: false }
  const xml = await fetch(`${FEED_URL}?channel_id=${channelId}`, { cache: "no-store", signal: AbortSignal.timeout(6000) })
    .then((r) => (r.ok ? r.text() : ""))
    .catch(() => "")
  const videos = videosFromFeed(xml).map((v) => ({ video_id: v.id, title: v.title, published_at: v.published, duration_s: null, is_short: false }))
  return { channelId, uploads: null, videos, error: xml ? null : "Feed nicht erreichbar", full: false }
}

/** Einen Kanal abgleichen. known = schon gespeicherte Video-IDs dieses Kanals; cachedUploads spart den Kanal-Abruf. */
export async function syncChannel(url: string, known: ReadonlySet<string>, cached?: { channelId: string | null; uploads: string | null }): Promise<ChannelResult> {
  if (!hasYoutubeKey()) return viaFeed(url)
  try {
    const ch = cached?.uploads && cached.channelId ? { channelId: cached.channelId, uploads: cached.uploads } : await resolveChannel(url)
    const { items, full } = await uploads(ch.uploads, known)
    const fresh = items.filter((i) => !known.has(i.video_id))
    const dur = fresh.length ? await durations(fresh.map((i) => i.video_id)) : new Map<string, number | null>()
    const videos = fresh.map((i) => {
      const d = dur.get(i.video_id) ?? null
      return { ...i, duration_s: d, is_short: isShortVideo(i.title, d) }
    })
    return { channelId: ch.channelId, uploads: ch.uploads, videos, error: null, full }
  } catch (e) {
    return { channelId: cached?.channelId ?? null, uploads: cached?.uploads ?? null, videos: [], error: e instanceof YoutubeError ? e.message : "YouTube nicht erreichbar", full: false }
  }
}
