import { PageTitle } from "@/components/page-title"
import { ReplayBanner } from "@/components/replay-banner"
import { radRules } from "@/lib/replay"
import { getViewer } from "@/lib/supabase/server"
import { Wheel } from "./wheel"

export const metadata = { title: "Glücksrad" }

export default async function RadPage({ searchParams }: { searchParams: Promise<{ nachspielen?: string }> }) {
  const { nachspielen } = await searchParams
  const { supabase, isAdmin } = await getViewer()
  const replayId = Number(nachspielen)
  const { data: replay } = Number.isInteger(replayId) && replayId > 0
    ? await supabase.from("challenges").select("*").eq("id", replayId).eq("source", "rad").maybeSingle()
    : { data: null }
  const { data: rules } = await supabase
    .from("rules")
    .select("id, text, weight")
    .eq("category", "rad")
    .eq("active", true)
    .order("id")

  return (
    <>
      <PageTitle title="Challenge-Glücksrad" subtitle="Dreh am Rad – die Regel gilt für die nächste Runde. Mehrfach drehen stapelt die Regeln." />
      {replay && (
        <ReplayBanner title={replay.title} status={({ geschafft: "geschafft ✅", gescheitert: "gescheitert ❌" } as Record<string, string>)[replay.status] ?? replay.status} back="/rad">
          <ol className="flex flex-col gap-2">
            {radRules(replay.config).map((r, i) => (
              <li key={i} className="rounded-xl border border-accent/50 bg-accent/10 px-3 py-2 text-lg font-bold">
                {i + 1}. {r}
              </li>
            ))}
          </ol>
        </ReplayBanner>
      )}
      {rules && rules.length >= 2 ? (
        <Wheel rules={rules.map((r) => ({ ...r, weight: 1 }))} isAdmin={isAdmin} /* alle Regeln gleich wahrscheinlich */ />
      ) : (
        <p className="panel">Mindestens zwei aktive Regeln nötig – im Admin-Bereich anlegen.</p>
      )}
    </>
  )
}
