import { createClient } from "@/lib/supabase/server"
import { fetchWin } from "@/lib/winchallenge-live"
import { WinOverlay } from "./overlay"

export const metadata = { title: "Winchallenge (Overlay)" }
export const dynamic = "force-dynamic"

export default async function Page() {
  const initial = await fetchWin(await createClient(), null).catch(() => null)
  return (
    <>
      {/* Transparenter Hintergrund für OBS */}
      <style>{`html, body { background: transparent !important; min-height: 0; }`}</style>
      <WinOverlay initial={initial} serverNow={Date.now()} follow={true} />
    </>
  )
}
