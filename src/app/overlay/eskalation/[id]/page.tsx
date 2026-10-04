import { notFound } from "next/navigation"
import { loadEscalation } from "@/lib/escalation-server"
import { createClient } from "@/lib/supabase/server"
import { OverlayBoard } from "./overlay-board"

export const metadata = { title: "Regel-Eskalation – Overlay" }

export default async function OverlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessionId = Number(id)
  if (!Number.isInteger(sessionId)) notFound()
  const initial = await loadEscalation(await createClient(), sessionId)
  if (!initial) notFound()
  return (
    <>
      {/* Transparenter Hintergrund für OBS */}
      <style>{`html, body { background: transparent !important; min-height: 0; }`}</style>
      <OverlayBoard initial={initial} serverNow={Date.now()} />
    </>
  )
}
