import { notFound } from "next/navigation"
import { AdminDeleteRound } from "@/components/admin-delete-round"
import { getViewer } from "@/lib/supabase/server"
import { fetchWin } from "@/lib/winchallenge-live"
import { WinControl } from "./win-control"

export const metadata = { title: "Winchallenge" }

export default async function WinDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const winId = Number(id)
  if (!Number.isInteger(winId)) notFound()
  const { supabase, user, isAdmin } = await getViewer()
  const initial = await fetchWin(supabase, winId)
  if (!initial) notFound()
  return (
    <>
      <WinControl initial={initial} isAdmin={isAdmin} userId={user?.id ?? null} serverNow={Date.now()} />
      {isAdmin && <AdminDeleteRound kind="winchallenge" id={winId} name={initial.challenge.title ?? `Winchallenge #${winId}`} back="/winchallenge" className="mt-8" />}
    </>
  )
}
