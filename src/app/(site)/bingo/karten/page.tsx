import { PageTitle } from "@/components/page-title"
import { getViewer } from "@/lib/supabase/server"
import { CardGallery } from "./card-gallery"

export const metadata = { title: "Bingo-Karten" }

export default async function CardsPage() {
  const { supabase, user, isAdmin } = await getViewer()
  const [{ data: cards }, { data: pool }] = await Promise.all([
    supabase.from("bingo_card_templates").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("bingo_tasks").select("text").eq("active", true),
  ])
  return (
    <>
      <PageTitle title="Bingo-Karten" subtitle="Eigene 3×3-Karte mit eigenen Aufgaben erstellen – sie trägt automatisch deinen Twitch-Namen und kann für Runden gewählt werden." />
      <CardGallery cards={cards ?? []} pool={(pool ?? []).map((p) => p.text)} userId={user?.id ?? null} isAdmin={isAdmin} />
    </>
  )
}
