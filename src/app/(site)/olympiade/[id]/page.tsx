import { notFound } from "next/navigation"
import { AdminDeleteRound } from "@/components/admin-delete-round"
import { fetchOlympic } from "@/lib/olympiade-live"
import { getViewer } from "@/lib/supabase/server"
import { OlympicRoom } from "./olympic-room"

export const metadata = { title: "Olympiade" }

export default async function OlympicPage({ params }: { params: Promise<{ id: string }> }) {
  const olympicId = Number((await params).id)
  if (!Number.isInteger(olympicId)) notFound()
  const { supabase, user, isAdmin } = await getViewer()
  const initial = await fetchOlympic(supabase, olympicId)
  if (!initial) notFound()
  return (
    <>
      <OlympicRoom initial={initial} userId={user?.id ?? null} isAdmin={isAdmin} />
      {isAdmin && (
        <AdminDeleteRound kind="olympiade" id={olympicId} name={initial.olympic.title ?? `Olympiade #${olympicId}`} back="/olympiade" className="mt-8" />
      )}
    </>
  )
}
