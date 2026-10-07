/**
 * Live-Status über die offizielle Twitch-API (Helix).
 * Braucht TWITCH_CLIENT_ID und TWITCH_CLIENT_SECRET (nur auf dem Server, z. B. in Vercel) –
 * fehlen sie oder ist Twitch nicht erreichbar, gilt der Kanal einfach als offline.
 */

const API = process.env.TWITCH_API_URL ?? "https://api.twitch.tv/helix"
const AUTH = process.env.TWITCH_AUTH_URL ?? "https://id.twitch.tv/oauth2/token"

export type LiveStream = { login: string; name: string; title: string; game: string; viewers: number; startedAt: string; thumbnail: string }

let token: { value: string; expires: number } | null = null

/** App-Token (Client-Credentials), im Speicher zwischengespeichert */
async function appToken(id: string, secret: string) {
  if (token && token.expires > Date.now() + 60_000) return token.value
  const res = await fetch(AUTH, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials" }),
    cache: "no-store",
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { access_token: string; expires_in: number }
  token = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 }
  return token.value
}

/** Läuft der Stream gerade? Ergebnis wird 60 s zwischengespeichert. */
export async function liveStream(login: string): Promise<LiveStream | null> {
  const id = process.env.TWITCH_CLIENT_ID
  const secret = process.env.TWITCH_CLIENT_SECRET
  if (!id || !secret || !/^[a-z0-9_]{3,25}$/i.test(login)) return null
  try {
    const access = await appToken(id, secret)
    if (!access) return null
    const res = await fetch(`${API}/streams?user_login=${encodeURIComponent(login.toLowerCase())}`, {
      headers: { "Client-Id": id, Authorization: `Bearer ${access}` },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3000),
    })
    if (res.status === 401) token = null // Token abgelaufen → beim nächsten Mal neu holen
    if (!res.ok) return null
    const s = ((await res.json()) as { data?: Record<string, string | number>[] }).data?.[0]
    if (!s || s.type !== "live") return null
    return {
      login: String(s.user_login),
      name: String(s.user_name),
      title: String(s.title ?? ""),
      game: String(s.game_name ?? ""),
      viewers: Number(s.viewer_count ?? 0),
      startedAt: String(s.started_at ?? ""),
      thumbnail: String(s.thumbnail_url ?? "").replace("{width}", "320").replace("{height}", "180"),
    }
  } catch {
    return null
  }
}

/** „seit 2 h 5 min“ */
export function liveSince(startedAt: string, now = Date.now()) {
  const min = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 60000))
  if (!Number.isFinite(min)) return ""
  const h = Math.floor(min / 60)
  return h ? `seit ${h} h ${min % 60} min` : `seit ${min} min`
}
