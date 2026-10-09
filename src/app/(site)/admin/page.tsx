import clsx from "clsx"
import Link from "next/link"
import { ClosePopovers } from "@/components/close-popovers"
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
import { creatorColors } from "@/lib/league"
import { checkTwitch } from "@/lib/twitch-live"
import { getCurrentSeason } from "@/lib/season"
import { loadSiteSettings, safeUrl } from "@/lib/site"
import { GAMES, gameThumbs } from "@/lib/games"
import { GameThumb } from "@/components/game-thumb"
import { getViewer } from "@/lib/supabase/server"
import {
  addBingoTask,
  addEscalationRules,
  addLoot,
  addManualChallenge,
  addRule,
  deleteCreator,
  deleteRow,
  saveCreator,
  setBanned,
  setCreatorSkin,
  setGameThumb,
  setLootActiveAll,
  moveEscalationRule,
  toggleActive,
  updateChallenge,
  updateEscalationRule,
  updateLootItem,
} from "./actions"
import { ImageUpload } from "./image-upload"
import { ItemIconUpload, ItemIconUploadAll } from "./item-icon-upload"
import { LeagueEntry } from "./league-entry"
import { LootImport } from "./loot-import"
import { DeleteAllSpots } from "./delete-all-spots"
import { MapUpload } from "./map-upload"
import { SiteSettingsForm } from "./site-settings-form"
import { SpotEditor } from "./spot-editor"

export const metadata = { title: "Admin" }

const TABS = {
  challenges: "Challenges",
  regeln: "Glücksrad",
  loot: "Loot-Pool",
  spots: "Drop-Spots",
  bingo: "Bingo-Aufgaben",
  eskalation: "Eskalations-Regeln",
  dropregeln: "Drop-Regeln",
  seite: "Seite & Kanäle",
  liga: "Creator-Liga",
  nutzer: "Nutzer",
} as const
type Tab = keyof typeof TABS

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; bearbeiten?: string }> }) {
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
  const { tab: rawTab, q, bearbeiten } = await searchParams
  const tab: Tab = rawTab && rawTab in TABS ? (rawTab as Tab) : "challenges"
  const season = await getCurrentSeason(supabase)

  return (
    <>
      <PageTitle title="Admin" subtitle={season ? `Aktuelle Season: ${season.name}` : "Keine aktuelle Season angelegt."} />
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
      {tab === "regeln" && <RulesTab category="rad" />}
      {tab === "loot" && <LootTab seasonId={season?.id ?? null} />}
      {tab === "spots" && <SpotsTab seasonId={season?.id ?? null} mapUrl={season?.map_image_url ?? null} />}
      {tab === "bingo" && <BingoTab />}
      {tab === "eskalation" && <EscalationTab />}
      {tab === "dropregeln" && <RulesTab category="drop" />}
      {tab === "seite" && <SiteTab />}
      {tab === "liga" && <LeagueTab edit={Number(bearbeiten) || null} />}
      {tab === "nutzer" && <UsersTab q={q ?? ""} />}
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

/** Regeln einer Kategorie: Glücksrad (rad) oder Drop-Zusatzregeln (drop) – je ein eigener Reiter */
async function RulesTab({ category }: { category: "rad" | "drop" }) {
  const { supabase } = await getViewer()
  const { data } = await supabase.from("rules").select("*").eq("category", category).order("id")
  const rad = category === "rad"
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="panel">
        <h2 className="mb-1 font-display text-2xl">{rad ? "Glücksrad-Regeln" : "Drop-Zusatzregeln"}</h2>
        <p className="mb-3 text-sm text-muted">
          {rad ? "Diese Regeln landen auf dem Challenge-Glücksrad." : "Extraregeln, die beim Drop-Spot-Roulette zusätzlich zum Landepunkt gezogen werden."}
        </p>
        <ul className="divide-y divide-line">
          {data?.map((r) => (
            <Row key={r.id} inactive={!r.active}>
              <span className="flex-1 font-semibold">{r.text}</span>
              <ToggleButton table="rules" id={r.id} active={r.active} />
              <DeleteButton table="rules" id={r.id} />
            </Row>
          ))}
          {!data?.length && <li className="py-2 text-muted">Noch keine Regeln – rechts hinzufügen.</li>}
        </ul>
      </section>
      <aside className="panel h-fit">
        <h2 className="mb-3 font-display text-xl">{rad ? "Neue Glücksrad-Regel" : "Neue Drop-Regel"}</h2>
        <form action={addRule} className="flex flex-col gap-3">
          <input name="text" className="input" placeholder={rad ? "z. B. Nur graue Waffen" : "z. B. Nur mit Heilung aus Truhen"} required />
          <input type="hidden" name="category" value={category} />
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
    // Ab xl reicht der rechte Kasten bis an den Bildschirmrand, damit die Bearbeiten-Fenster links Platz haben
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] xl:-mr-[calc((100vw-72rem)/2-10px)]">
      <section className="panel relative z-10">
        <ClosePopovers />
        <h2 className="mb-1 font-display text-2xl">Lootpool</h2>
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
                          {variants.length > 1 && (
                            <>
                              <ItemIconUploadAll itemId={first.id} />
                              <form action={setLootActiveAll}>
                                <input type="hidden" name="id" value={first.id} />
                                <input type="hidden" name="active" value={String(!variants.every((v) => v.active))} />
                                <button className="rounded-md bg-panel-2 px-2 py-0.5 text-xs font-semibold text-muted hover:text-white">
                                  {variants.every((v) => v.active) ? "Alle Seltenheiten deaktivieren" : "Alle Seltenheiten aktivieren"}
                                </button>
                              </form>
                            </>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {variants.map((v) => (
                            <div key={v.id} className={clsx("flex w-24 flex-col items-center gap-1", !v.active && "opacity-40")}>
                              <ItemIconUpload itemId={v.id} current={v.icon_url} rarity={v.rarity} type={v.type} name={v.name} size="md" />
                              <details data-popover className="relative">
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
    <div className="flex flex-col gap-6">
      {seasonId && (
        <section className="panel flex flex-col gap-3">
          <h2 className="font-display text-2xl">Karte</h2>
          <p className="text-sm text-muted">
            Quadratisches Bild (PNG, JPG oder WebP), z. B. ein Screenshot der Fortnite-Map. Die Karte erscheint sofort beim
            Drop-Spot-Roulette. Spots sind in Prozent der Karte gespeichert – passt die neue Karte nicht mehr zu den alten
            Spots, lösch sie und setz sie unten per Klick neu.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <MapUpload seasonId={seasonId} current={mapUrl} large />
            {!!data?.length && <DeleteAllSpots seasonId={seasonId} count={data.length} />}
          </div>
        </section>
      )}
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
    </div>
  )
}

async function EscalationTab() {
  const { supabase } = await getViewer()
  const { data } = await supabase.from("escalation_rules").select("*").order("id")
  const base = data?.filter((r) => r.kind === "grund") ?? []
  const extra = data?.filter((r) => r.kind !== "grund") ?? []
  return (
    <div className="flex flex-col gap-6">
      <EscalationPool
        kind="grund"
        title="Grundregeln"
        hint="Eine davon wird zum Start der Runde per Glücksrad gedreht."
        placeholder={"Eine Grundregel pro Zeile\nz. B. Nur Pistolen\nKein Bauen"}
        rules={base}
      />
      <EscalationPool
        kind="zusatz"
        title="Zusatzregeln"
        hint="Kommen nach jedem Timer-Ablauf dazu – per Zufall oder Chat-Abstimmung, keine Regel doppelt pro Runde."
        placeholder={"Eine Zusatzregel pro Zeile\nz. B. Keine Schilde\nKein Sprinten"}
        rules={extra}
      />
    </div>
  )
}

function EscalationPool({
  kind,
  title,
  hint,
  placeholder,
  rules,
}: {
  kind: "grund" | "zusatz"
  title: string
  hint: string
  placeholder: string
  rules: { id: number; text: string; active: boolean }[]
}) {
  const active = rules.filter((r) => r.active).length
  const other = kind === "grund" ? "zusatz" : "grund"
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="panel">
        <h2 className="mb-1 font-display text-2xl">{title}</h2>
        <p className={clsx("mb-3 text-sm", active === 0 ? "text-fail" : "text-muted")}>
          {rules.length} Regeln, {active} aktiv. {hint}
        </p>
        <ul className="divide-y divide-line">
          {rules.map((r) => (
            <Row key={r.id} inactive={!r.active}>
              <form action={updateEscalationRule} className="flex min-w-60 flex-1 gap-2">
                <input type="hidden" name="id" value={r.id} />
                <input name="text" defaultValue={r.text} maxLength={200} required className="input py-1 text-sm" />
                <button className="btn-secondary px-2 py-1 text-xs">Speichern</button>
              </form>
              <form action={moveEscalationRule}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="kind" value={other} />
                <button className="btn-secondary px-2 py-1 text-xs" title="In den anderen Pool verschieben">
                  {other === "grund" ? "→ Grundregel" : "→ Zusatzregel"}
                </button>
              </form>
              <ToggleButton table="escalation_rules" id={r.id} active={r.active} />
              <DeleteButton table="escalation_rules" id={r.id} />
            </Row>
          ))}
          {!rules.length && <li className="py-2 text-muted">Noch leer – rechts Regeln hinzufügen.</li>}
        </ul>
      </section>
      <aside className="panel h-fit">
        <h2 className="mb-3 font-display text-xl">{title} hinzufügen</h2>
        <form action={addEscalationRules} className="flex flex-col gap-3">
          <input type="hidden" name="kind" value={kind} />
          <textarea name="text" className="input min-h-32" placeholder={placeholder} required />
          <button className="btn-primary">Hinzufügen</button>
        </form>
      </aside>
    </div>
  )
}

async function BingoTab() {
  const { supabase } = await getViewer()
  const [{ data }, { count: pending }] = await Promise.all([
    supabase.from("bingo_tasks").select("*").order("id"),
    supabase.from("bingo_card_templates").select("id", { count: "exact", head: true }).eq("approved", false),
  ])
  const activeCount = data?.filter((t) => t.active).length ?? 0
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="panel">
        <h2 className="mb-1 font-display text-2xl">Bingo-Aufgaben</h2>
        <p className="mb-3 text-sm text-muted">
          {activeCount} aktiv – Vorschläge für „Leere Felder zufällig füllen“ beim Erstellen einer Karte. Karten selbst verwalten alle unter{" "}
          <Link href="/bingo/karten" className="text-accent-2 underline">Bingo-Karten</Link>.
        </p>
        {!!pending && (
          <Link href="/bingo/karten" className="mb-3 block rounded-xl border border-accent bg-accent/10 px-3 py-2 text-sm font-bold">
            🕓 {pending} {pending === 1 ? "Zuschauer-Karte wartet" : "Zuschauer-Karten warten"} auf Freigabe → prüfen
          </Link>
        )}
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

async function SiteTab() {
  const { supabase } = await getViewer()
  const [settings, season] = await Promise.all([loadSiteSettings(supabase), getCurrentSeason(supabase)])
  const thumbs = gameThumbs(settings, safeUrl)
  const channel = settings.get("main_creator_login")?.trim() || "alvivb"
  const twitch = await checkTwitch(channel)
  return (
    <div className="flex flex-col gap-6">
      {/* Prüft die Twitch-Zugangsdaten für den Live-Status auf der Startseite */}
      <section className={clsx("panel", twitch.ok ? "border-win/60" : "border-fail/60")}>
        <h2 className="mb-1 font-display text-xl">Twitch-Live-Status</h2>
        <p className={clsx("text-sm", twitch.ok ? "text-win" : "text-fail")}>
          {twitch.ok ? "✅" : "⚠️"} {twitch.message}
        </p>
        {twitch.live && (
          <p className="mt-1 text-sm text-muted">
            „{twitch.live.title}“ · {twitch.live.viewers.toLocaleString("de-DE")} Zuschauer – der Live-Hinweis ist auf der Startseite sichtbar.
          </p>
        )}
        <p className="mt-1 text-xs text-muted">Geprüfter Kanal: {channel} (Hauptkanal unten). Die Startseite fragt höchstens jede Minute neu.</p>
      </section>
      <SiteSettingsForm values={Object.fromEntries(settings)} />
      <section className="panel">
        <h2 className="mb-1 font-display text-xl">Vorschaubilder der Modi</h2>
        <p className="mb-4 text-sm text-muted">
          Für Lobby und Entdecken. Ohne eigenes Bild wird das gezeichnete Bild gezeigt. Am besten im Format 16:9 (z. B. 1280 × 720).
        </p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((g) => (
            <li key={g.slug}>
              <ImageUpload
                folder="thumbs"
                name={g.slug}
                current={thumbs[g.slug] ?? null}
                save={setGameThumb.bind(null, g.slug)}
                label={thumbs[g.slug] ? "Bild ersetzen" : "Eigenes Bild hochladen"}
                resetLabel="Gezeichnetes Bild verwenden"
                preview={
                  <div className="overflow-hidden rounded-md border border-line">
                    <GameThumb game={g} image={thumbs[g.slug]} mapUrl={season?.map_image_url} showTitle />
                  </div>
                }
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

async function UsersTab({ q }: { q: string }) {
  const { supabase } = await getViewer()
  const search = q.trim().replace(/[%_\\,()]/g, "")
  let query = supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200)
  if (search) query = query.or(`twitch_login.ilike.%${search}%,display_name.ilike.%${search}%`)
  const { data: users } = await query
  return (
    <section className="panel">
      <h2 className="mb-1 font-display text-2xl">Nutzer</h2>
      <p className="mb-3 text-sm text-muted">
        Alle, die sich mit Twitch angemeldet haben. Gesperrte können weiter zuschauen, aber nichts mehr erstellen, beitreten, abhaken oder einreichen.
        Ihre noch nicht freigegebenen Bingo-Karten werden beim Sperren gelöscht.
      </p>
      <form className="mb-3 flex gap-2">
        <input type="hidden" name="tab" value="nutzer" />
        <input name="q" defaultValue={q} className="input" placeholder="Twitch-Name suchen" />
        <button className="btn-secondary shrink-0">Suchen</button>
      </form>
      <ul className="divide-y divide-line">
        {users?.map((u) => (
          <Row key={u.id} inactive={u.banned}>
            {u.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={u.avatar_url} alt="" className="h-7 w-7 rounded-full" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-line text-xs">👤</span>
            )}
            <span className="font-semibold">{u.display_name ?? u.twitch_login}</span>
            <span className="text-xs text-muted">@{u.twitch_login}</span>
            {u.role === "admin" && <span className="chip border-accent text-accent">Admin</span>}
            {u.banned && <span className="chip border-fail text-fail">Gesperrt</span>}
            <span className="ml-auto text-xs text-muted">seit {new Date(u.created_at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}</span>
            {u.role !== "admin" && (
              <form action={setBanned}>
                <input type="hidden" name="user" value={u.id} />
                <input type="hidden" name="banned" value={String(!u.banned)} />
                <button className={clsx("px-2 py-1 text-xs", u.banned ? "btn-secondary" : "btn-danger")}>{u.banned ? "Entsperren" : "Sperren"}</button>
              </form>
            )}
          </Row>
        ))}
        {!users?.length && <li className="py-2 text-muted">Niemand gefunden.</li>}
      </ul>
    </section>
  )
}

async function LeagueTab({ edit }: { edit: number | null }) {
  const { supabase } = await getViewer()
  const [{ data: creators }, { data: cats }, editing] = await Promise.all([
    supabase.from("creators").select("*").order("name"),
    supabase.from("league_challenges").select("category").not("category", "is", null),
    edit
      ? Promise.all([
          supabase.from("league_challenges").select("*").eq("id", edit).maybeSingle(),
          supabase.from("league_results").select("*").eq("challenge_id", edit),
        ])
      : null,
  ])
  const { data: links } = await supabase
    .from("profiles")
    .select("id, twitch_login")
    .in("id", (creators ?? []).map((c) => c.profile_id).filter((x): x is string => !!x))
  const loginOf = new Map((links ?? []).map((p) => [p.id, p.twitch_login]))
  const categories = [...new Set((cats ?? []).map((c) => c.category!).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"))
  const editData = editing?.[0].data ? { challenge: editing[0].data, results: editing[1].data ?? [] } : null

  const autoColors = creatorColors(creators ?? [])

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="panel h-fit">
        <h2 className="mb-1 font-display text-2xl">{editData ? `„${editData.challenge.title}“ bearbeiten` : "Challenge eintragen"}</h2>
        <p className="mb-3 text-sm text-muted">
          Für Challenges außerhalb der Website. Erscheint unter <Link href="/liga" className="text-accent-2 underline">/liga</Link>.
          {editData && (
            <>
              {" "}
              <Link href="/admin?tab=liga" className="underline">Abbrechen</Link>
            </>
          )}
        </p>
        <LeagueEntry key={edit ?? "neu"} creators={creators ?? []} categories={categories} edit={editData} />
      </section>

      <aside className="flex flex-col gap-6">
        <section className="panel">
          <h2 className="mb-2 font-display text-xl">Creator</h2>
          <ul className="divide-y divide-line">
            {creators?.map((c) => (
              <li key={c.id} className="py-2">
                <details>
                  <summary className="flex cursor-pointer items-center gap-2">
                    {c.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-line text-xs">👤</span>
                    )}
                    <span className="flex-1 font-semibold">{c.name}</span>
                    {c.profile_id && <span className="text-xs text-muted">@{loginOf.get(c.profile_id)}</span>}
                    {!c.youtube_url && <span className="text-xs text-fail">YouTube fehlt</span>}
                  </summary>
                  <form action={saveCreator} className="mt-2 flex flex-col gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <input name="name" defaultValue={c.name} className="input py-1 text-sm" required maxLength={40} />
                    <input
                      name="youtube_url"
                      defaultValue={c.youtube_url ?? ""}
                      className="input py-1 text-sm"
                      placeholder="YouTube-Kanal (https://youtube.com/@…)"
                      required
                      pattern="https://(www\.|m\.)?(youtube\.com|youtu\.be)/.+"
                    />
                    <input name="avatar_url" defaultValue={c.avatar_url ?? ""} className="input py-1 text-sm" placeholder="Bild-Link (leer = Profilbild vom YouTube-Kanal)" />
                    <p className="text-xs text-muted">Bild-Link leeren und speichern lädt das Profilbild neu von YouTube.</p>
                    <input name="twitch" defaultValue={c.profile_id ? (loginOf.get(c.profile_id) ?? "") : ""} className="input py-1 text-sm" placeholder="Twitch-Name verknüpfen (optional)" />
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted">Farbe</span>
                      <input type="color" name="color" defaultValue={c.color ?? autoColors.get(c.id) ?? "#facc15"} className="h-7 w-10 cursor-pointer rounded border border-line bg-transparent" />
                      <label className="flex items-center gap-1 text-xs text-muted">
                        <input type="checkbox" name="color_auto" defaultChecked={!c.color} /> automatisch
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-secondary px-2 py-1 text-xs">Speichern</button>
                    </div>
                  </form>
                  <div className="mt-2 border-t border-line pt-2">
                    <div className="mb-1 text-xs font-semibold">Skin-Bild für die Lobby</div>
                    <ImageUpload
                      folder="skins"
                      name={`creator-${c.id}`}
                      current={c.skin_url}
                      save={setCreatorSkin.bind(null, c.id)}
                      label={c.skin_url ? "Skin ersetzen" : "Skin hochladen"}
                      resetLabel="Profilbild verwenden"
                      preview={
                        c.skin_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.skin_url} alt="" className="h-24 w-auto self-start object-contain" />
                        ) : (
                          <p className="text-muted">Freigestelltes PNG (transparenter Hintergrund) im Hochformat sieht am besten aus. Ohne Skin wird das Profilbild gezeigt.</p>
                        )
                      }
                    />
                  </div>
                  <form action={deleteCreator} className="mt-1">
                    <input type="hidden" name="id" value={c.id} />
                    <button className="text-xs text-muted underline hover:text-fail">Löschen (nur ohne Ergebnisse)</button>
                  </form>
                </details>
              </li>
            ))}
            {!creators?.length && <li className="py-2 text-sm text-muted">Noch keine Creator.</li>}
          </ul>
          <form action={saveCreator} className="mt-3 flex flex-col gap-2">
            <input name="name" className="input" placeholder="Name, z. B. Kevin" required maxLength={40} />
            <input
              name="youtube_url"
              className="input"
              placeholder="YouTube-Kanal (https://youtube.com/@…)"
              required
              pattern="https://(www\.|m\.)?(youtube\.com|youtu\.be)/.+"
              title="Link zum YouTube-Kanal, z. B. https://youtube.com/@alvivb"
            />
            <input name="avatar_url" className="input" placeholder="Bild-Link (leer = Profilbild vom YouTube-Kanal)" />
            <input name="twitch" className="input" placeholder="Twitch-Name verknüpfen (optional)" />
            <button className="btn-primary">+ Creator anlegen</button>
          </form>
        </section>

      </aside>
    </div>
  )
}
