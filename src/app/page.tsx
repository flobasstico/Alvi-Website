import Link from "next/link"
import { rateQuip, successRate } from "@/lib/stats"
import { createClient } from "@/lib/supabase/server"

const TOOLS = [
  { href: "/rad", emoji: "🎡", title: "Challenge-Glücksrad", text: "Regeln wie „nur graue Waffen“ oder „kein Bauen“ – live erdreht." },
  { href: "/loadout", emoji: "🎲", title: "Loadout-Würfel", text: "5 zufällige Slots aus dem aktuellen Loot-Pool." },
  { href: "/drop", emoji: "🪂", title: "Drop-Spot-Roulette", text: "Zufälliger Landeort plus Zusatzregel." },
  { href: "/voting", emoji: "🗳️", title: "Community-Voting", text: "Challenges einreichen & voten – die Top 3 der Woche muss Alvi spielen." },
  { href: "/versus", emoji: "⚔️", title: "Versus-Scoreboard", text: "Duelle gegen andere Creator mit Punktestand, Timer und Checkliste." },
  { href: "/bingo", emoji: "🔢", title: "Bingo", text: "5×5-Karte mit Aufgaben – Zuschauer spielen live mit." },
  { href: "/stats", emoji: "📉", title: "Challenge-Stats", text: "Erfolgsquote, Serien und alle bisherigen Challenges." },
]

export default async function Home() {
  const supabase = await createClient()
  const [{ data: total }, { data: active }] = await Promise.all([
    supabase.from("challenge_stats").select("*").is("source", null).maybeSingle(),
    supabase.from("challenges").select("id, title").eq("status", "aktiv").order("played_at", { ascending: false }).limit(3),
  ])
  const rate = successRate(total?.won ?? 0, total?.finished ?? 0)

  return (
    <div className="flex flex-col gap-8">
      <section className="panel relative overflow-hidden py-10 text-center">
        <h1 className="font-display text-5xl text-accent drop-shadow-lg sm:text-7xl">ALVI CHALLENGES</h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-muted">
          Hier werden Fortnite-Challenges gebaut, ausgewürfelt und gnadenlos getrackt.
        </p>
        <Link href="/stats" className="mt-6 inline-block">
          <span className="font-display text-3xl">
            Alvi hat <span className={rate >= 50 ? "text-win" : "text-accent"}>{rate} %</span> geschafft
          </span>
          <span className="block text-sm italic text-muted">{rateQuip(rate, total?.finished ?? 0)}</span>
        </Link>
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
