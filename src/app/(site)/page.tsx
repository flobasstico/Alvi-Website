import Link from "next/link"
import { ChannelLinks } from "@/components/channel-links"
import { Suspense } from "react"
import { HeroHighlights, HeroHighlightsSkeleton } from "@/components/hero-highlights"
import { BingoIcon, GoldBarsIcon, LeagueIcon, MapIcon, WheelIcon } from "@/components/tile-icons"
import { leagueTable } from "@/lib/league"
import { loadLeague } from "@/lib/league-server"
import { aggregatePlayers, sortPlayers } from "@/lib/player-stats"
import { loadPlayerStats } from "@/lib/player-stats-server"
import { getCurrentSeason } from "@/lib/season"
import { successRate } from "@/lib/stats"
import { channelsFromSettings, loadSiteSettings } from "@/lib/site"
import { createClient } from "@/lib/supabase/server"

const TOOLS = [
  { href: "/eskalation", emoji: "🚨", title: "Regel-Eskalation", text: "1. Regel per Glücksrad, danach alle 4 Minuten per Zufall eine extra Regel!!" },
  { href: "/auktion", emoji: "🪙", title: "Loot-Auktion", text: "Bietet, um euer Loadout zusammenzustellen! Wer geht am schlausten mit seinem Gold um?\nFür 2–8 Spieler." },
  { href: "/bingo", emoji: "🔢", title: "Bingo", text: "Alle spielen dieselbe 3×3-Karte und haken für sich ab – mit eigenen Karten und Punkten." },
  { href: "/loadout", emoji: "🎲", title: "Loadout-Würfel", text: "Stellt euer Loadout mit dem Zufallswürfel zusammen. Bis zu 3-mal neu würfeln – klug entscheiden, welche Items fix sein sollten!\nSolo oder mit bis zu 8 Spielern." },
  { href: "/rad", emoji: "🎡", title: "Challenge-Glücksrad", text: "Stellt euch eure individuellen Regeln mit dem Glücksrad zusammen!" },
  { href: "/drop", emoji: "🪂", title: "Drop-Spot-Roulette", text: "Per Zufall wird euer Landingspot entschieden! Wer holt sich den Sieg?\nExtraregeln inklusive!\nMax. 8 Spieler." },
  { href: "/winchallenge", emoji: "🏆", title: "Winchallenge", text: "Stellt euch eure eigene Winchallenge zusammen oder spielt die der Jungs nach!" },
  { href: "/olympiade", emoji: "🥇", title: "Olympiade", text: "Spiele aufs Glücksrad, drehen, extern spielen, Sieger markieren – jedes Spiel ist einen Punkt mehr wert." },
  { href: "/liga", emoji: "🏆", title: "Creator-Liga", text: "Die Challenges der Creator außerhalb der Website – mit Ligapunkten, Siegen, Videos und Kopf-an-Kopf-Duellen." },
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
    "/liga": <LeagueIcon />,
  }
  const channels = channelsFromSettings(settings)
  // Mitte der großen Kachel: Titel, Text, Kanal-Icons (am Handy darunter der Creator Code)
  const center = (
    <>
      <h1 className="font-display text-5xl text-accent drop-shadow-lg sm:text-6xl lg:text-5xl xl:text-6xl">ALVI CHALLENGES</h1>
      <p className="mx-auto mt-3 max-w-2xl whitespace-pre-line text-base text-muted sm:text-lg lg:text-base">
        {"Stellt eure eigenen Fortnite-Challenges zusammen oder spielt die eures Lieblingscreators nach!\nDie Challenges der Creator werden sogar getrackt – wer ist der Beste?"}
      </p>
      {channels.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-1 sm:gap-2">
          <ChannelLinks channels={channels} />
        </div>
      )}
      <CreatorCode className="mt-5 sm:hidden" />
    </>
  )

  return (
    <div className="flex flex-col gap-8">
      <section className="panel relative overflow-hidden py-8 text-center lg:py-6">
        {/* Liga und Stats laden nach, damit die Startseite sofort erscheint; die Mitte steht sofort */}
        <Suspense fallback={<HeroHighlightsSkeleton center={center} />}>
          <Highlights center={center} />
        </Suspense>
        {/* Unten: kleiner Link zu den Minispielen (links), Creator Code (rechts, ab Tablet) */}
        <div className="mt-5 flex flex-col items-center gap-2 px-1 sm:flex-row sm:justify-between">
          <Link href="/minispiele" className="rounded-full border border-line bg-bg/50 px-3 py-1 text-sm text-muted hover:border-accent hover:text-accent">
            🕹️ Minispiele – schlag Alvis Highscore →
          </Link>
          <CreatorCode className="hidden sm:block" />
        </div>
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
            <p className="whitespace-pre-line text-sm text-muted">{t.text}</p>
          </Link>
        ))}
      </section>
    </div>
  )
}

function CreatorCode({ className }: { className: string }) {
  return (
    <p className={`text-sm text-muted ${className}`}>
      Creator Code: <span className="font-display text-base tracking-wide text-accent">Alvivb</span>
    </p>
  )
}

/** Vorschau in der großen Kachel: Liga-Podest und Stats (aufwendigere Abfragen, darum gestreamt) */
async function Highlights({ center }: { center: React.ReactNode }) {
  const supabase = await createClient()
  const [league, players, { data: total }] = await Promise.all([
    loadLeague(supabase),
    loadPlayerStats(supabase),
    supabase.from("challenge_stats").select("won, finished").is("source", null).maybeSingle(),
  ])
  const podium = leagueTable(league.challenges, league.results, league.creators)
    .slice(0, 3)
    .map((r) => ({ id: r.creatorId, name: r.name, avatar: r.avatar, value: r.leaguePoints, color: r.color }))
  const topPlayers = sortPlayers(aggregatePlayers(players.parts, players.names), "siege")
    .filter((r) => r.wins > 0)
    .slice(0, 3)
    .map((r) => ({ id: r.userId, name: r.name, avatar: r.avatar, value: r.wins }))
  return (
    <HeroHighlights
      center={center}
      league={podium}
      challenges={league.challenges.length}
      rate={successRate(total?.won ?? 0, total?.finished ?? 0)}
      finished={total?.finished ?? 0}
      players={topPlayers}
    />
  )
}
