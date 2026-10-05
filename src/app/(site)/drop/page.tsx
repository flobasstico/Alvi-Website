import Link from "next/link"
import { PageTitle } from "@/components/page-title"
import { ReplayBanner } from "@/components/replay-banner"
import { dropCircles } from "@/lib/replay"
import { getCurrentSeason } from "@/lib/season"
import { getViewer } from "@/lib/supabase/server"
import { DropReplay } from "./drop-replay"
import { DropRoulette } from "./drop-roulette"

export const metadata = { title: "Drop-Spot-Roulette" }

export default async function DropPage({ searchParams }: { searchParams: Promise<{ nachspielen?: string }> }) {
  const { nachspielen } = await searchParams
  const { supabase, isAdmin, profile } = await getViewer()
  const season = await getCurrentSeason(supabase)
  const replayId = Number(nachspielen)
  const { data: replay } = Number.isInteger(replayId) && replayId > 0
    ? await supabase.from("challenges").select("*").eq("id", replayId).eq("source", "drop").maybeSingle()
    : { data: null }
  if (replay) {
    const { circles, rule } = dropCircles(replay.config)
    return (
      <>
        <PageTitle title="Drop-Spot-Roulette" subtitle="Alvis Landebereich – exakt wie im Original." />
        <ReplayBanner title={replay.title} status={({ geschafft: "geschafft ✅", gescheitert: "gescheitert ❌" } as Record<string, string>)[replay.status] ?? replay.status} back="/drop">
          <p className="text-sm">Landet im markierten Kreis{circles.length > 1 ? " – jeder in seinem eigenen" : ""}.</p>
        </ReplayBanner>
        <DropReplay circles={circles} rule={rule} mapUrl={season?.map_image_url} />
      </>
    )
  }
  const [{ data: spots }, { data: rules }] = await Promise.all([
    season
      ? supabase.from("drop_spots").select("id, name, x, y").eq("season_id", season.id).eq("active", true)
      : Promise.resolve({ data: [] }),
    supabase.from("rules").select("id, text, weight").eq("category", "drop").eq("active", true),
  ])

  return (
    <>
      <PageTitle title="Drop-Spot-Roulette" subtitle="Zufälliger Landebereich auf der aktuellen Map – solo oder für mehrere Spieler, jeder bekommt seinen eigenen Kreis." />
      {isAdmin && (
        <Link href="/admin?tab=spots" className="btn-secondary mb-4 inline-flex px-3 py-1 text-sm">
          🗺️ Karte &amp; Spots bearbeiten
        </Link>
      )}
      <DropRoulette spots={spots ?? []} rules={(rules ?? []).map((r) => ({ ...r, weight: 1 }))} mapUrl={season?.map_image_url} isAdmin={isAdmin} overlayLogin={profile?.twitch_login ?? null} />
    </>
  )
}
