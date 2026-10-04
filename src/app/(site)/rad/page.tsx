import { PageTitle } from "@/components/page-title"
import { getViewer } from "@/lib/supabase/server"
import { Wheel } from "./wheel"

export const metadata = { title: "Glücksrad" }

export default async function RadPage() {
  const { supabase, isAdmin } = await getViewer()
  const { data: rules } = await supabase
    .from("rules")
    .select("id, text, weight")
    .eq("category", "rad")
    .eq("active", true)
    .order("id")

  return (
    <>
      <PageTitle title="Challenge-Glücksrad" subtitle="Dreh am Rad – die Regel gilt für die nächste Runde. Mehrfach drehen stapelt die Regeln." />
      {rules && rules.length >= 2 ? (
        <Wheel rules={rules} isAdmin={isAdmin} />
      ) : (
        <p className="panel">Mindestens zwei aktive Regeln nötig – im Admin-Bereich anlegen.</p>
      )}
    </>
  )
}
