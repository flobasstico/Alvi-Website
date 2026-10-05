import { notFound } from "next/navigation"
import { AdminDeleteRound } from "@/components/admin-delete-round"
import { getViewer } from "@/lib/supabase/server"
import { LoadoutRoom } from "./loadout-room"

export const metadata = { title: "Loadout-Würfel – Mehrspieler" }

export default async function LoadoutSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessionId = Number(id)
  if (!Number.isInteger(sessionId)) notFound()
  const { supabase, user, isAdmin, profile } = await getViewer()
  const [{ data: session }, { data: players }] = await Promise.all([
    supabase.from("loadout_sessions").select("*").eq("id", sessionId).maybeSingle(),
    supabase.from("loadout_players").select("*").eq("session_id", sessionId).order("joined_at"),
  ])
  if (!session) notFound()
  // Alle Items der Season (auch deaktivierte), damit gespeicherte Loadouts immer auflösbar sind
  const { data: items } = session.season_id
    ? await supabase.from("loot_items").select("id, name, rarity, type, icon_url, active").eq("season_id", session.season_id)
    : { data: [] }
  return (
    <>
      <LoadoutRoom initial={{ session, players: players ?? [] }} items={items ?? []} userId={user?.id ?? null} login={profile?.twitch_login ?? null} />
      {isAdmin && <AdminDeleteRound kind="loadout" id={sessionId} name={session.title ?? `Loadout-Runde #${sessionId}`} back="/loadout" className="mt-8" />}
    </>
  )
}
