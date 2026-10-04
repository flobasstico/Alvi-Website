import { PageTitle } from "@/components/page-title"
import { getViewer } from "@/lib/supabase/server"
import { isoWeek } from "@/lib/week"
import { VotingBoard } from "./voting-board"
import { Wall } from "./wall"

export const metadata = { title: "Community-Voting" }

export default async function VotingPage() {
  const { supabase, user, isAdmin } = await getViewer()
  const { data: dbWeek } = await supabase.rpc("current_week")
  const week = dbWeek ?? isoWeek()

  let query = supabase.from("submission_scores").select("*").eq("week", week)
  if (!isAdmin) query = query.neq("status", "abgelehnt")
  const [{ data: submissions }, { data: myVotes }, { data: wall }] = await Promise.all([
    query.order("votes", { ascending: false }).order("created_at", { ascending: true }),
    user ? supabase.from("votes").select("submission_id").eq("user_id", user.id) : Promise.resolve({ data: [] }),
    supabase.from("challenges").select("*").eq("source", "voting").order("created_at", { ascending: false }).limit(60),
  ])

  return (
    <>
      <PageTitle
        title="Community-Voting"
        subtitle={`Woche ${week.split("-W")[1]}: Reicht Challenges ein und votet. Die Top 3 der Woche muss Alvi spielen.`}
      />
      <VotingBoard
        week={week}
        submissions={(submissions ?? []).map((s) => ({ ...s, id: s.id!, votes: s.votes ?? 0 }))}
        myVotes={(myVotes ?? []).map((v) => v.submission_id)}
        userId={user?.id ?? null}
        isAdmin={isAdmin}
      />
      <Wall challenges={wall ?? []} isAdmin={isAdmin} />
    </>
  )
}
