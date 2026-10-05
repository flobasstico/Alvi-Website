import Link from "next/link"
import { ChannelLinks } from "@/components/channel-links"
import { channelsFromSettings, loadSiteSettings } from "@/lib/site"
import { createClient } from "@/lib/supabase/server"

const TOOLS = [
  { href: "/rad", emoji: "🎡", title: "Challenge-Glücksrad", text: "Regeln wie „nur graue Waffen“ oder „kein Bauen“ – live erdreht." },
  { href: "/loadout", emoji: "🎲", title: "Loadout-Würfel", text: "5 zufällige Slots aus dem aktuellen Loot-Pool – solo oder mit mehreren Spielern." },
  { href: "/drop", emoji: "🪂", title: "Drop-Spot-Roulette", text: "Zufälliger Landebereich als Kreis – solo oder für mehrere Spieler, plus Zusatzregel." },
  { href: "/bingo", emoji: "🔢", title: "Bingo", text: "3×3-Karte mit Aufgaben – Zuschauer spielen live mit." },
  { href: "/auktion", emoji: "🪙", title: "Loot-Auktion", text: "2–8 Creator bieten verdeckt mit Gold auf Items – bis jeder sein Loadout hat." },
  { href: "/eskalation", emoji: "🚨", title: "Regel-Eskalation", text: "Grundregel per Glücksrad, alle 4 Minuten eine neue Regel – mit Alarm und OBS-Overlay." },
]

export default async function Home() {
  const supabase = await createClient()
  const [{ data: active }, settings] = await Promise.all([
    supabase.from("challenges").select("id, title").eq("status", "aktiv").order("played_at", { ascending: false }).limit(3),
    loadSiteSettings(supabase),
  ])
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
            <div className="text-4xl">{t.emoji}</div>
            <h2 className="mt-2 font-display text-2xl group-hover:text-accent">{t.title}</h2>
            <p className="text-sm text-muted">{t.text}</p>
          </Link>
        ))}
      </section>
    </div>
  )
}
