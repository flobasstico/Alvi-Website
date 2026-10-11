/** YouTube ohne API-Schlüssel: Kanalbild (og:image der Kanalseite) und neuestes Video (öffentlicher RSS-Feed) */

const AVATAR_HOSTS = /^https:\/\/(yt3\.ggpht\.com|yt3\.googleusercontent\.com|lh3\.googleusercontent\.com)\//
const YT_HOSTS = /^https:\/\/(www\.|m\.)?youtube\.com\//

/** Für Tests umleitbar (wie Twitch/StreamElements); live immer YouTube */
const FEED_URL = process.env.YOUTUBE_FEED_URL ?? "https://www.youtube.com/feeds/videos.xml"

const PAGE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
  // Ohne Zustimmungs-Cookie leitet YouTube in der EU auf eine Einwilligungsseite um
  Cookie: "SOCS=CAI; CONSENT=YES+1",
}

/** HTML einer Kanalseite laden (serverseitig); revalidate in Sekunden, 0 = nicht zwischenspeichern */
async function fetchChannelPage(channelUrl: string, revalidate = 0): Promise<string | null> {
  try {
    const res = await fetch(channelUrl, {
      headers: PAGE_HEADERS,
      signal: AbortSignal.timeout(6000),
      ...(revalidate ? { next: { revalidate } } : { cache: "no-store" as const }),
    })
    return res.ok ? await res.text() : null
  } catch {
    return null
  }
}

/** Liest das Kanalbild aus dem HTML der Kanalseite */
export function avatarFromHtml(html: string): string | null {
  const meta =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ??
    html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i)?.[1]
  if (!meta) return null
  const url = meta.replace(/&amp;/g, "&").trim()
  return AVATAR_HOSTS.test(url) ? url : null
}

/** Lädt die Kanalseite (serverseitig) und gibt das Profilbild zurück – oder null, wenn es nicht klappt */
export async function fetchYoutubeAvatar(channelUrl: string): Promise<string | null> {
  const html = await fetchChannelPage(channelUrl)
  return html ? avatarFromHtml(html) : null
}

/** Kanal-ID (UC…) aus einer Kanal-Adresse /channel/UC… */
export function channelIdFromUrl(url: string): string | null {
  return url.match(/youtube\.com\/channel\/(UC[\w-]{22})/)?.[1] ?? null
}

/** Kanal-ID (UC…) aus dem HTML der Kanalseite */
export function channelIdFromHtml(html: string): string | null {
  return (
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})["']/i)?.[1] ??
    html.match(/<meta[^>]+itemprop=["'](?:identifier|channelId)["'][^>]+content=["'](UC[\w-]{22})["']/i)?.[1] ??
    html.match(/"(?:externalId|channelId)":"(UC[\w-]{22})"/)?.[1] ??
    null
  )
}

export type YoutubeVideo = { id: string; title: string; published: string; url: string }

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")

/** Videos aus dem RSS-Feed eines Kanals (neueste zuerst); Shorts werden übersprungen */
export function videosFromFeed(xml: string): YoutubeVideo[] {
  const out: YoutubeVideo[] = []
  for (const [, entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const id = entry.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1]
    const link = entry.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/)?.[1] ?? ""
    const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1]
    if (!id || !title || !published || link.includes("/shorts/")) continue
    out.push({ id, title: decode(title.trim()), published, url: `https://www.youtube.com/watch?v=${id}` })
  }
  return out.sort((a, b) => Date.parse(b.published) - Date.parse(a.published))
}

/**
 * Neuestes (langes) Video eines Kanals. Kanalseite und Feed werden 30 Minuten zwischengespeichert –
 * ein neues Video erscheint also spätestens nach einer halben Stunde. Bei Fehlern null.
 */
export async function latestVideo(channelUrl: string): Promise<YoutubeVideo | null> {
  if (!YT_HOSTS.test(channelUrl)) return null
  const id = channelIdFromUrl(channelUrl) ?? channelIdFromHtml((await fetchChannelPage(channelUrl, 1800)) ?? "")
  if (!id) return null
  try {
    const res = await fetch(`${FEED_URL}?channel_id=${id}`, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    return videosFromFeed(await res.text())[0] ?? null
  } catch {
    return null
  }
}

/** „vor 3 Stunden“, „vor 2 Tagen“ … */
export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60000))
  if (!Number.isFinite(min)) return ""
  if (min < 60) return min <= 1 ? "gerade eben" : `vor ${min} Minuten`
  const h = Math.round(min / 60)
  if (h < 24) return h === 1 ? "vor 1 Stunde" : `vor ${h} Stunden`
  const d = Math.round(h / 24)
  if (d < 30) return d === 1 ? "vor 1 Tag" : `vor ${d} Tagen`
  const m = Math.round(d / 30)
  if (m < 12) return m === 1 ? "vor 1 Monat" : `vor ${m} Monaten`
  const y = Math.round(d / 365)
  return y <= 1 ? "vor 1 Jahr" : `vor ${y} Jahren`
}

/** Video-ID (11 Zeichen) aus einem YouTube-Link: watch?v=, youtu.be/, /shorts/, /live/, /embed/ */
export function videoIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url.trim())
    const host = u.hostname.replace(/^(www\.|m\.)/, "")
    let id: string | null = null
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0]
    else if (host === "youtube.com") id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|live|embed)\/([^/?#]+)/)?.[1] ?? null
    return id && /^[\w-]{11}$/.test(id) ? id : null
  } catch {
    return null
  }
}

/** ISO-8601-Dauer der YouTube-API („PT1H2M30S“) in Sekunden */
export function isoDurationSeconds(iso: string | null | undefined): number | null {
  const m = iso?.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/)
  if (!m) return null
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0))
  return d * 86400 + h * 3600 + min * 60 + s
}

/** Short: höchstens 3 Minuten lang oder „#shorts“ im Titel */
export function isShortVideo(title: string, durationS: number | null): boolean {
  return /#shorts?\b/i.test(title) || (durationS !== null && durationS <= 180)
}

/** Stichwörter aus dem Admin-Feld (kommagetrennt); Standard „Challenge“ */
export function parseKeywords(value: string | null | undefined): string[] {
  const list = (value ?? "")
    .split(/[,\n]/)
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
  return list.length ? [...new Set(list)] : ["challenge"]
}

/** Enthält der Titel eines der Stichwörter? (Groß-/Kleinschreibung egal) */
export function matchesKeywords(title: string, keywords: string[]): boolean {
  const t = title.toLowerCase()
  return keywords.some((k) => t.includes(k))
}
