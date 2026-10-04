import { PageTitle } from "@/components/page-title"
import { getCurrentSeason } from "@/lib/season"
import { getViewer } from "@/lib/supabase/server"
import { LoadoutDice } from "./loadout-dice"

export const metadata = { title: "Loadout-Würfel" }

export default async function LoadoutPage() {
  const { supabase, isAdmin } = await getViewer()
  const season = await getCurrentSeason(supabase)
  const { data: items } = season
    ? await supabase.from("loot_items").select("id, name, rarity, type").eq("season_id", season.id).eq("active", true)
    : { data: [] }

  return (
    <>
      <PageTitle
        title="Loadout-Würfel"
        subtitle={`5 Slots aus dem Loot-Pool${season ? ` von „${season.name}“` : ""}. Slots sperren, einzeln neu würfeln, fertig.`}
      />
      <LoadoutDice items={items ?? []} isAdmin={isAdmin} />
    </>
  )
}
