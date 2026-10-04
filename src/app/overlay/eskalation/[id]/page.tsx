import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OverlayBoard } from "./overlay-board"

export const metadata = { title: "Regel-Eskalation – Overlay" }

export default async function OverlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessionId = Number(id)
  if (!Number.isInteger(sessionId)) notFound()
  const supabase = await createClient()
  const [{ data: session }, { data: rules }, { data: players }] = await Promise.all([
    supabase.from("escalation_sessions").select("*").eq("id", sessionId).maybeSingle(),
    supabase.from("escalation_session_rules").select("*").eq("session_id", sessionId).order("position"),
    supabase.from("escalation_players").select("*").eq("session_id", sessionId).order("joined_at"),
  ])
  if (!session) notFound()
  return (
    <>
      {/* Transparenter Hintergrund für OBS */}
      <style>{`html, body { background: transparent !important; min-height: 0; }`}</style>
      <OverlayBoard initial={{ session, rules: rules ?? [], players: players ?? [] }} serverNow={Date.now()} />
    </>
  )
}
