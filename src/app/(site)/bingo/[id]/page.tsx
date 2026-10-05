import { notFound } from "next/navigation"
import { AdminDeleteRound } from "@/components/admin-delete-round"
import { fetchRound } from "@/lib/bingo-live"
import { getViewer } from "@/lib/supabase/server"
import { BingoRoom } from "./bingo-room"

export const metadata = { title: "Bingo" }

export default async function BingoRoundPage({ params }: { params: Promise<{ id: string }> }) {
  const roundId = Number((await params).id)
  if (!Number.isInteger(roundId)) notFound()
  const { supabase, user, isAdmin } = await getViewer()
  const initial = await fetchRound(supabase, roundId)
  if (!initial) notFound()
  return (
    <>
      <BingoRoom initial={initial} userId={user?.id ?? null} isAdmin={isAdmin} />
      {isAdmin && <AdminDeleteRound kind="bingo" id={roundId} name={initial.round.title ?? `Bingo-Runde #${roundId}`} back="/bingo" className="mt-8" />}
    </>
  )
}
