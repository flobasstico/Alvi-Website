"use server"

import { revalidatePath } from "next/cache"
import { ITEM_TYPES, RARITIES, STATUSES, type Status } from "@/lib/constants"
import { gameBySlug, thumbKey } from "@/lib/games"
import { parseLootList, type ItemType } from "@/lib/loot-import"
import { getCurrentSeason } from "@/lib/season"
import { isYoutubeUrl } from "@/lib/league"
import { fetchYoutubeAvatar } from "@/lib/youtube"
import { CHANNELS, iconKey, invalidChannelLine, PAGE_KEYS, safeUrl } from "@/lib/site"
import { requireAdmin } from "@/lib/supabase/server"
import { selectAll } from "@/lib/supabase/select-all"

const TOGGLE_TABLES = ["rules", "loot_items", "drop_spots", "bingo_tasks", "escalation_rules"] as const
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
  const id = Number(str(form, "id"))
  // Statistik-Eintrag: die zugehörige Runde (Eskalation, Bingo …) wird mitgelöscht
  const { error } =
    table === "challenges"
      ? await supabase.rpc("admin_delete_round", { p_kind: "challenge", p_id: id })
      : await supabase.from(table).delete().eq("id", id)
  done(error)
}

export async function addRule(form: FormData) {
  const supabase = await requireAdmin()
  const text = str(form, "text")
  if (!text) return
  const category = str(form, "category") === "drop" ? "drop" : "rad"
  done((await supabase.from("rules").insert({ text, category })).error)
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
  const safe = url ? safeUrl(url) : null
  if (url && !safe) throw new Error("Ungültige Bild-Adresse")
  done((await supabase.from("loot_items").update({ icon_url: safe }).eq("id", id)).error)
}

/** Ändert alle Seltenheiten eines Items (gleicher Name in derselben Season wie das Item mit `id`). */
async function updateAllRarities(id: number, values: { icon_url?: string; active?: boolean }) {
  const supabase = await requireAdmin()
  const { data: item, error } = await supabase.from("loot_items").select("name, type, season_id").eq("id", id).single()
  if (error) return done(error)
  // Gleicher Name UND gleicher Typ – so wie die Admin-Liste gruppiert
  const query = supabase.from("loot_items").update(values).eq("name", item.name).eq("type", item.type)
  done((await (item.season_id === null ? query.is("season_id", null) : query.eq("season_id", item.season_id))).error)
}

/** Dasselbe Bild für alle Seltenheiten eines Items */
export async function setLootIconAll(id: number, url: string) {
  const safe = safeUrl(url)
  if (!safe) throw new Error("Ungültige Bild-Adresse")
  await updateAllRarities(id, { icon_url: safe })
}

/** Alle Seltenheiten eines Items aktivieren bzw. deaktivieren */
export async function setLootActiveAll(form: FormData) {
  await updateAllRarities(Number(str(form, "id")), { active: str(form, "active") === "true" })
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

export async function addEscalationRules(form: FormData) {
  const supabase = await requireAdmin()
  const lines = str(form, "text")
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[•\-*–·]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .map((l) => l.slice(0, 200))
  if (!lines.length) return
  const kind = escalationKind(form)
  done((await supabase.from("escalation_rules").insert(lines.map((text) => ({ text, kind })))).error)
}

const escalationKind = (form: FormData) => (str(form, "kind") === "grund" ? "grund" : "zusatz")

/** Regel in den jeweils anderen Pool verschieben (Grundregel ↔ Zusatzregel) */
export async function moveEscalationRule(form: FormData) {
  const supabase = await requireAdmin()
  done((await supabase.from("escalation_rules").update({ kind: escalationKind(form) }).eq("id", Number(str(form, "id")))).error)
}

export async function updateEscalationRule(form: FormData) {
  const supabase = await requireAdmin()
  const text = str(form, "text").slice(0, 200)
  if (!text) throw new Error("Regeltext fehlt")
  done((await supabase.from("escalation_rules").update({ text }).eq("id", Number(str(form, "id")))).error)
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

export async function setSeasonMap(seasonId: number, url: string | null) {
  const supabase = await requireAdmin()
  const safe = url ? safeUrl(url) : null
  if (url && !safe) throw new Error("Ungültige Bild-Adresse")
  done((await supabase.from("seasons").update({ map_image_url: safe }).eq("id", seasonId)).error)
}

/**
 * Neue Season starten und als aktuelle setzen. Optional werden Lootpool (mit Bildern), Karte und Drop-Spots
 * der bisherigen Season übernommen; die alte Season bleibt mit allen Daten erhalten.
 */
export async function startSeason(form: FormData) {
  const supabase = await requireAdmin()
  const name = str(form, "name").slice(0, 60)
  if (!name) throw new Error("Name fehlt")
  const copy = form.get("copy") === "on"
  const old = await getCurrentSeason(supabase)
  const { error: offError } = await supabase.from("seasons").update({ is_current: false }).eq("is_current", true)
  if (offError) throw new Error(offError.message)
  const { data: season, error } = await supabase
    .from("seasons")
    .insert({ name, is_current: true, map_image_url: copy ? (old?.map_image_url ?? null) : null })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  if (copy && old) {
    const [{ data: loot }, { data: spots }] = await Promise.all([
      selectAll((a, b) => supabase.from("loot_items").select("name, rarity, type, icon_url, active").eq("season_id", old.id).order("id").range(a, b)),
      selectAll((a, b) => supabase.from("drop_spots").select("name, x, y, active").eq("season_id", old.id).order("id").range(a, b)),
    ])
    if (loot.length) {
      const { error: e } = await supabase
        .from("loot_items")
        .insert(loot.map((l) => ({ name: l.name, rarity: l.rarity, type: l.type, icon_url: l.icon_url, active: l.active, season_id: season.id })))
      if (e) throw new Error(`Lootpool nicht übernommen: ${e.message}`)
    }
    if (spots.length) {
      const { error: e } = await supabase
        .from("drop_spots")
        .insert(spots.map((x) => ({ name: x.name, x: x.x, y: x.y, active: x.active, season_id: season.id })))
      if (e) throw new Error(`Drop-Spots nicht übernommen: ${e.message}`)
    }
  }
  done(null)
}

/** Alle Drop-Spots einer Season löschen, z. B. nach einer neuen Karte */
export async function deleteAllSpots(seasonId: number) {
  const supabase = await requireAdmin()
  done((await supabase.from("drop_spots").delete().eq("season_id", seasonId)).error)
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
          video_url: safeUrl(str(form, "video_url")),
          played_at: status === "geplant" ? null : (current?.played_at ?? new Date().toISOString()),
        })
        .eq("id", id)
    ).error,
  )
}

/** Kanal-Links und Rechtstexte speichern (leere Links werden entfernt) */
export async function saveSiteSettings(_: unknown, form: FormData): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await requireAdmin()
  const upserts: { key: string; value: string }[] = []
  const removes: string[] = []
  for (const c of CHANNELS) {
    const raw = str(form, c.key)
    if (!raw) {
      removes.push(c.key)
      continue
    }
    const bad = invalidChannelLine(raw)
    if (bad) return { error: `${c.label}: ungültiger Link „${bad}“ – bitte die komplette Adresse mit https:// eintragen.` }
    // Zeilen normalisiert speichern (Name | Link)
    upserts.push({ key: c.key, value: raw.split("\n").map((l) => l.trim()).filter(Boolean).join("\n").slice(0, 2000) })
  }
  for (const k of PAGE_KEYS) upserts.push({ key: k, value: String(form.get(k) ?? "").slice(0, 20000) })
  const { error } = await supabase.from("site_settings").upsert(upserts)
  if (error) return { error: error.message }
  if (removes.length) {
    const { error: e2 } = await supabase.from("site_settings").delete().in("key", removes)
    if (e2) return { error: e2.message }
  }
  revalidatePath("/", "layout")
  return { ok: true }
}

/** Eigenes Icon für eine Plattform (z. B. Merch-Logo) setzen oder mit null entfernen */
export async function setChannelIcon(channelKey: string, url: string | null) {
  const supabase = await requireAdmin()
  if (!CHANNELS.some((c) => c.key === channelKey)) throw new Error("Unbekannte Plattform")
  const key = iconKey(channelKey)
  if (!url) return done((await supabase.from("site_settings").delete().eq("key", key)).error)
  const safe = safeUrl(url)
  if (!safe) throw new Error("Ungültige Bild-Adresse")
  done((await supabase.from("site_settings").upsert({ key, value: safe })).error)
}

/** Eigenes Vorschaubild eines Modus (Lobby/Entdecken); null = gezeichnetes Bild */
export async function setGameThumb(slug: string, url: string | null) {
  const supabase = await requireAdmin()
  if (!gameBySlug(slug)) throw new Error("Unbekannter Modus")
  const key = thumbKey(slug)
  if (!url) return done((await supabase.from("site_settings").delete().eq("key", key)).error)
  const safe = safeUrl(url)
  if (!safe) throw new Error("Ungültige Bild-Adresse")
  done((await supabase.from("site_settings").upsert({ key, value: safe })).error)
}

/** Skin-Bild eines Creators für die Lobby; null = Profilbild */
export async function setCreatorSkin(id: number, url: string | null) {
  const supabase = await requireAdmin()
  const safe = url ? safeUrl(url) : null
  if (url && !safe) throw new Error("Ungültige Bild-Adresse")
  done((await supabase.from("creators").update({ skin_url: safe }).eq("id", id)).error)
}

/** Twitch-Account sperren/entsperren (Admins nicht) */
export async function setBanned(form: FormData) {
  const supabase = await requireAdmin()
  const { error } = await supabase.rpc("admin_set_banned", { p_user: str(form, "user"), p_banned: str(form, "banned") === "true" })
  done(error)
}

// ---------- Creator-Liga ----------
/** Creator anlegen/ändern; optional per Twitch-Name mit einem Profil verknüpfen */
export async function saveCreator(form: FormData) {
  const supabase = await requireAdmin()
  const name = str(form, "name").slice(0, 40)
  if (!name) throw new Error("Bitte einen Namen eingeben")
  const avatar = str(form, "avatar_url")
  if (avatar && !safeUrl(avatar)) throw new Error("Bild-Link muss mit https:// beginnen")
  const youtube = str(form, "youtube_url")
  if (!isYoutubeUrl(youtube)) throw new Error("Bitte den YouTube-Kanal angeben (https://youtube.com/@…)")
  const login = str(form, "twitch").replace(/^@/, "").toLowerCase()
  let profileId: string | null = null
  if (login) {
    const { data } = await supabase.from("profiles").select("id, avatar_url").ilike("twitch_login", login.replace(/[%_\\]/g, "\\$&")).maybeSingle()
    if (!data) throw new Error(`Kein Profil mit dem Twitch-Namen „${login}“ – die Person muss sich einmal eingeloggt haben`)
    profileId = data.id
  }
  // Ohne eigenen Bild-Link: Profilbild automatisch vom YouTube-Kanal übernehmen
  const picture = avatar || (await fetchYoutubeAvatar(youtube))
  // Feste Farbe für die Liga; „automatisch“ (oder neu angelegt ohne Farbfeld) = null
  const color = form.get("color_auto") || !/^#[0-9a-f]{6}$/i.test(str(form, "color")) ? null : str(form, "color").toLowerCase()
  const row = { name, avatar_url: picture || null, youtube_url: youtube, profile_id: profileId, color }
  const id = Number(str(form, "id"))
  const { error } = id ? await supabase.from("creators").update(row).eq("id", id) : await supabase.from("creators").insert(row)
  if (error?.code === "23505") throw new Error(`„${name}“ gibt es schon`)
  done(error)
}

/** Creator löschen – nur, solange er in keiner Liga-Challenge eingetragen ist */
export async function deleteCreator(form: FormData) {
  const supabase = await requireAdmin()
  const id = Number(str(form, "id"))
  const { count } = await supabase.from("league_results").select("creator_id", { count: "exact", head: true }).eq("creator_id", id)
  if (count) throw new Error("Dieser Creator hat schon Ergebnisse – erst die Challenges löschen oder ändern")
  done((await supabase.from("creators").delete().eq("id", id)).error)
}
