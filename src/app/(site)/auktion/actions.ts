"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { RARITIES } from "@/lib/constants"
import { getCurrentSeason } from "@/lib/season"
import { requireAdmin } from "@/lib/supabase/server"

const clampInt = (v: FormDataEntryValue | null, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export async function createAuction(form: FormData) {
  const supabase = await requireAdmin()
  const season = await getCurrentSeason(supabase)
  if (!season) throw new Error("Keine aktuelle Season – im Admin anlegen")
  const rarities = RARITIES.filter((r) => form.get(`rarity_${r}`) === "on")
  if (rarities.length === 0) throw new Error("Mindestens eine Seltenheit auswählen")

  const { data, error } = await supabase
    .from("auctions")
    .insert({
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

export async function saveAuctionChallenge(auctionId: number) {
  const supabase = await requireAdmin()
  const [{ data: a, error }, { data: players }, { data: rounds }] = await Promise.all([
    supabase.from("auctions").select("*").eq("id", auctionId).single(),
    supabase.from("auction_players").select("*").eq("auction_id", auctionId).order("seat"),
    supabase.from("auction_rounds").select("*").eq("auction_id", auctionId).eq("status", "entschieden").order("round_no"),
  ])
  if (error) throw new Error(error.message)
  if (a.status !== "beendet") throw new Error("Auktion läuft noch")
  if (a.challenge_id) return a.challenge_id

  const loadouts = (players ?? []).map((p) => ({
    name: p.display_name,
    gold: p.gold,
    items: (rounds ?? []).filter((r) => r.winner_seat === p.seat).map((r) => ({ name: r.item_name, rarity: r.item_rarity, price: r.price })),
  }))
  const { data: ch, error: e1 } = await supabase
    .from("challenges")
    .insert({
      title: `Loot-Auktion${a.title ? `: ${a.title}` : ""} (${(players ?? []).map((p) => p.display_name).join(", ")})`,
      source: "auktion",
      status: "aktiv",
      played_at: new Date().toISOString(),
      config: { auction_id: auctionId, loadouts },
    })
    .select("id")
    .single()
  if (e1) throw new Error(e1.message)
  const { error: e2 } = await supabase.from("auctions").update({ challenge_id: ch.id }).eq("id", auctionId)
  if (e2) throw new Error(e2.message)
  revalidatePath(`/auktion/${auctionId}`)
  revalidatePath("/stats")
  return ch.id
}
