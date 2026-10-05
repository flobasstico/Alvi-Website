import Link from "next/link"
import { ChannelLinks } from "@/components/channel-links"
import { BingoIcon, GoldBarsIcon, MapIcon, WheelIcon } from "@/components/tile-icons"
import { getCurrentSeason } from "@/lib/season"
import { channelsFromSettings, loadSiteSettings } from "@/lib/site"
import { createClient } from "@/lib/supabase/server"

const TOOLS = [
  { href: "/eskalation", emoji: "🚨", title: "Regel-Eskalation", text: "Grundregel per Glücksrad, alle 4 Minuten eine neue Regel – mit Alarm und OBS-Overlay." },
  { href: "/auktion", emoji: "🪙", title: "Loot-Auktion", text: "2–8 Creator bieten verdeckt mit Gold auf Items – bis jeder sein Loadout hat." },
  { href: "/bingo", emoji: "🔢", title: "Bingo", text: "Alle spielen dieselbe 3×3-Karte und haken für sich ab – mit eigenen Karten, Punkten und OBS-Overlay." },
  { href: "/loadout", emoji: "🎲", title: "Loadout-Würfel", text: "5 zufällige Slots aus dem aktuellen Loot-Pool – solo oder mit mehreren Spielern." },
  { href: "/rad", emoji: "🎡", title: "Challenge-Glücksrad", text: "Regeln wie „nur graue Waffen“ oder „kein Bauen“ – live erdreht." },
  { href: "/drop", emoji: "🪂", title: "Drop-Spot-Roulette", text: "Zufälliger Landebereich als Kreis – solo oder für mehrere Spieler, plus Zusatzregel." },
  { href: "/winchallenge", emoji: "🏆", title: "Winchallenge", text: "Mehrere Spiele, je eine Zahl an Siegen, ein Timer – alles schaffen, bevor die Zeit abläuft. Mit OBS-Overlay." },
  { href: "/olympiade", emoji: "🥇", title: "Olympiade", text: "Spiele aufs Glücksrad, drehen, extern spielen, Sieger markieren – jedes Spiel ist einen Punkt mehr wert. Mit OBS-Overlay." },
]

export default async function Home() {
  const supabase = await createClient()
  const [{ data: active }, settings, season] = await Promise.all([
    supabase.from("challenges").select("id, title").eq("status", "aktiv").order("played_at", { ascending: false }).limit(3),
    loadSiteSettings(supabase),
    getCurrentSeason(supabase),
  ])
  // Bild-Icons statt Emojis; Drop-Spot zeigt die hochgeladene Karte der aktuellen Season
  const icons: Record<string, React.ReactNode> = {
    "/rad": <WheelIcon />,
    "/drop": <MapIcon url={season?.map_image_url} />,
    "/bingo": <BingoIcon />,
    "/auktion": <GoldBarsIcon />,
  }
  const channels = channelsFromSettings(settings)

  return (
    <div className="flex flex-col gap-8">
      <section className="panel relative overflow-hidden py-10 text-center">
        <h1 className="font-display text-5xl text-accent drop-shadow-lg sm:text-7xl">ALVI CHALLENGES</h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-muted">
          Hier werden Fortnite-Challenges gebaut, ausgewürfelt und gnadenlos getrackt.
        </p>
        {channels.length > 0 && (
          <div className="mt-5 flex items-center justify-center gap-3">
            <ChannelLinks channels={channels} />
          </div>
        )}
      </section>

      {active && active.length > 0 && (
        <section className="panel border-accent-2/60">
          <h2 className="mb-2 font-display text-xl text-accent-2">Läuft gerade</h2>
          <ul className="flex flex-col gap-1">
            {active.map((c) => (
              <li key={c.id} className="font-semibold">▶ {c.title}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="panel group transition hover:-translate-y-1 hover:border-accent">
            <div className="flex h-12 items-center text-4xl">{icons[t.href] ?? t.emoji}</div>
            <h2 className="mt-2 font-display text-2xl group-hover:text-accent">{t.title}</h2>
            <p className="text-sm text-muted">{t.text}</p>
          </Link>
        ))}
        {/* Noch in Arbeit: leere Kachel mit Banner, nicht klickbar */}
        <div className="panel relative flex min-h-40 cursor-not-allowed flex-col overflow-hidden" aria-disabled="true">
          <div className="text-4xl grayscale">🏔️</div>
          <h2 className="mt-2 font-display text-2xl">Die ultimative Challenge</h2>
          <div className="mt-auto flex justify-center pt-4">
            <span className="-rotate-3 rounded-lg bg-accent px-5 py-1.5 font-display text-xl text-black shadow-[0_0_24px_rgba(255,214,10,.45)]">
              Bald verfügbar
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
