import type { createClient } from "@/lib/supabase/server"

type Client = Awaited<ReturnType<typeof createClient>>

export async function getCurrentSeason(supabase: Client) {
  const { data } = await supabase.from("seasons").select("*").eq("is_current", true).maybeSingle()
  return data
}
