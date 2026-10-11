"use client"

import clsx from "clsx"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { isYoutubeUrl, type Creator, type LeagueChallenge, type LeagueResult, type LeagueVideo } from "@/lib/league"
import { createClient } from "@/lib/supabase/client"

type Entry = { on: boolean; won: boolean; placement: string }
type VideoRow = { creatorId: number | null; url: string }
/** Für die Doppel-Warnung: bisherige Challenges mit Datum und Teilnehmern */
export type ExistingChallenge = { id: number; title: string; played_at: string; creatorIds: number[] }
const EMPTY: Entry = { on: false, won: false, placement: "" }

/** Liga-Challenge eintragen oder bearbeiten: Teilnehmer ankreuzen, Sieger und optional Plätze */
export function LeagueEntry({
  creators,
  categories,
  edit,
  existing,
  defaultChannel,
}: {
  creators: Creator[]
  categories: string[]
  edit: { challenge: LeagueChallenge; results: LeagueResult[]; videos: LeagueVideo[] } | null
  existing: ExistingChallenge[]
  /** Kanal, der beim neuen Eintrag vorausgewählt ist (Alvi) */
  defaultChannel: number | null
}) {
  const router = useRouter()
  const [title, setTitle] = useState(edit?.challenge.title ?? "")
  // Ein Video pro Kanal; ältere Einträge haben nur den Hauptlink (dann Alvis Kanal vorauswählen)
  const [videos, setVideos] = useState<VideoRow[]>(() =>
    edit?.videos.length
      ? edit.videos.map((v) => ({ creatorId: v.creator_id, url: v.url }))
      : [{ creatorId: defaultChannel, url: edit?.challenge.youtube_url ?? "" }],
  )
  const [category, setCategory] = useState(edit?.challenge.category ?? "")
  const [date, setDate] = useState(edit?.challenge.played_at ?? new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }))
  const [entries, setEntries] = useState<Record<number, Entry>>(() =>
    Object.fromEntries(
      creators.map((c) => {
        const r = edit?.results.find((x) => x.creator_id === c.id)
        return [c.id, { on: !!r, won: !!r?.won, placement: r && !r.won ? String(r.placement) : "" }]
      }),
    ),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Neu angelegte Creator sind noch nicht im Zustand → leerer Eintrag
  const get = (id: number) => entries[id] ?? EMPTY
  const set = (id: number, patch: Partial<Entry>) => setEntries((e) => ({ ...e, [id]: { ...(e[id] ?? EMPTY), ...patch } }))
  const players = creators.filter((c) => get(c.id).on)
  const setVideo = (i: number, patch: Partial<VideoRow>) => setVideos((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)))
  const filled = videos.filter((v) => v.url.trim())
  const channelIds = filled.map((v) => v.creatorId)
  const videosOk =
    filled.length > 0 &&
    filled.every((v) => v.creatorId !== null && isYoutubeUrl(v.url)) &&
    new Set(channelIds).size === channelIds.length &&
    videos.every((v) => !v.url.trim() || isYoutubeUrl(v.url))
  // Gleiche Runde schon eingetragen (gleicher Tag, gleiche Teilnehmer)? Dann besser dort das Video ergänzen
  const playerIds = players.map((c) => c.id).sort((a, b) => a - b).join(",")
  const duplicate =
    players.length >= 2
      ? existing.find((x) => x.id !== edit?.challenge.id && x.played_at === date && [...x.creatorIds].sort((a, b) => a - b).join(",") === playerIds)
      : undefined

  async function save() {
    setBusy(true)
    setError(null)
    const results = players.map((c) => {
      const e = get(c.id)
      return { creator_id: c.id, won: e.won, placement: e.won || e.placement === "" ? null : Number(e.placement) }
    })
    const supabase = createClient()
    const { data: id, error } = await supabase.rpc("league_save_challenge", {
      p_id: edit?.challenge.id ?? null,
      p_title: title,
      p_category: category || null,
      p_played_at: date || null,
      p_scoring: "sieg",
      p_video: filled[0].url.trim(),
      p_results: results,
    })
    if (error) {
      setBusy(false)
      return setError(error.message)
    }
    const { error: videoError } = await supabase.rpc("league_save_videos", {
      p_challenge: id,
      p_videos: filled.map((v) => ({ creator_id: v.creatorId!, url: v.url.trim() })),
    })
    setBusy(false)
    if (videoError) return setError(`Challenge gespeichert, aber Videos nicht: ${videoError.message}`)
    router.push("/liga")
    router.refresh()
  }

  if (creators.length < 2) return <p className="text-muted">Zuerst mindestens zwei Creator anlegen.</p>

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="lg-title">Titel</label>
          <input id="lg-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="input" placeholder="z. B. Boxfight-Turnier" />
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
        <div>
          <label className="label" htmlFor="lg-date">Datum</label>
          <input id="lg-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </div>
      </div>

      <div>
        <span className="label">Videos (mind. eins, pro Kanal eins)</span>
        <ul className="flex flex-col gap-2">
          {videos.map((v, i) => {
            const bad = v.url.trim() !== "" && !isYoutubeUrl(v.url)
            const twice = v.creatorId !== null && videos.filter((x) => x.creatorId === v.creatorId).length > 1
            return (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <select
                  value={v.creatorId ?? ""}
                  onChange={(e) => setVideo(i, { creatorId: e.target.value ? Number(e.target.value) : null })}
                  className={clsx("input w-auto py-1.5 text-sm", twice && "border-fail")}
                  aria-label={`Kanal von Video ${i + 1}`}
                >
                  <option value="">Kanal wählen…</option>
                  {creators.map((c) => (
                    <option key={c.id} value={c.id}>
                      Video von {c.name}
                    </option>
                  ))}
                </select>
                <input
                  value={v.url}
                  onChange={(e) => setVideo(i, { url: e.target.value })}
                  className={clsx("input min-w-0 flex-1 py-1.5 text-sm", bad && "border-fail")}
                  placeholder="https://youtu.be/…"
                  inputMode="url"
                  aria-label={`YouTube-Link von Video ${i + 1}`}
                />
                {videos.length > 1 && (
                  <button type="button" className="text-sm text-muted hover:text-fail" onClick={() => setVideos((vs) => vs.filter((_, j) => j !== i))} aria-label="Video entfernen">
                    ✕
                  </button>
                )}
                {bad && <p className="w-full text-xs text-fail">Nur Links zu youtube.com oder youtu.be (mit https://)</p>}
                {twice && <p className="w-full text-xs text-fail">Pro Kanal nur ein Video</p>}
              </li>
            )
          })}
        </ul>
        <button type="button" className="mt-2 text-sm text-accent-2 underline" onClick={() => setVideos((vs) => [...vs, { creatorId: null, url: "" }])}>
          + Video von einem weiteren Kanal
        </button>
        <p className="mt-1 text-xs text-muted">
          Hat z. B. Magican dieselbe Runde aus seiner Sicht hochgeladen, hier als weiteres Video ergänzen – die Challenge zählt trotzdem nur einmal.
        </p>
      </div>

      <p className="text-xs text-muted">
        Teilnehmer ankreuzen, Sieger markieren (Gleichstand: mehrere). Optional Platz 2, 3 … eintragen, alle anderen landen auf dem letzten Platz. Die
        Ligapunkte ergeben sich aus den Plätzen.
      </p>

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
                {e.on && (
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
                  )}
              </li>
            )
          })}
        </ul>
      </div>

      {duplicate && (
        <p className="rounded-md border border-accent/60 bg-accent/10 px-3 py-2 text-sm">
          ⚠️ Am selben Tag gibt es schon „{duplicate.title}“ mit denselben Teilnehmern. Ist das dieselbe Runde aus einer anderen Sicht? Dann besser{" "}
          <a href={`/admin?tab=liga&bearbeiten=${duplicate.id}`} className="font-semibold text-accent underline">
            dort das Video ergänzen
          </a>
          , damit sie nicht doppelt zählt.
        </p>
      )}
      <button className="btn-primary" onClick={save} disabled={busy || !title.trim() || !videosOk || players.length < 2}>
        {busy ? "Speichert…" : edit ? "Änderungen speichern" : "Challenge eintragen"}
      </button>
      {error && <p className="text-sm text-fail">{error}</p>}
    </div>
  )
}
