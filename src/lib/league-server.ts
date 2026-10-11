import type { createClient } from "@/lib/supabase/server"
import { selectAll } from "@/lib/supabase/select-all"
import type { Creator, LeagueChallenge, LeagueResult, LeagueVideo } from "./league"

type Client = Awaited<ReturnType<typeof createClient>>

/** Alle Liga-Daten (ewige Tabelle); seitenweise geladen, damit nichts an der 1000-Zeilen-Grenze abgeschnitten wird */
export async function loadLeague(supabase: Client) {
  const [{ data: creators }, { data: challenges }, { data: results }, { data: videos }] = await Promise.all([
    supabase.from("creators").select("*").order("id"),
    selectAll((a, b) =>
      supabase.from("league_challenges").select("*").order("played_at", { ascending: false }).order("id", { ascending: false }).range(a, b),
    ),
    selectAll((a, b) => supabase.from("league_results").select("*").order("challenge_id").order("creator_id").range(a, b)),
    // Fehlt die Tabelle (z. B. kurz vor der Migration), einfach ohne Zusatzvideos weiter
    selectAll((a, b) =>
      supabase.from("league_videos").select("challenge_id, creator_id, url, position").order("challenge_id").order("position").range(a, b),
    ).catch(() => ({ data: [] as LeagueVideo[] })),
  ])
  return {
    creators: (creators ?? []) as Creator[],
    challenges: challenges as LeagueChallenge[],
    results: results as LeagueResult[],
    videos: videos as LeagueVideo[],
  }
}
