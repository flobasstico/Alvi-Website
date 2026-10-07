import type { createClient } from "@/lib/supabase/server"

type Client = Awaited<ReturnType<typeof createClient>>

/** Name, der statt eines privaten Profils in Übersichten steht */
export const PRIVATE_NAME = "🔒 Privat"

/** Welche dieser Personen haben ein privates Profil? (in Paketen, damit die URL kurz bleibt) */
export async function privateIds(supabase: Client, ids: readonly (string | null | undefined)[]): Promise<Set<string>> {
  const list = [...new Set(ids.filter((x): x is string => !!x))]
  const out = new Set<string>()
  for (let i = 0; i < list.length; i += 150) {
    const { data } = await supabase.from("profiles").select("id").in("id", list.slice(i, i + 150)).eq("is_public", false)
    for (const p of data ?? []) out.add(p.id)
  }
  return out
}
