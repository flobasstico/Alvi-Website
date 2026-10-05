import { notFound } from "next/navigation"
import { loadEscalation } from "@/lib/escalation-server"
import { getViewer } from "@/lib/supabase/server"
import { EscalationRoom } from "./escalation-room"

export default async function EscalationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessionId = Number(id)
  if (!Number.isInteger(sessionId)) notFound()
  const { supabase, user } = await getViewer()
  const [initial, { data: pool }] = await Promise.all([
    loadEscalation(supabase, sessionId),
    supabase.from("escalation_rules").select("id, text").eq("active", true).eq("kind", "grund").order("id"),
  ])
  if (!initial) notFound()
  return <EscalationRoom initial={initial} pool={pool ?? []} userId={user?.id ?? null} serverNow={Date.now()} />
}
