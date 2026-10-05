import { PageTitle } from "@/components/page-title"
import { getViewer } from "@/lib/supabase/server"
import { NewRound } from "./new-round"

export const metadata = { title: "Neue Bingo-Runde" }

export default async function NewRoundPage({ searchParams }: { searchParams: Promise<{ karte?: string }> }) {
  const { karte } = await searchParams
  const { supabase, user } = await getViewer()
  const [{ data: cards }, { data: pool }] = await Promise.all([
    supabase.from("bingo_card_templates").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("bingo_tasks").select("text").eq("active", true),
  ])
  return (
    <>
      <PageTitle title="Neue Bingo-Runde" subtitle="Zuerst die Karte festlegen – alle Mitspieler spielen dieselbe Karte und haken für sich ab." />
      {user ? (
        <NewRound cards={cards ?? []} pool={(pool ?? []).map((p) => p.text)} preselect={Number(karte) || null} userId={user.id} />
      ) : (
        <p className="panel text-muted">Mit Twitch einloggen, um eine Runde zu eröffnen.</p>
      )}
    </>
  )
}
