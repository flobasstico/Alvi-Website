import type { Tables } from "./database.types"

export type WinChallenge = Tables<"win_challenges">
export type WinGame = Tables<"win_challenge_games">
export type WinState = { challenge: WinChallenge; games: WinGame[] }

/** Verstrichene Sekunden (läuft weiter, solange status = 'laeuft') */
export function elapsedSeconds(c: Pick<WinChallenge, "status" | "elapsed_s" | "started_at">, now: number): number {
  const running = c.status === "laeuft" && c.started_at ? Math.max(0, (now - Date.parse(c.started_at)) / 1000) : 0
  return Number(c.elapsed_s) + running
}

/** Restzeit in Sekunden; null = ohne Zeitlimit */
export function remainingSeconds(c: Pick<WinChallenge, "status" | "elapsed_s" | "started_at" | "duration_s">, now: number): number | null {
  if (!c.duration_s) return null
  return Math.max(0, c.duration_s - elapsedSeconds(c, now))
}

/** 75 → „1:15“, 3725 → „1:02:05“ */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, "0")
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`
}

export function progress(games: readonly Pick<WinGame, "wins" | "target">[]) {
  const wins = games.reduce((s, g) => s + Math.min(g.wins, g.target), 0)
  const target = games.reduce((s, g) => s + g.target, 0)
  const done = games.filter((g) => g.wins >= g.target).length
  return { wins, target, done, total: games.length, complete: games.length > 0 && done === games.length }
}

/** Sortierung wie angelegt */
export const sortGames = (games: WinGame[]) => [...games].sort((a, b) => a.position - b.position || a.id - b.id)
