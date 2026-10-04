import clsx from "clsx"
import Link from "next/link"
import { PageTitle } from "@/components/page-title"
import {
  ITEM_TYPE_LABEL,
  ITEM_TYPES,
  RARITIES,
  RARITY_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
  STATUSES,
  type Rarity,
  type Source,
} from "@/lib/constants"
import { getCurrentSeason } from "@/lib/season"
import { getViewer } from "@/lib/supabase/server"
import {
  addBingoTask,
  addEscalationRules,
  addLoot,
  addManualChallenge,
  addRule,
  addSeason,
  deleteRow,
  setCurrentSeason,
  setRuleWeight,
  toggleActive,
  updateChallenge,
  updateEscalationRule,
  updateLootItem,
} from "./actions"
import { ItemIconUpload } from "./item-icon-upload"
import { LootImport } from "./loot-import"
import { MapUpload } from "./map-upload"
import { SpotEditor } from "./spot-editor"

export const metadata = { title: "Admin" }

const TABS = {
  challenges: "Challenges",
  regeln: "Regeln",
  loot: "Loot-Pool",
  spots: "Drop-Spots",
  bingo: "Bingo-Aufgaben",
  eskalation: "Eskalations-Regeln",
  seasons: "Seasons & Map",
} as const
type Tab = keyof typeof TABS

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { supabase, user, isAdmin } = await getViewer()
  if (!isAdmin) {
    return (
      <div className="panel">
        <h1 className="font-display text-3xl">Kein Zugriff</h1>
        <p className="text-muted">
          {user ? "Dieser Bereich ist nur für Alvi." : "Bitte mit Twitch einloggen."}
        </p>
      </div>
    )
  }
  const { tab: rawTab } = await searchParams
  const tab: Tab = rawTab && rawTab in TABS ? (rawTab as Tab) : "challenges"
  const season = await getCurrentSeason(supabase)

  return (
    <>
      <PageTitle title="Admin" subtitle={season ? `Aktuelle Season: ${season.name}` : "Keine aktuelle Season – unter „Seasons & Map“ anlegen."} />
      <nav className="mb-6 flex flex-wrap gap-1">
        {Object.entries(TABS).map(([key, label]) => (
          <Link
            key={key}
            href={`/admin?tab=${key}`}
            className={clsx("rounded-lg px-3 py-1.5 text-sm font-semibold", tab === key ? "bg-accent text-black" : "bg-panel-2 text-muted hover:text-white")}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "challenges" && <ChallengesTab />}
      {tab === "regeln" && <RulesTab />}
      {tab === "loot" && <LootTab seasonId={season?.id ?? null} />}
      {tab === "spots" && <SpotsTab seasonId={season?.id ?? null} mapUrl={season?.map_image_url ?? null} />}
      {tab === "bingo" && <BingoTab />}
      {tab === "eskalation" && <EscalationTab />}
      {tab === "seasons" && <SeasonsTab />}
    </>
  )
}

function Row({ children, inactive }: { children: React.ReactNode; inactive?: boolean }) {
  return <li className={clsx("flex flex-wrap items-center gap-2 py-2", inactive && "opacity-50")}>{children}</li>
}

function ToggleButton({ table, id, active }: { table: string; id: number; active: boolean }) {
  return (
    <form action={toggleActive}>
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={String(active)} />
      <button className="btn-secondary px-2 py-1 text-xs">{active ? "Deaktivieren" : "Aktivieren"}</button>
    </form>
  )
}

function DeleteButton({ table, id }: { table: string; id: number }) {
  return (
    <form action={deleteRow}>
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <button className="btn-danger px-2 py-1 text-xs">Löschen</button>
    </form>
  )
}

async function ChallengesTab() {
  const { supabase } = await getViewer()
  const { data } = await supabase.from("challenges").select("*").order("created_at", { ascending: false }).limit(200)
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="panel">
        <h2 className="mb-2 font-display text-2xl">Challenges</h2>
        <p className="mb-3 text-sm text-muted">Ergebnis eintragen: Status wählen, optional Video-Link, speichern.</p>
        <ul className="divide-y divide-line">
          {data?.map((c) => (
            <Row key={c.id}>
              <form action={updateChallenge} className="flex w-full flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={c.id} />
                <div className="min-w-48 flex-1">
                  <div className="font-semibold">{c.title}</div>
                  <div className="text-xs text-muted">
                    {SOURCE_LABEL[c.source as Source]} · {new Date(c.created_at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}
                  </div>
                </div>
                <select name="status" defaultValue={c.status} className="input w-auto py-1 text-sm">
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
                <input name="video_url" type="url" defaultValue={c.video_url ?? ""} placeholder="Video-URL" className="input w-48 py-1 text-sm" />
                <button className="btn-primary px-3 py-1 text-sm">Speichern</button>
              </form>
              <DeleteButton table="challenges" id={c.id} />
            </Row>
          ))}
          {!data?.length && <li className="py-2 text-muted">Noch keine Challenges.</li>}
        </ul>
      </section>
      <aside className="panel h-fit">
        <h2 className="mb-3 font-display text-xl">Manuelle Challenge</h2>
        <form action={addManualChallenge} className="flex flex-col gap-3">
          <input name="title" className="input" placeholder="Titel" required />
          <textarea name="description" className="input min-h-20" placeholder="Beschreibung (optional)" />
          <button className="btn-primary">Anlegen</button>
        </form>
      </aside>
    </div>
  )
}

async function RulesTab() {
  const { supabase } = await getViewer()
  const { data } = await supabase.from("rules").select("*").order("category").order("id")
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="panel">
        {(["rad", "drop"] as const).map((cat) => (
          <div key={cat} className="mb-6">
            <h2 className="mb-2 font-display text-2xl">{cat === "rad" ? "Glücksrad-Regeln" : "Drop-Zusatzregeln"}</h2>
            <ul className="divide-y divide-line">
              {data
                ?.filter((r) => r.category === cat)
                .map((r) => (
                  <Row key={r.id} inactive={!r.active}>
                    <span className="flex-1 font-semibold">{r.text}</span>
                    <form action={setRuleWeight} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={r.id} />
                      <label className="text-xs text-muted">Gewicht</label>
                      <input name="weight" type="number" min={1} max={10} defaultValue={r.weight} className="input w-16 py-1 text-sm" />
                      <button className="btn-secondary px-2 py-1 text-xs">OK</button>
                    </form>
                    <ToggleButton table="rules" id={r.id} active={r.active} />
                    <DeleteButton table="rules" id={r.id} />
                  </Row>
                ))}
            </ul>
          </div>
        ))}
      </section>
      <aside className="panel h-fit">
        <h2 className="mb-3 font-display text-xl">Neue Regel</h2>
        <form action={addRule} className="flex flex-col gap-3">
          <input name="text" className="input" placeholder="z. B. Nur graue Waffen" required />
          <select name="category" className="input">
            <option value="rad">Glücksrad</option>
            <option value="drop">Drop-Zusatzregel</option>
          </select>
          <div>
            <label className="label">Gewicht (1–10, höher = häufiger)</label>
            <input name="weight" type="number" min={1} max={10} defaultValue={1} className="input" />
          </div>
          <button className="btn-primary">Hinzufügen</button>
        </form>
      </aside>
    </div>
  )
}

async function LootTab({ seasonId }: { seasonId: number | null }) {
  const { supabase } = await getViewer()
  const { data } = seasonId
    ? await supabase.from("loot_items").select("*").eq("season_id", seasonId).order("name")
    : { data: [] }
  const items = data ?? []
  const rarityOrder = (r: string) => RARITIES.indexOf(r as Rarity)
  // Gruppiert nach Typ und Name, jede Seltenheit mit eigenem Bild
  const groups = ITEM_TYPES.map((type) => {
    const ofType = items.filter((i) => i.type === type)
    const names = [...new Set(ofType.map((i) => i.name))]
    return {
      type,
      entries: names.map((name) => ofType.filter((i) => i.name === name).sort((a, b) => rarityOrder(a.rarity) - rarityOrder(b.rarity))),
    }
  })
  const missingIcons = items.filter((i) => !i.icon_url).length

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="panel">
        <h2 className="mb-1 font-display text-2xl">Lootpool der aktuellen Season</h2>
        <p className="mb-4 text-sm text-muted">
          {items.length} Items ({items.filter((i) => i.active).length} aktiv)
          {missingIcons > 0 && ` · ${missingIcons} Varianten ohne Bild – jede Seltenheit hat ihr eigenes Bild, zum Hochladen auf das Feld klicken`}
        </p>
        {groups.map(
          (g) =>
            g.entries.length > 0 && (
              <div key={g.type} className="mb-6">
                <h3 className="mb-2 font-display text-xl text-accent-2">{ITEM_TYPE_LABEL[g.type]}</h3>
                <ul className="divide-y divide-line">
                  {g.entries.map((variants) => {
                    const first = variants[0]
                    return (
                      <li key={first.name} className="py-3">
                        <div className="mb-2 flex flex-wrap items-baseline gap-2">
                          <span className="font-semibold">{first.name}</span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {variants.map((v) => (
                            <div key={v.id} className={clsx("flex w-24 flex-col items-center gap-1", !v.active && "opacity-40")}>
                              <ItemIconUpload itemId={v.id} current={v.icon_url} rarity={v.rarity} type={v.type} name={v.name} size="md" />
                              <details className="relative">
                                <summary
                                  className={clsx("cursor-pointer list-none select-none whitespace-nowrap text-center text-xs font-semibold", !v.active && "line-through")}
                                  title="Variante bearbeiten"
                                >
                                  {RARITY_LABEL[v.rarity as Rarity]} ✎
                                </summary>
                                <div className="absolute left-0 top-full z-20 mt-1 flex w-72 flex-col gap-2 rounded-xl border border-line bg-panel p-3 shadow-xl">
                                  <form action={updateLootItem} className="flex flex-col gap-2">
                                    <input type="hidden" name="id" value={v.id} />
                                    <input name="name" defaultValue={v.name} className="input py-1 text-sm" required />
                                    <div className="grid grid-cols-2 gap-2">
                                      <select name="rarity" defaultValue={v.rarity} className="input py-1 text-sm">
                                        {RARITIES.map((r) => (
                                          <option key={r} value={r}>{RARITY_LABEL[r]}</option>
                                        ))}
                                      </select>
                                      <select name="type" defaultValue={v.type} className="input py-1 text-sm">
                                        {ITEM_TYPES.map((t) => (
                                          <option key={t} value={t}>{ITEM_TYPE_LABEL[t]}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <button className="btn-primary py-1 text-sm">Speichern</button>
                                  </form>
                                  <div className="flex gap-2">
                                    <ToggleButton table="loot_items" id={v.id} active={v.active} />
                                    <DeleteButton table="loot_items" id={v.id} />
                                  </div>
                                </div>
                              </details>
                            </div>
                          ))}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ),
        )}
        {items.length === 0 && <p className="text-muted">Noch keine Items – rechts eine Liste einfügen.</p>}
      </section>
      <aside className="flex h-fit flex-col gap-6">
        <div className="panel">
          <h2 className="mb-3 font-display text-xl">Lootpool aktualisieren</h2>
          <LootImport disabled={!seasonId} />
        </div>
        <div className="panel">
          <h2 className="mb-3 font-display text-xl">Einzelnes Item</h2>
          <form action={addLoot} className="flex flex-col gap-3">
            <input name="name" className="input" placeholder="z. B. Pump Shotgun" required />
            <div className="grid grid-cols-2 gap-2">
              <select name="rarity" className="input">
                {RARITIES.map((r) => (
                  <option key={r} value={r}>{RARITY_LABEL[r]}</option>
                ))}
              </select>
              <select name="type" className="input">
                {ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>{ITEM_TYPE_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <button className="btn-primary" disabled={!seasonId}>Hinzufügen</button>
          </form>
        </div>
      </aside>
    </div>
  )
}

async function SpotsTab({ seasonId, mapUrl }: { seasonId: number | null; mapUrl: string | null }) {
  const { supabase } = await getViewer()
  const { data } = seasonId ? await supabase.from("drop_spots").select("*").eq("season_id", seasonId).order("name") : { data: [] }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <SpotEditor spots={data ?? []} mapUrl={mapUrl} disabled={!seasonId} />
      <section className="panel h-fit">
        <h2 className="mb-2 font-display text-2xl">Spots</h2>
        <ul className="divide-y divide-line">
          {data?.map((s) => (
            <Row key={s.id} inactive={!s.active}>
              <span className="flex-1 font-semibold">{s.name}</span>
              <ToggleButton table="drop_spots" id={s.id} active={s.active} />
              <DeleteButton table="drop_spots" id={s.id} />
            </Row>
          ))}
        </ul>
      </section>
    </div>
  )
}

async function EscalationTab() {
  const { supabase } = await getViewer()
  const { data } = await supabase.from("escalation_rules").select("*").order("id")
  const active = data?.filter((r) => r.active).length ?? 0
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="panel">
        <h2 className="mb-1 font-display text-2xl">Regelpool der Regel-Eskalation</h2>
        <p className="mb-3 text-sm text-muted">
          {data?.length ?? 0} Regeln, {active} aktiv. Grundregel und Zusatzregeln werden zufällig aus den aktiven Regeln gezogen,
          keine Regel doppelt pro Runde.
        </p>
        <ul className="divide-y divide-line">
          {data?.map((r) => (
            <Row key={r.id} inactive={!r.active}>
              <form action={updateEscalationRule} className="flex flex-1 gap-2">
                <input type="hidden" name="id" value={r.id} />
                <input name="text" defaultValue={r.text} maxLength={200} required className="input py-1 text-sm" />
                <button className="btn-secondary px-2 py-1 text-xs">Speichern</button>
              </form>
              <ToggleButton table="escalation_rules" id={r.id} active={r.active} />
              <DeleteButton table="escalation_rules" id={r.id} />
            </Row>
          ))}
          {!data?.length && <li className="py-2 text-muted">Der Pool ist noch leer – rechts Regeln hinzufügen.</li>}
        </ul>
      </section>
      <aside className="panel h-fit">
        <h2 className="mb-3 font-display text-xl">Regeln hinzufügen</h2>
        <form action={addEscalationRules} className="flex flex-col gap-3">
          <textarea name="text" className="input min-h-40" placeholder={"Eine Regel pro Zeile\nz. B. Nur graue Waffen\nKein Bauen"} required />
          <button className="btn-primary">Hinzufügen</button>
        </form>
      </aside>
    </div>
  )
}

async function BingoTab() {
  const { supabase } = await getViewer()
  const { data } = await supabase.from("bingo_tasks").select("*").order("id")
  const activeCount = data?.filter((t) => t.active).length ?? 0
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="panel">
        <h2 className="mb-1 font-display text-2xl">Bingo-Aufgaben</h2>
        <p className={clsx("mb-3 text-sm", activeCount < 25 ? "text-fail" : "text-muted")}>
          {activeCount} aktiv (mind. 25 nötig – mehr = abwechslungsreichere Zuschauer-Karten)
        </p>
        <ul className="divide-y divide-line">
          {data?.map((t) => (
            <Row key={t.id} inactive={!t.active}>
              <span className="flex-1 font-semibold">{t.text}</span>
              <ToggleButton table="bingo_tasks" id={t.id} active={t.active} />
              <DeleteButton table="bingo_tasks" id={t.id} />
            </Row>
          ))}
        </ul>
      </section>
      <aside className="panel h-fit">
        <h2 className="mb-3 font-display text-xl">Neue Aufgaben</h2>
        <form action={addBingoTask} className="flex flex-col gap-3">
          <textarea name="text" className="input min-h-32" placeholder={"Eine Aufgabe pro Zeile\nz. B. Kill mit Pickaxe"} required />
          <button className="btn-primary">Hinzufügen</button>
        </form>
      </aside>
    </div>
  )
}

async function SeasonsTab() {
  const { supabase } = await getViewer()
  const { data } = await supabase.from("seasons").select("*").order("created_at", { ascending: false })
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="panel">
        <h2 className="mb-2 font-display text-2xl">Seasons</h2>
        <ul className="divide-y divide-line">
          {data?.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1 font-semibold">{s.name}</span>
                {s.is_current ? (
                  <span className="chip border-win text-win">Aktuell</span>
                ) : (
                  <form action={setCurrentSeason}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="btn-secondary px-2 py-1 text-xs">Als aktuell setzen</button>
                  </form>
                )}
              </div>
              <MapUpload seasonId={s.id} current={s.map_image_url} />
            </li>
          ))}
        </ul>
      </section>
      <aside className="panel h-fit">
        <h2 className="mb-3 font-display text-xl">Neue Season</h2>
        <form action={addSeason} className="flex flex-col gap-3">
          <input name="name" className="input" placeholder="z. B. Kapitel 7 – Season 2" required />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="copy" defaultChecked /> Loot-Pool, Spots & Map übernehmen
          </label>
          <button className="btn-primary">Anlegen & aktivieren</button>
        </form>
      </aside>
    </div>
  )
}
