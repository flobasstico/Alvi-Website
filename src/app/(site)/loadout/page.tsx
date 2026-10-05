import clsx from "clsx"
import Link from "next/link"
import { PageTitle } from "@/components/page-title"
import { getCurrentSeason } from "@/lib/season"
import { getViewer } from "@/lib/supabase/server"
import { CreateLoadoutSession } from "./create-session"
import { LoadoutDice } from "./loadout-dice"

export const metadata = { title: "Loadout-Würfel" }

const STATUS: Record<string, string> = { offen: "Würfeln läuft", laeuft: "Läuft", beendet: "Beendet" }

export default async function LoadoutPage({ searchParams }: { searchParams: Promise<{ modus?: string }> }) {
  const { modus } = await searchParams
  const multi = modus === "mehrspieler"
  const { supabase, isAdmin, profile } = await getViewer()
  const season = await getCurrentSeason(supabase)

  return (
    <>
      <PageTitle
        title="Loadout-Würfel"
        subtitle={
          multi
            ? "Jeder Mitspieler würfelt sein eigenes Loadout (höchstens 3 Würfe). Mit Start sind alle Loadouts fest, am Ende wählt der Host den Sieger."
            : `5 Slots aus dem Loot-Pool${season ? ` von „${season.name}“` : ""}. Slots sperren, einzeln neu würfeln – höchstens 3 Würfe, dann ist das Loadout fest.`
        }
      />
      <nav className="mb-6 flex gap-2">
        <Link href="/loadout" className={clsx("btn px-4 py-2", multi ? "btn-secondary" : "bg-accent text-black")}>🎲 Solo</Link>
        <Link href="/loadout?modus=mehrspieler" className={clsx("btn px-4 py-2", multi ? "bg-accent text-black" : "btn-secondary")}>
          👥 Mehrspieler
        </Link>
      </nav>
      {multi ? <MultiplayerList isAdmin={isAdmin} supabase={supabase} /> : <Solo seasonId={season?.id ?? null} isAdmin={isAdmin} supabase={supabase} login={profile?.twitch_login ?? null} />}
    </>
  )
}

type Client = Awaited<ReturnType<typeof getViewer>>["supabase"]

async function Solo({ seasonId, isAdmin, supabase, login }: { seasonId: number | null; isAdmin: boolean; supabase: Client; login: string | null }) {
  const { data: items } = seasonId
    ? await supabase.from("loot_items").select("id, name, rarity, type, icon_url").eq("season_id", seasonId).eq("active", true)
    : { data: [] }
  return <LoadoutDice items={items ?? []} isAdmin={isAdmin} overlayLogin={login} />
}

async function MultiplayerList({ isAdmin, supabase }: { isAdmin: boolean; supabase: Client }) {
  const [{ data: sessions }, { data: players }] = await Promise.all([
    supabase.from("loadout_sessions").select("*").order("created_at", { ascending: false }).limit(30),
    supabase.from("loadout_players").select("session_id"),
  ])
  const count = new Map<number, number>()
  for (const p of players ?? []) count.set(p.session_id, (count.get(p.session_id) ?? 0) + 1)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="panel">
        <h2 className="mb-3 font-display text-2xl">Runden</h2>
        <ul className="flex flex-col gap-2">
          {sessions?.map((s) => (
            <li key={s.id}>
              <Link href={`/loadout/${s.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-bg/40 p-3 hover:border-accent">
                <span className="font-display text-xl">{s.title ?? `Runde #${s.id}`}</span>
                <span className="text-sm text-muted">👥 {count.get(s.id) ?? 0}</span>
                <span className="chip ml-auto">
                  {STATUS[s.status]}
                  {s.winner_name && ` · 🏆 ${s.winner_name}`}
                </span>
              </Link>
            </li>
          ))}
          {!sessions?.length && <li className="text-muted">Noch keine Runden.</li>}
        </ul>
      </section>
      {isAdmin && (
        <aside className="panel h-fit">
          <h2 className="mb-3 font-display text-2xl">Neue Runde</h2>
          <CreateLoadoutSession />
        </aside>
      )}
    </div>
  )
}
