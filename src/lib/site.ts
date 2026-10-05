import type { createClient } from "@/lib/supabase/server"

type Client = Awaited<ReturnType<typeof createClient>>

/** Alvis Kanäle (Reihenfolge = Icons auf der Startseite) – die URLs pflegen Admins unter /admin?tab=seite */
export const CHANNELS = [
  { key: "link_youtube", label: "YouTube" },
  { key: "link_twitch", label: "Twitch" },
  { key: "link_instagram", label: "Instagram" },
  { key: "link_tiktok", label: "TikTok" },
  { key: "link_merch", label: "Merch" },
  { key: "link_x", label: "X" },
  { key: "link_discord", label: "Discord" },
] as const

export type ChannelKey = (typeof CHANNELS)[number]["key"]
export const PAGE_KEYS = ["impressum", "datenschutz"] as const
export type PageKey = (typeof PAGE_KEYS)[number]

export async function loadSiteSettings(supabase: Client): Promise<Map<string, string>> {
  const { data } = await supabase.from("site_settings").select("key, value")
  return new Map((data ?? []).map((r) => [r.key, r.value]))
}

/** Nur http(s)-Links zulassen */
export function safeUrl(v: string | undefined | null): string | null {
  if (!v) return null
  try {
    const u = new URL(v.trim())
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null
  } catch {
    return null
  }
}

/** Schlüssel für ein eigenes Icon einer Plattform (z. B. Merch-Logo), im Admin hochladbar */
export const iconKey = (channelKey: string) => `${channelKey}_icon`

/** Ein Kanal: Anzeigename + Link */
export type ChannelEntry = { name: string; url: string }
export type Channel = { key: string; label: string; entries: ChannelEntry[]; icon: string | null }

/**
 * Kanäle einer Plattform aus dem Admin-Feld lesen: ein Kanal pro Zeile, optional „Name | https://…“.
 * Ungültige Zeilen werden übersprungen (bzw. beim Speichern gemeldet, siehe invalidChannelLine).
 */
export function parseChannelLinks(value: string | null | undefined, label: string): ChannelEntry[] {
  return (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const [name, url] = line.includes("|") ? line.split("|", 2).map((x) => x.trim()) : [label, line]
      const safe = safeUrl(url)
      return safe ? [{ name: name || label, url: safe }] : []
    })
}

/** Erste ungültige Zeile (für die Fehlermeldung im Admin) oder null */
export function invalidChannelLine(value: string): string | null {
  for (const line of value.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const url = line.includes("|") ? line.split("|", 2)[1].trim() : line
    if (!safeUrl(url)) return line
  }
  return null
}

/** Alle Plattformen mit mindestens einem Kanal */
export function channelsFromSettings(settings: ReadonlyMap<string, string>): Channel[] {
  return CHANNELS.map((c) => ({
    key: c.key,
    label: c.label,
    entries: parseChannelLinks(settings.get(c.key), c.label),
    icon: safeUrl(settings.get(iconKey(c.key))),
  })).filter((c) => c.entries.length > 0)
}
