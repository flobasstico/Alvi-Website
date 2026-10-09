import { DiscoverRows } from "@/components/discover/discover-rows"
import { gameThumbs } from "@/lib/games"
import { ogMeta } from "@/lib/og"
import { getCurrentSeason } from "@/lib/season"
import { loadSiteSettings, safeUrl } from "@/lib/site"
import { createClient } from "@/lib/supabase/server"

export const metadata = ogMeta("Entdecken", "Alle Modi von Alvi Challenges: Glücksrad, Auktion, Bingo, Drop-Spot, Minispiele, Creator-Liga und mehr.", "/og/start")

export default async function EntdeckenPage() {
  const supabase = await createClient()
  const [settings, season, { data: running }] = await Promise.all([
    loadSiteSettings(supabase),
    getCurrentSeason(supabase),
    supabase.from("challenges").select("title").eq("status", "aktiv").order("played_at", { ascending: false }).limit(1).maybeSingle(),
  ])
  return (
    <>
      <h1 className="sr-only">Entdecken</h1>
      <DiscoverRows thumbs={gameThumbs(settings, safeUrl)} mapUrl={season?.map_image_url ?? null} featured="liga" running={running?.title ?? null} />
    </>
  )
}
