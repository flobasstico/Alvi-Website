import { notFound } from "next/navigation"
import { getViewer } from "@/lib/supabase/server"
import { Scoreboard } from "./scoreboard"

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const matchId = Number(id)
  if (!Number.isInteger(matchId)) notFound()
  const { supabase, isAdmin } = await getViewer()
  const [{ data: match }, { data: checklist }] = await Promise.all([
    supabase.from("versus_matches").select("*").eq("id", matchId).maybeSingle(),
    supabase.from("versus_checklist").select("*").eq("match_id", matchId).order("position"),
  ])
  if (!match) notFound()
  return <Scoreboard initialMatch={match} initialChecklist={checklist ?? []} isAdmin={isAdmin} />
}
