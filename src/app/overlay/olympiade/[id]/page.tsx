import { notFound } from "next/navigation"
import { fetchOlympic } from "@/lib/olympiade-live"
import { createClient } from "@/lib/supabase/server"
import { OlympicOverlay } from "../overlay"

export const metadata = { title: "Olympiade (Overlay)" }
export const dynamic = "force-dynamic"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isInteger(id)) notFound()
  const initial = await fetchOlympic(await createClient(), id).catch(() => null)
  if (!initial) notFound()
  return (
    <>
      <style>{`html, body { background: transparent !important; min-height: 0; }`}</style>
      <OlympicOverlay initial={initial} follow={false} />
    </>
  )
}
