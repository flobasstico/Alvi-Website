import { safeDecode } from "@/lib/site"
import { imageData, ogImage, ogSupabase } from "@/lib/og"
import { loadPlayerStats } from "@/lib/player-stats-server"

export const revalidate = 600

/** Zuschauerprofil: Name, Bild, Runden/Siege und bester Minispiel-Wert; privat nur ein neutrales Bild */
export async function GET(_: Request, { params }: { params: Promise<{ login: string }> }) {
  const login = safeDecode((await params).login).toLowerCase()
  const supabase = ogSupabase()
  const { data: profile } = /^[a-z0-9_]{2,25}$/.test(login)
    ? await supabase.from("profiles").select("id, display_name, twitch_login, avatar_url, is_public").ilike("twitch_login", login.replace(/[%_\\]/g, "\\$&")).maybeSingle()
    : { data: null }
  if (!profile?.is_public) return ogImage({ kicker: "Profil", title: "Privates Profil", subtitle: "Dieses Profil ist nicht öffentlich." })

  const [stats, { data: mini }] = await Promise.all([loadPlayerStats(supabase), supabase.rpc("minigame_profile", { p_user: profile.id })])
  const all = [...stats.parts, ...stats.viewerParts].filter((p) => p.userId === profile.id)
  const best = Math.max(0, ...(mini ?? []).map((m) => m.best))
  return ogImage({
    kicker: "Zuschauerprofil",
    title: profile.display_name ?? profile.twitch_login ?? login,
    subtitle: `@${profile.twitch_login} bei Alvi Challenges`,
    avatar: await imageData(profile.avatar_url),
    stats: [
      { label: "Runden", value: String(all.length) },
      { label: "Siege", value: String(all.filter((p) => p.won).length) },
      { label: "Minispiel-Rekord", value: best ? best.toLocaleString("de-DE") : "–" },
    ],
  })
}
