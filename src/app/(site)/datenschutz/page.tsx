import { LegalText } from "@/components/legal-text"
import { PageTitle } from "@/components/page-title"
import { loadSiteSettings } from "@/lib/site"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Datenschutzerklärung" }

export default async function Page() {
  const text = (await loadSiteSettings(await createClient())).get("datenschutz") ?? ""
  return (
    <>
      <PageTitle title="Datenschutzerklärung" />
      {text.trim() ? <LegalText text={text} /> : <p className="panel text-muted">Noch nicht ausgefüllt.</p>}
    </>
  )
}
