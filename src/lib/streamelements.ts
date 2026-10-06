/**
 * StreamElements: öffentliche Loyalty-Daten (Watchtime, Punkte) des Kanals.
 * Kein Token nötig. Antworten werden 15 Minuten zwischengespeichert.
 */

const API = process.env.STREAMELEMENTS_API_URL ?? "https://api.streamelements.com/kappa/v2"
const REVALIDATE = 900
export const PAGE_SIZE = 100

/** Bots tauchen in den Listen mit auf, gehören aber nicht in die Rangliste */
const BOTS = new Set([
  "streamelements", "nightbot", "moobot", "streamlabs", "fossabot", "wizebot", "soundalerts", "sery_bot", "commanderroot",
  "botrixoficial", "kofistreambot", "tangiabot", "pokemoncommunitygame", "creatisbot", "blerp", "lurxx", "own3d",
])
export const isBot = (name: string) => BOTS.has(name.toLowerCase())

export type SeBoard = "watchtime" | "punkte" | "gesamt"
export type SeEntry = { username: string; value: number }
export type SePage = { total: number; entries: SeEntry[] }
export type SeUser = { username: string; points: number; pointsAlltime: number; watchtime: number; rank: number | null }

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { next: { revalidate: REVALIDATE }, headers: { accept: "application/json" } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/** StreamElements-Kanal-ID zum Twitch-Namen */
export async function seChannelId(login: string) {
  const data = await get<{ _id?: string }>(`/channels/${encodeURIComponent(login.toLowerCase())}`)
  return data?._id ?? null
}

const PATHS: Record<SeBoard, string> = { watchtime: "watchtime", punkte: "top", gesamt: "alltime" }

/** Eine Seite der Rangliste (null = StreamElements nicht erreichbar) */
export async function seLeaderboard(channelId: string, board: SeBoard, page: number): Promise<SePage | null> {
  const data = await get<{ _total?: number; users?: { username: string; minutes?: number; points?: number }[] }>(
    `/points/${channelId}/${PATHS[board]}?limit=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}`,
  )
  if (!data?.users) return null
  return { total: data._total ?? 0, entries: data.users.map((u) => ({ username: u.username, value: (board === "watchtime" ? u.minutes : u.points) ?? 0 })) }
}

/** Werte eines Zuschauers (null = nicht gefunden) */
export async function seUser(channelId: string, username: string): Promise<SeUser | null> {
  const name = username.trim().replace(/^@/, "").toLowerCase()
  if (!/^[a-z0-9_]{2,25}$/.test(name)) return null
  const data = await get<Partial<SeUser>>(`/points/${channelId}/${encodeURIComponent(name)}`)
  if (!data?.username) return null
  return {
    username: data.username,
    points: data.points ?? 0,
    pointsAlltime: data.pointsAlltime ?? 0,
    watchtime: data.watchtime ?? 0,
    rank: data.rank ?? null,
  }
}

/**
 * Plätze ohne Bots: Bots werden ausgeblendet und zählen nicht mit.
 * Für Seite 2+ werden die Bots der ersten Seite abgezogen (dort stehen sie praktisch immer).
 */
export function rankEntries(entries: readonly SeEntry[], page: number, firstPage: readonly SeEntry[] = []) {
  const botsBefore = page > 1 ? firstPage.filter((e) => isBot(e.username)).length : 0
  let rank = (page - 1) * PAGE_SIZE - botsBefore
  return entries.filter((e) => !isBot(e.username)).map((e) => ({ ...e, rank: ++rank }))
}

/** Minuten lesbar: „1.234 Std. 5 Min.“ */
export function formatWatchtime(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (!h) return `${m} Min.`
  return `${h.toLocaleString("de-DE")} Std.${m ? ` ${m} Min.` : ""}`
}
