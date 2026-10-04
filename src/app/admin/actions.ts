"use server"

import { revalidatePath } from "next/cache"
import { ITEM_TYPES, RARITIES, STATUSES, type Status } from "@/lib/constants"
import { parseLootList, type ItemType } from "@/lib/loot-import"
import { getCurrentSeason } from "@/lib/season"
import { requireAdmin } from "@/lib/supabase/server"

const TOGGLE_TABLES = ["rules", "loot_items", "drop_spots", "bingo_tasks"] as const
const DELETE_TABLES = [...TOGGLE_TABLES, "challenges"] as const
type ToggleTable = (typeof TOGGLE_TABLES)[number]
type DeleteTable = (typeof DELETE_TABLES)[number]

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim()

function done(error: { message: string } | null) {
  if (error) throw new Error(error.message)
  revalidatePath("/", "layout")
}

export async function toggleActive(form: FormData) {
  const supabase = await requireAdmin()
  const table = str(form, "table") as ToggleTable
  if (!TOGGLE_TABLES.includes(table)) throw new Error("Ungültige Tabelle")
  const { error } = await supabase
    .from(table)
    .update({ active: str(form, "active") !== "true" })
    .eq("id", Number(str(form, "id")))
  done(error)
}

export async function deleteRow(form: FormData) {
  const supabase = await requireAdmin()
  const table = str(form, "table") as DeleteTable
  if (!DELETE_TABLES.includes(table)) throw new Error("Ungültige Tabelle")
  const { error } = await supabase.from(table).delete().eq("id", Number(str(form, "id")))
  done(error)
}

export async function addRule(form: FormData) {
  const supabase = await requireAdmin()
  const text = str(form, "text")
  if (!text) return
  const category = str(form, "category") === "drop" ? "drop" : "rad"
  const weight = Math.min(10, Math.max(1, Number(str(form, "weight")) || 1))
  done((await supabase.from("rules").insert({ text, category, weight })).error)
}

export async function setRuleWeight(form: FormData) {
  const supabase = await requireAdmin()
  const weight = Math.min(10, Math.max(1, Number(str(form, "weight")) || 1))
  done((await supabase.from("rules").update({ weight }).eq("id", Number(str(form, "id")))).error)
}

export async function addLoot(form: FormData) {
  const supabase = await requireAdmin()
  const season = await getCurrentSeason(supabase)
  const name = str(form, "name")
  const rarity = str(form, "rarity")
  const type = str(form, "type")
  if (!name || !season) throw new Error("Name und aktuelle Season nötig")
  if (!RARITIES.includes(rarity as never) || !ITEM_TYPES.includes(type as never)) throw new Error("Ungültige Werte")
  done((await supabase.from("loot_items").insert({ name, rarity, type, season_id: season.id })).error)
}

export async function updateLootItem(form: FormData) {
  const supabase = await requireAdmin()
  const name = str(form, "name").slice(0, 80)
  const rarity = str(form, "rarity")
  const type = str(form, "type")
  if (!name) throw new Error("Name fehlt")
  if (!RARITIES.includes(rarity as never) || !ITEM_TYPES.includes(type as never)) throw new Error("Ungültige Werte")
  done((await supabase.from("loot_items").update({ name, rarity, type }).eq("id", Number(str(form, "id")))).error)
}

/** Setzt das Icon einer einzelnen Variante – jede Seltenheit hat ihr eigenes Bild. */
export async function setLootIcon(id: number, url: string | null) {
  const supabase = await requireAdmin()
  done((await supabase.from("loot_items").update({ icon_url: url }).eq("id", id)).error)
}

/**
 * Lootpool aus einer eingefügten Liste übernehmen. „ersetzen“ löscht den bisherigen Pool der
 * aktuellen Season (laufende/alte Auktionen behalten ihre Item-Kopien). Vorhandene Icons werden
 * pro Name + Seltenheit übernommen.
 */
export async function importLoot(_: unknown, form: FormData): Promise<{ ok: boolean; message: string }> {
  const supabase = await requireAdmin()
  const season = await getCurrentSeason(supabase)
  if (!season) return { ok: false, message: "Keine aktuelle Season" }
  const defaultType = (ITEM_TYPES.includes(str(form, "default_type") as never) ? str(form, "default_type") : "waffe") as ItemType
  const defaultRarity = RARITIES.includes(str(form, "default_rarity") as never) ? str(form, "default_rarity") : "gruen"
  const parsed = parseLootList(str(form, "list"), defaultType)
  if (parsed.length === 0) return { ok: false, message: "Keine Items erkannt" }
  if (parsed.length > 500) return { ok: false, message: "Maximal 500 Items auf einmal" }

  const { data: existing } = await supabase
    .from("loot_items")
    .select("id, name, rarity, icon_url")
    .eq("season_id", season.id)
  // Bilder gehören zur Variante (Name + Seltenheit)
  const iconByVariant = new Map<string, string>()
  for (const e of existing ?? []) {
    if (e.icon_url) iconByVariant.set(`${e.name.toLowerCase()}|${e.rarity}`, e.icon_url)
  }

  const replace = str(form, "mode") === "ersetzen"
  const seen = new Set(replace ? [] : (existing ?? []).map((e) => `${e.name.toLowerCase()}|${e.rarity}`))
  const rows = []
  for (const p of parsed) {
    const rarity = p.rarity ?? defaultRarity
    const key = `${p.name.toLowerCase()}|${rarity}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({
      name: p.name,
      rarity,
      type: p.type,
      season_id: season.id,
      icon_url: iconByVariant.get(key) ?? null,
    })
  }

  if (replace) {
    const { error } = await supabase.from("loot_items").delete().eq("season_id", season.id)
    if (error) return { ok: false, message: error.message }
  }
  if (rows.length) {
    const { error } = await supabase.from("loot_items").insert(rows)
    if (error) return { ok: false, message: error.message }
  }
  done(null)
  const withoutRarity = parsed.filter((p) => !p.rarity).length
  return {
    ok: true,
    message:
      `${rows.length} Items ${replace ? "als neuer Pool übernommen" : "hinzugefügt"}` +
      (parsed.length > rows.length ? `, ${parsed.length - rows.length} Duplikate übersprungen` : "") +
      (withoutRarity ? `, ${withoutRarity} ohne Seltenheit → Standard gesetzt` : ""),
  }
}

export async function addDropSpot(input: { name: string; x: number; y: number }) {
  const supabase = await requireAdmin()
  const season = await getCurrentSeason(supabase)
  if (!season) throw new Error("Keine aktuelle Season")
  const clamp = (v: number) => Math.round(Math.min(100, Math.max(0, v)) * 100) / 100
  done(
    (
      await supabase
        .from("drop_spots")
        .insert({ name: input.name.trim(), x: clamp(input.x), y: clamp(input.y), season_id: season.id })
    ).error,
  )
}

export async function addBingoTask(form: FormData) {
  const supabase = await requireAdmin()
  const lines = str(form, "text")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return
  done((await supabase.from("bingo_tasks").insert(lines.map((text) => ({ text })))).error)
}

export async function addSeason(form: FormData) {
  const supabase = await requireAdmin()
  const name = str(form, "name")
  if (!name) return
  const copy = form.get("copy") === "on"
  const old = await getCurrentSeason(supabase)
  await supabase.from("seasons").update({ is_current: false }).eq("is_current", true)
  const { data: season, error } = await supabase
    .from("seasons")
    .insert({ name, is_current: true, map_image_url: copy ? old?.map_image_url : null })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  if (copy && old) {
    const [{ data: loot }, { data: spots }] = await Promise.all([
      supabase.from("loot_items").select("name, rarity, type, icon_url, active").eq("season_id", old.id),
      supabase.from("drop_spots").select("name, x, y, active").eq("season_id", old.id),
    ])
    if (loot?.length) await supabase.from("loot_items").insert(loot.map((l) => ({ ...l, season_id: season.id })))
    if (spots?.length) await supabase.from("drop_spots").insert(spots.map((s) => ({ ...s, season_id: season.id })))
  }
  done(null)
}

export async function setCurrentSeason(form: FormData) {
  const supabase = await requireAdmin()
  await supabase.from("seasons").update({ is_current: false }).eq("is_current", true)
  done((await supabase.from("seasons").update({ is_current: true }).eq("id", Number(str(form, "id")))).error)
}

export async function setSeasonMap(seasonId: number, url: string | null) {
  const supabase = await requireAdmin()
  done((await supabase.from("seasons").update({ map_image_url: url }).eq("id", seasonId)).error)
}

export async function addManualChallenge(form: FormData) {
  const supabase = await requireAdmin()
  const title = str(form, "title")
  if (!title) return
  done(
    (await supabase.from("challenges").insert({ title, description: str(form, "description") || null, source: "manuell" })).error,
  )
}

export async function updateChallenge(form: FormData) {
  const supabase = await requireAdmin()
  const status = str(form, "status") as Status
  if (!STATUSES.includes(status)) throw new Error("Ungültiger Status")
  const id = Number(str(form, "id"))
  const { data: current } = await supabase.from("challenges").select("played_at").eq("id", id).single()
  done(
    (
      await supabase
        .from("challenges")
        .update({
          status,
          video_url: str(form, "video_url") || null,
          played_at: status === "geplant" ? null : (current?.played_at ?? new Date().toISOString()),
        })
        .eq("id", id)
    ).error,
  )
}
