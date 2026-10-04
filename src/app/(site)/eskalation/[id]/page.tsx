import { notFound } from "next/navigation"
import { getViewer } from "@/lib/supabase/server"
import { EscalationRoom } from "./escalation-room"

export default async function EscalationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessionId = Number(id)
  if (!Number.isInteger(sessionId)) notFound()
  const { supabase, user } = await getViewer()
  const [{ data: session }, { data: rules }, { data: pool }, { data: players }] = await Promise.all([
    supabase.from("escalation_sessions").select("*").eq("id", sessionId).maybeSingle(),
    supabase.from("escalation_session_rules").select("*").eq("session_id", sessionId).order("position"),
    supabase.from("escalation_rules").select("id, text").eq("active", true).order("id"),
    supabase.from("escalation_players").select("*").eq("session_id", sessionId).order("joined_at"),
  ])
  if (!session) notFound()
  return (
    <EscalationRoom
      initial={{ session, rules: rules ?? [], players: players ?? [] }}
      pool={pool ?? []}
      userId={user?.id ?? null}
      serverNow={Date.now()}
    />
  )
}
