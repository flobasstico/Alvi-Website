import { LegalText } from "@/components/legal-text"
import { PageTitle } from "@/components/page-title"
import { loadSiteSettings } from "@/lib/site"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Impressum" }

export default async function Page() {
  const text = (await loadSiteSettings(await createClient())).get("impressum") ?? ""
  return (
    <>
      <PageTitle title="Impressum" />
      {text.trim() ? <LegalText text={text} /> : <p className="panel text-muted">Noch nicht ausgefüllt.</p>}
    </>
  )
}
