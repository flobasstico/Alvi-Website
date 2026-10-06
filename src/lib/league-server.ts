import type { createClient } from "@/lib/supabase/server"
import type { Creator, LeagueChallenge, LeagueResult } from "./league"

type Client = Awaited<ReturnType<typeof createClient>>

/** Alle Liga-Daten (ewige Tabelle) */
export async function loadLeague(supabase: Client) {
  const [{ data: creators }, { data: challenges }, { data: results }] = await Promise.all([
    supabase.from("creators").select("id, name, avatar_url, youtube_url, color").order("id"),
    supabase.from("league_challenges").select("*").order("played_at", { ascending: false }).order("id", { ascending: false }),
    supabase.from("league_results").select("*"),
  ])
  return {
    creators: (creators ?? []) as Creator[],
    challenges: (challenges ?? []) as LeagueChallenge[],
    results: (results ?? []) as LeagueResult[],
  }
}
