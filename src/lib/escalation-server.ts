import type { createClient } from "@/lib/supabase/server"
import { withCounts, type EscState } from "./escalation"

type Client = Awaited<ReturnType<typeof createClient>>

/** Kompletter Zustand einer Regel-Eskalation für den ersten Seitenaufbau (Seite und OBS-Overlay). */
export async function loadEscalation(supabase: Client, sessionId: number): Promise<EscState | null> {
  const [{ data: session }, { data: rules }, { data: players }, { data: polls }] = await Promise.all([
    supabase.from("escalation_sessions").select("*").eq("id", sessionId).maybeSingle(),
    supabase.from("escalation_session_rules").select("*").eq("session_id", sessionId).order("position"),
    supabase.from("escalation_players").select("*").eq("session_id", sessionId).order("joined_at"),
    supabase.from("escalation_polls").select("*").eq("session_id", sessionId).order("position"),
  ])
  if (!session) return null
  const ids = (polls ?? []).map((p) => p.id)
  const { data: counts } = ids.length
    ? await supabase.from("escalation_poll_counts").select("*").in("poll_id", ids)
    : { data: [] }
  return { session, rules: rules ?? [], players: players ?? [], polls: withCounts(polls ?? [], counts ?? []) }
}
