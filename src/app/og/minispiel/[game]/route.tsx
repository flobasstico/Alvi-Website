import { isMinigame, minigame } from "@/lib/minigames"
import { imageData, ogImage, ogSupabase } from "@/lib/og"

export const revalidate = 300

/**
 * Minispiel: mit ?von=<twitch-name> das persönliche Bestergebnis (aus der Datenbank, nicht aus dem Link –
 * so lässt sich nichts fälschen), sonst Tages- und ewiger Highscore.
 */
export async function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  const { game } = await params
  if (!isMinigame(game)) return new Response("Nicht gefunden", { status: 404 })
  const info = minigame(game)
  const supabase = ogSupabase()
  const von = new URL(req.url).searchParams.get("von")?.toLowerCase() ?? ""
  const [{ data: alvi }, { data: today }, { data: ever }] = await Promise.all([
    supabase.rpc("minigame_alvi_best", { p_game: game }),
    supabase.rpc("minigame_board", { p_game: game, p_period: "heute", p_limit: 1 }),
    supabase.rpc("minigame_board", { p_game: game, p_period: "ewig", p_limit: 1 }),
  ])
  const alviStat = { label: "Alvis Bestwert", value: alvi != null ? alvi.toLocaleString("de-DE") : "–" }

  if (/^[a-z0-9_]{2,25}$/.test(von)) {
    const { data: p } = await supabase
      .from("profiles")
      .select("id, display_name, twitch_login, avatar_url, is_public")
      .ilike("twitch_login", von.replace(/[%_\\]/g, "\\$&"))
      .maybeSingle()
    const { data: mine } = p?.is_public ? await supabase.rpc("minigame_profile", { p_user: p.id }) : { data: null }
    const m = mine?.find((x) => x.game === game)
    if (p && m) {
      return ogImage({
        kicker: `${info.title} · Minispiel`,
        title: `${m.best.toLocaleString("de-DE")} Punkte`,
        subtitle: `${p.display_name ?? p.twitch_login} fordert dich heraus – schaffst du mehr?`,
        avatar: await imageData(p.avatar_url),
        stats: [{ label: "Platz (ewig)", value: `#${m.rank_alltime}` }, alviStat, { label: m.beat_alvi ? "Alvi geschlagen" : "Runden", value: m.beat_alvi ? "Ja!" : String(m.plays) }],
      })
    }
  }
  return ogImage({
    kicker: "Minispiel",
    title: info.title,
    subtitle: info.text,
    stats: [
      { label: "Heute", value: today?.[0] ? `${today[0].score.toLocaleString("de-DE")}` : "–" },
      { label: "Rekord", value: ever?.[0] ? `${ever[0].score.toLocaleString("de-DE")}` : "–" },
      alviStat,
    ],
  })
}
