import { fetchRound } from "@/lib/bingo-live"
import { createClient } from "@/lib/supabase/server"
import { RankingOverlay } from "../overlays"

export const metadata = { title: "Bingo – Rangliste (Overlay)" }
export const dynamic = "force-dynamic"

export default async function Page() {
  const initial = await fetchRound(await createClient(), null)
  return (
    <>
      {/* Transparenter Hintergrund für OBS */}
      <style>{`html, body { background: transparent !important; min-height: 0; }`}</style>
      <RankingOverlay initial={initial} />
    </>
  )
}
