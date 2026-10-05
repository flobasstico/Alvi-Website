import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { fetchWin } from "@/lib/winchallenge-live"
import { WinOverlay } from "../overlay"

export const metadata = { title: "Winchallenge (Overlay)" }
export const dynamic = "force-dynamic"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const winId = Number((await params).id)
  if (!Number.isInteger(winId)) notFound()
  const initial = await fetchWin(await createClient(), winId)
  return (
    <>
      {/* Transparenter Hintergrund für OBS */}
      <style>{`html, body { background: transparent !important; min-height: 0; }`}</style>
      <WinOverlay initial={initial} serverNow={Date.now()} follow={false} />
    </>
  )
}
