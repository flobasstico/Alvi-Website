import { notFound } from "next/navigation"
import { getViewer } from "@/lib/supabase/server"
import { fetchWin } from "@/lib/winchallenge-live"
import { WinControl } from "./win-control"

export const metadata = { title: "Winchallenge" }

export default async function WinDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const winId = Number(id)
  if (!Number.isInteger(winId)) notFound()
  const { supabase, isAdmin } = await getViewer()
  const initial = await fetchWin(supabase, winId)
  if (!initial) notFound()
  return <WinControl initial={initial} isAdmin={isAdmin} serverNow={Date.now()} />
}
