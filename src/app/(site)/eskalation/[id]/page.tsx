import { notFound } from "next/navigation"
import { AdminDeleteRound } from "@/components/admin-delete-round"
import { loadEscalation } from "@/lib/escalation-server"
import { getViewer } from "@/lib/supabase/server"
import { EscalationRoom } from "./escalation-room"

export default async function EscalationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessionId = Number(id)
  if (!Number.isInteger(sessionId)) notFound()
  const { supabase, user, isAdmin } = await getViewer()
  const [initial, { data: pool }] = await Promise.all([
    loadEscalation(supabase, sessionId),
    supabase.from("escalation_rules").select("id, text").eq("active", true).eq("kind", "grund").order("id"),
  ])
  if (!initial) notFound()
  // Nachspiel-Runde: die Grundregel steht fest und muss auf dem Rad sein (auch wenn sie nicht mehr im Pool ist)
  const scripted = Array.isArray(initial.session.script) ? (initial.session.script[0] as { rule_id: number | null; text: string } | undefined) : undefined
  const wheelPool =
    scripted && !(pool ?? []).some((r) => r.id === scripted.rule_id) ? [...(pool ?? []), { id: scripted.rule_id ?? -1, text: scripted.text }] : (pool ?? [])
  return (
    <>
      <EscalationRoom initial={initial} pool={wheelPool} userId={user?.id ?? null} serverNow={Date.now()} />
      {isAdmin && <AdminDeleteRound kind="eskalation" id={sessionId} name={initial.session.title ?? `Eskalation #${sessionId}`} back="/eskalation" className="mt-8" />}
    </>
  )
}
