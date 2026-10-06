import Link from "next/link"
import { PageTitle } from "@/components/page-title"
import { StaleNote } from "@/components/replay-button"
import { RARITIES, RARITY_LABEL } from "@/lib/constants"
import { getViewer } from "@/lib/supabase/server"
import { createAuction } from "./actions"

export const metadata = { title: "Loot-Auktion" }

const STATUS: Record<string, string> = { lobby: "Lobby", laeuft: "Läuft", beendet: "Beendet" }

export default async function AuktionPage() {
  const { supabase, user, isAdmin } = await getViewer()
  const { data: auctions } = await supabase.from("auctions").select("*").eq("official", true).order("created_at", { ascending: false }).limit(30)
  const ids = (auctions ?? []).map((a) => a.id)
  const { data: players } = ids.length
    ? await supabase.from("auction_players").select("auction_id, display_name, seat").in("auction_id", ids).order("seat")
    : { data: [] }

  return (
    <>
      <PageTitle
        title="Loot-Auktion"
        subtitle="Vier Creator, je 500 Gold. Ein zufälliges Item erscheint – alle bieten verdeckt. Wer am meisten bietet, bekommt es. Bis jeder 5 Items hat."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="panel">
          <h2 className="mb-1 font-display text-2xl">Auktionen</h2>
          <StaleNote game="auktion" className="mb-3 text-xs text-muted" />
          <ul className="flex flex-col gap-2">
            {auctions?.map((a) => (
              <li key={a.id}>
                <Link href={`/auktion/${a.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-bg/40 p-3 hover:border-accent">
                  <span className="font-display text-xl">{a.title ?? `Auktion #${a.id}`}</span>
                  <span className="text-sm text-muted">
                    {(players ?? []).filter((p) => p.auction_id === a.id).map((p) => p.display_name).join(" · ") || "noch leer"}
                  </span>
                  <span className="chip ml-auto">{STATUS[a.status]}</span>
                </Link>
              </li>
            ))}
            {!auctions?.length && <li className="text-muted">Noch keine Auktionen.</li>}
          </ul>
        </section>

        {!user && <aside className="panel h-fit text-muted">Mit Twitch einloggen, um eine eigene Auktion zu eröffnen.</aside>}
        {user && (
          <aside className="panel h-fit">
            <h2 className="mb-3 font-display text-2xl">Neue Auktion</h2>
            {!isAdmin && (
              <p className="mb-3 text-xs text-muted">Auktionen ohne Admin erscheinen nicht in Übersichten und Stats und werden nach dem Ende nicht gespeichert.</p>
            )}
            <form action={createAuction} className="flex flex-col gap-3">
              <div>
                <label className="label" htmlFor="title">Titel (optional)</label>
                <input id="title" name="title" className="input" placeholder="z. B. Creator-Auktion #1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="start_gold">Startgold</label>
                  <input id="start_gold" name="start_gold" type="number" min={0} max={100000} step={10} defaultValue={500} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="items_per_player">Items pro Spieler</label>
                  <input id="items_per_player" name="items_per_player" type="number" min={1} max={10} defaultValue={5} className="input" />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="max_players">Spieler (max.)</label>
                <input id="max_players" name="max_players" type="number" min={2} max={8} defaultValue={4} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="bid_seconds">Bietzeit pro Item (Sekunden, 0 = unbegrenzt)</label>
                <input id="bid_seconds" name="bid_seconds" type="number" min={0} max={600} defaultValue={30} className="input" />
                <p className="mt-1 text-xs text-muted">Wer bis Ablauf nicht handelt, skippt automatisch.</p>
              </div>
              <fieldset>
                <legend className="label">Seltenheiten im Pool</legend>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {RARITIES.map((r) => (
                    <label key={r} className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" name={`rarity_${r}`} defaultChecked /> {RARITY_LABEL[r]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="no_duplicates" /> Keine Duplikate (gewonnene Items kommen nicht nochmal)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="host_plays" defaultChecked /> Ich spiele selbst mit
              </label>
              <button className="btn-primary">Lobby öffnen</button>
            </form>
          </aside>
        )}
      </div>
    </>
  )
}
