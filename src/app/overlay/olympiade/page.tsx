import { fetchOlympic } from "@/lib/olympiade-live"
import { createClient } from "@/lib/supabase/server"
import { OlympicOverlay } from "./overlay"

export const metadata = { title: "Olympiade (Overlay)" }
export const dynamic = "force-dynamic"

export default async function Page() {
  const initial = await fetchOlympic(await createClient(), null).catch(() => null)
  return (
    <>
      {/* Transparenter Hintergrund für OBS */}
      <style>{`html, body { background: transparent !important; min-height: 0; }`}</style>
      <OlympicOverlay initial={initial} follow={true} />
    </>
  )
}
