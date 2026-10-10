import { safeDecode } from "@/lib/site"
import { notFound } from "next/navigation"
import type { LoadoutOverlay } from "@/lib/live-overlay"
import { fetchOverlay } from "@/lib/live-overlay"
import { createClient } from "@/lib/supabase/server"
import { LoadoutOverlayView } from "../../live-overlays"

export const metadata = { title: "Loadout (Overlay)" }
export const dynamic = "force-dynamic"

export default async function Page({ params }: { params: Promise<{ login: string }> }) {
  const login = safeDecode((await params).login).trim()
  const supabase = await createClient()
  const { data: matches } = await supabase.from("profiles").select("id, twitch_login").ilike("twitch_login", login.replace(/[%_\\]/g, "\\$&")).limit(5)
  const profile = matches?.find((p) => p.twitch_login === login) ?? matches?.[0]
  if (!profile) notFound()
  const row = await fetchOverlay(supabase, profile.id, "loadout")
  return (
    <>
      {/* Transparenter Hintergrund für OBS */}
      <style>{`html, body { background: transparent !important; min-height: 0; }`}</style>
      <LoadoutOverlayView userId={profile.id} initial={(row?.data as LoadoutOverlay | undefined) ?? null} />
    </>
  )
}
