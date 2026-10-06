import type { createClient } from "@/lib/supabase/server"
import { DEFAULT_SCHEME, type Creator, type LeagueChallenge, type LeagueResult, type LeagueSeason } from "./league"

type Client = Awaited<ReturnType<typeof createClient>>

/** Liga-Daten einer Season (null = aktuelle, "ewig" = alle Seasons) */
export async function loadLeague(supabase: Client, season: string | undefined) {
  const [{ data: seasons }, { data: creators }] = await Promise.all([
    supabase.from("league_seasons").select("id, name, is_current, points_scheme").order("created_at", { ascending: false }),
    supabase.from("creators").select("id, name, avatar_url").order("id"),
  ])
  const all = (seasons ?? []) as LeagueSeason[]
  const forever = season === "ewig"
  const selected = forever ? null : (all.find((s) => String(s.id) === season) ?? all.find((s) => s.is_current) ?? all[0] ?? null)

  let query = supabase.from("league_challenges").select("*").order("played_at", { ascending: false }).order("id", { ascending: false })
  if (selected) query = query.eq("season_id", selected.id)
  const { data: challenges } = forever || selected ? await query : { data: [] }
  const ids = (challenges ?? []).map((c) => c.id)
  const { data: results } = ids.length ? await supabase.from("league_results").select("*").in("challenge_id", ids) : { data: [] }

  const schemes = new Map(all.map((s) => [s.id, s.points_scheme?.length ? s.points_scheme : DEFAULT_SCHEME]))
  return {
    seasons: all,
    selected,
    forever,
    creators: (creators ?? []) as Creator[],
    challenges: (challenges ?? []) as LeagueChallenge[],
    results: (results ?? []) as LeagueResult[],
    schemeOf: (seasonId: number) => schemes.get(seasonId) ?? DEFAULT_SCHEME,
  }
}
