import { PageTitle } from "@/components/page-title"
import { getCurrentSeason } from "@/lib/season"
import { getViewer } from "@/lib/supabase/server"
import { DropRoulette } from "./drop-roulette"

export const metadata = { title: "Drop-Spot-Roulette" }

export default async function DropPage() {
  const { supabase, isAdmin } = await getViewer()
  const season = await getCurrentSeason(supabase)
  const [{ data: spots }, { data: rules }] = await Promise.all([
    season
      ? supabase.from("drop_spots").select("id, name, x, y").eq("season_id", season.id).eq("active", true)
      : Promise.resolve({ data: [] }),
    supabase.from("rules").select("id, text, weight").eq("category", "drop").eq("active", true),
  ])

  return (
    <>
      <PageTitle title="Drop-Spot-Roulette" subtitle="Zufälliger Landeort auf der aktuellen Map – plus eine Zusatzregel." />
      <DropRoulette spots={spots ?? []} rules={(rules ?? []).map((r) => ({ ...r, weight: 1 }))} mapUrl={season?.map_image_url} isAdmin={isAdmin} />
    </>
  )
}
