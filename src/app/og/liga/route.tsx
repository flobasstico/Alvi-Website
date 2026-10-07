import { leagueTable } from "@/lib/league"
import { loadLeague } from "@/lib/league-server"
import { ogImage, ogSupabase } from "@/lib/og"

export const revalidate = 600

/** Creator-Liga: die Top 3 der ewigen Tabelle */
export async function GET() {
  const { creators, challenges, results } = await loadLeague(ogSupabase())
  const top = leagueTable(challenges, results, creators).slice(0, 3)
  return ogImage({
    kicker: "Creator-Liga",
    title: top[0] ? `${top[0].name} führt!` : "Creator-Liga",
    subtitle: `Ewige Tabelle aus ${challenges.length} Challenges – wer ist der beste Creator?`,
    stats: top.map((r, i) => ({ label: `${i + 1}. ${r.name}`, value: `${r.leaguePoints} Pkt.` })),
  })
}
