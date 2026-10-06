"use client"

import clsx from "clsx"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { isYoutubeUrl, type Creator, type LeagueChallenge, type LeagueResult, type LeagueSeason } from "@/lib/league"
import { createClient } from "@/lib/supabase/client"

type Entry = { on: boolean; won: boolean; points: string; placement: string }
const EMPTY: Entry = { on: false, won: false, points: "", placement: "" }

/** Liga-Challenge eintragen oder bearbeiten: Teilnehmer ankreuzen, dann Sieger bzw. Punkte */
export function LeagueEntry({
  seasons,
  creators,
  categories,
  edit,
}: {
  seasons: LeagueSeason[]
  creators: Creator[]
  categories: string[]
  edit: { challenge: LeagueChallenge; results: LeagueResult[] } | null
}) {
  const router = useRouter()
  const current = seasons.find((s) => s.is_current) ?? seasons[0]
  const [season, setSeason] = useState(edit?.challenge.season_id ?? current?.id ?? 0)
  const [title, setTitle] = useState(edit?.challenge.title ?? "")
  const [video, setVideo] = useState(edit?.challenge.youtube_url ?? "")
  const [category, setCategory] = useState(edit?.challenge.category ?? "")
  const [date, setDate] = useState(edit?.challenge.played_at ?? new Date().toISOString().slice(0, 10))
  const [scoring, setScoring] = useState<"sieg" | "punkte">((edit?.challenge.scoring as "sieg" | "punkte") ?? "sieg")
  const [entries, setEntries] = useState<Record<number, Entry>>(() =>
    Object.fromEntries(
      creators.map((c) => {
        const r = edit?.results.find((x) => x.creator_id === c.id)
        return [c.id, { on: !!r, won: !!r?.won, points: r?.points != null ? String(r.points) : "", placement: r && !r.won ? String(r.placement) : "" }]
      }),
    ),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Neu angelegte Creator sind noch nicht im Zustand → leerer Eintrag
  const get = (id: number) => entries[id] ?? EMPTY
  const set = (id: number, patch: Partial<Entry>) => setEntries((e) => ({ ...e, [id]: { ...(e[id] ?? EMPTY), ...patch } }))
  const players = creators.filter((c) => get(c.id).on)
  const videoOk = isYoutubeUrl(video)

  async function save() {
    setBusy(true)
    setError(null)
    const results = players.map((c) => {
      const e = get(c.id)
      return scoring === "punkte"
        ? { creator_id: c.id, points: e.points === "" ? null : Number(e.points) }
        : { creator_id: c.id, won: e.won, placement: e.won || e.placement === "" ? null : Number(e.placement) }
    })
    const { error } = await createClient().rpc("league_save_challenge", {
      p_id: edit?.challenge.id ?? null,
      p_season: season,
      p_title: title,
      p_category: category || null,
      p_played_at: date || null,
      p_scoring: scoring,
      p_video: video.trim(),
      p_results: results,
    })
    setBusy(false)
    if (error) return setError(error.message)
    router.push("/liga")
    router.refresh()
  }

  if (!seasons.length) return <p className="text-muted">Zuerst rechts eine Liga-Season anlegen.</p>
  if (creators.length < 2) return <p className="text-muted">Zuerst mindestens zwei Creator anlegen.</p>

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="lg-title">Titel</label>
          <input id="lg-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="input" placeholder="z. B. Boxfight-Turnier" />
        </div>
        <div>
          <label className="label" htmlFor="lg-video">YouTube-Link (Pflicht)</label>
          <input
            id="lg-video"
            value={video}
            onChange={(e) => setVideo(e.target.value)}
            className={clsx("input", video && !videoOk && "border-fail")}
            placeholder="https://youtu.be/…"
            inputMode="url"
          />
          {video && !videoOk && <p className="mt-1 text-xs text-fail">Nur Links zu youtube.com oder youtu.be (mit https://)</p>}
        </div>
        <div>
          <label className="label" htmlFor="lg-cat">Kategorie (optional)</label>
          <input id="lg-cat" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={40} className="input" list="lg-cats" placeholder="z. B. Boxfights" />
          <datalist id="lg-cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="lg-date">Datum</label>
            <input id="lg-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="lg-season">Season</label>
            <select id="lg-season" value={season} onChange={(e) => setSeason(Number(e.target.value))} className="input">
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <fieldset>
        <legend className="label">Wertung</legend>
        <div className="flex gap-1 text-sm">
          {(["sieg", "punkte"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={clsx("rounded-lg px-3 py-1.5 font-semibold", scoring === s ? "bg-accent text-black" : "bg-panel-2 text-muted hover:text-white")}
              onClick={() => setScoring(s)}
            >
              {s === "sieg" ? "🏆 Sieger" : "🔢 Punkte"}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">
          {scoring === "sieg"
            ? "Sieger markieren (Gleichstand: mehrere). Optional Platz 2, 3 … eintragen, alle anderen landen auf dem letzten Platz."
            : "Punkte je Teilnehmer eintragen – die Rangfolge ergibt die Plätze und damit die Ligapunkte."}
        </p>
      </fieldset>

      <div>
        <span className="label">Teilnehmer ({players.length})</span>
        <ul className="flex flex-col gap-1.5">
          {creators.map((c) => {
            const e = get(c.id)
            return (
              <li key={c.id} className={clsx("flex flex-wrap items-center gap-2 rounded-xl border px-3 py-1.5", e.on ? "border-accent/60 bg-accent/5" : "border-line")}>
                <label className="flex flex-1 items-center gap-2 font-semibold">
                  <input type="checkbox" checked={e.on} onChange={(ev) => set(c.id, { on: ev.target.checked })} />
                  {c.name}
                </label>
                {e.on &&
                  (scoring === "sieg" ? (
                    <>
                      <button
                        type="button"
                        className={clsx("rounded-lg px-2.5 py-1 text-sm font-bold", e.won ? "bg-accent text-black" : "bg-panel-2 text-muted hover:text-white")}
                        onClick={() => set(c.id, { won: !e.won })}
                      >
                        🏆 Sieger
                      </button>
                      {!e.won && (
                        <input
                          type="number"
                          min={2}
                          max={20}
                          value={e.placement}
                          onChange={(ev) => set(c.id, { placement: ev.target.value })}
                          className="input w-20 py-1 text-sm"
                          placeholder="Platz"
                          aria-label={`Platz ${c.name}`}
                        />
                      )}
                    </>
                  ) : (
                    <input
                      type="number"
                      value={e.points}
                      onChange={(ev) => set(c.id, { points: ev.target.value })}
                      className="input w-24 py-1 text-sm"
                      placeholder="Punkte"
                      aria-label={`Punkte ${c.name}`}
                    />
                  ))}
              </li>
            )
          })}
        </ul>
      </div>

      <button className="btn-primary" onClick={save} disabled={busy || !title.trim() || !videoOk || players.length < 2}>
        {busy ? "Speichert…" : edit ? "Änderungen speichern" : "Challenge eintragen"}
      </button>
      {error && <p className="text-sm text-fail">{error}</p>}
    </div>
  )
}
