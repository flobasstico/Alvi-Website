"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { RARITIES } from "@/lib/constants"
import { getCurrentSeason } from "@/lib/season"
import { getViewer } from "@/lib/supabase/server"

const clampInt = (v: FormDataEntryValue | null, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export async function createAuction(form: FormData) {
  const { supabase, user } = await getViewer()
  if (!user) throw new Error("Bitte mit Twitch einloggen")
  const season = await getCurrentSeason(supabase)
  if (!season) throw new Error("Keine aktuelle Season – im Admin anlegen")
  const rarities = RARITIES.filter((r) => form.get(`rarity_${r}`) === "on")
  if (rarities.length === 0) throw new Error("Mindestens eine Seltenheit auswählen")

  const { data, error } = await supabase
    .from("auctions")
    .insert({
      host_id: user.id,
      title: String(form.get("title") ?? "").trim() || null,
      season_id: season.id,
      start_gold: Math.round(clampInt(form.get("start_gold"), 0, 100000, 500) / 10) * 10,
      items_per_player: clampInt(form.get("items_per_player"), 1, 10, 5),
      max_players: clampInt(form.get("max_players"), 2, 8, 4),
      bid_seconds: clampInt(form.get("bid_seconds"), 0, 600, 0),
      no_duplicates: form.get("no_duplicates") === "on",
      rarities,
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)

  // Host sitzt standardmäßig selbst mit am Tisch
  if (form.get("host_plays") === "on") await supabase.rpc("auction_join", { p_auction: data.id })
  revalidatePath("/auktion")
  redirect(`/auktion/${data.id}`)
}
