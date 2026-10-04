export type TimerState = {
  status: string
  duration_s: number
  started_at: string | null
  paused_remaining_s: number | null
}

/** Restzeit in Sekunden – alle Clients rechnen aus denselben DB-Werten. */
export function remainingSeconds(m: TimerState, now: number = Date.now()): number {
  if (m.status === "laeuft" && m.started_at) {
    const elapsed = (now - new Date(m.started_at).getTime()) / 1000
    return Math.max(0, Math.ceil(m.duration_s - elapsed))
  }
  if (m.status === "pausiert" || m.status === "beendet") return Math.max(0, m.paused_remaining_s ?? 0)
  return m.duration_s
}

/** Startzeit so setzen, dass die gegebene Restzeit weiterläuft. */
export function resumeStartedAt(m: TimerState, remaining: number, now: number = Date.now()): string {
  return new Date(now - (m.duration_s - remaining) * 1000).toISOString()
}

export function formatClock(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}
