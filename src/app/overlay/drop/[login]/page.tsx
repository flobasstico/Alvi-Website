import { notFound } from "next/navigation"
import type { DropOverlay } from "@/lib/live-overlay"
import { fetchOverlay } from "@/lib/live-overlay"
import { createClient } from "@/lib/supabase/server"
import { DropOverlayView } from "../../live-overlays"

export const metadata = { title: "Drop-Spot (Overlay)" }
export const dynamic = "force-dynamic"

export default async function Page({ params }: { params: Promise<{ login: string }> }) {
  const login = decodeURIComponent((await params).login).trim()
  const supabase = await createClient()
  const { data: matches } = await supabase.from("profiles").select("id, twitch_login").ilike("twitch_login", login.replace(/[%_\\]/g, "\\$&")).limit(5)
  const profile = matches?.find((p) => p.twitch_login === login) ?? matches?.[0]
  if (!profile) notFound()
  const row = await fetchOverlay(supabase, profile.id, "drop")
  return (
    <>
      {/* Transparenter Hintergrund für OBS */}
      <style>{`html, body { background: transparent !important; min-height: 0; }`}</style>
      <DropOverlayView userId={profile.id} initial={(row?.data as DropOverlay | undefined) ?? null} />
    </>
  )
}
