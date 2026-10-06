/** Profilbild eines YouTube-Kanals: das og:image der Kanalseite (ohne API-Schlüssel) */

const AVATAR_HOSTS = /^https:\/\/(yt3\.ggpht\.com|yt3\.googleusercontent\.com|lh3\.googleusercontent\.com)\//

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
  try {
    const res = await fetch(channelUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
        // Ohne Zustimmungs-Cookie leitet YouTube in der EU auf eine Einwilligungsseite um
        Cookie: "SOCS=CAI; CONSENT=YES+1",
      },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    })
    if (!res.ok) return null
    return avatarFromHtml(await res.text())
  } catch {
    return null
  }
}
