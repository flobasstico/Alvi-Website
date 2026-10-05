import type { createClient } from "@/lib/supabase/server"

type Client = Awaited<ReturnType<typeof createClient>>

/** Alvis Kanäle – die URLs pflegen Admins unter /admin?tab=seite */
export const CHANNELS = [
  { key: "link_twitch", label: "Twitch", color: "bg-[#9146ff] text-white" },
  { key: "link_youtube", label: "YouTube", color: "bg-[#ff0033] text-white" },
  { key: "link_tiktok", label: "TikTok", color: "bg-black text-white border border-white/30" },
  { key: "link_instagram", label: "Instagram", color: "bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white" },
  { key: "link_x", label: "X", color: "bg-black text-white border border-white/30" },
  { key: "link_discord", label: "Discord", color: "bg-[#5865f2] text-white" },
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
