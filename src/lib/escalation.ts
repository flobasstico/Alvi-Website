import type { Tables } from "./database.types"

export type EscSession = Tables<"escalation_sessions">
export type EscRule = Tables<"escalation_session_rules">

/** Gut lesbare, klar unterscheidbare Farben für die nummerierten Regeln (auch auf Spielszenen im Stream). */
export const RULE_COLORS = [
  "#ef4444", // rot
  "#f59e0b", // orange
  "#eab308", // gelb
  "#22c55e", // grün
  "#06b6d4", // cyan
  "#3b82f6", // blau
  "#8b5cf6", // violett
  "#ec4899", // pink
  "#14b8a6", // türkis
  "#f97316", // dunkelorange
] as const

export function ruleColor(position: number): string {
  return RULE_COLORS[(position - 1) % RULE_COLORS.length]
}

/** Wie viele Regeln laut Uhr inzwischen da sein müssten (Grundregel + je Intervall eine). */
export function dueRuleCount(s: Pick<EscSession, "status" | "started_at" | "interval_s">, now: number): number {
  if (s.status !== "laeuft" || !s.started_at) return 1
  const elapsed = Math.max(0, (now - Date.parse(s.started_at)) / 1000)
  return 1 + Math.floor(elapsed / s.interval_s)
}

/** Sekunden bis zur nächsten Regel; null, wenn kein Timer läuft. */
export function secondsToNextRule(s: Pick<EscSession, "status" | "started_at" | "interval_s" | "pool_exhausted">, now: number): number | null {
  if (s.status !== "laeuft" || !s.started_at || s.pool_exhausted) return null
  const elapsed = Math.max(0, (now - Date.parse(s.started_at)) / 1000)
  return Math.max(0, Math.ceil(s.interval_s - (elapsed % s.interval_s)))
}

export function formatClock(total: number): string {
  const m = Math.floor(total / 60)
  const sec = total % 60
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}
