/** Creator-Liga: Ligapunkte, Tabelle, Diagramm-Daten und Kopf-an-Kopf (rein, ohne Datenbank) */

export type LeagueSeason = { id: number; name: string; is_current: boolean; points_scheme: number[] }
export type Creator = { id: number; name: string; avatar_url: string | null; youtube_url?: string | null }
export type LeagueChallenge = {
  id: number
  season_id: number
  title: string
  category: string | null
  played_at: string
  scoring: string
  youtube_url: string
}
export type LeagueResult = { challenge_id: number; creator_id: number; placement: number; points: number | null; won: boolean }

export const DEFAULT_SCHEME = [3, 2, 1]
export const CREATOR_COLORS = ["#facc15", "#22d3ee", "#f472b6", "#4ade80", "#fb923c", "#a78bfa", "#f87171", "#60a5fa", "#e5e7eb", "#2dd4bf"]

/** Ligapunkte für eine Platzierung (Platz 1 = scheme[0] …, danach 0) */
export const leaguePoints = (placement: number, scheme: readonly number[] = DEFAULT_SCHEME) => scheme[placement - 1] ?? 0

/** Feste Farbe je Creator (nach Anlage-Reihenfolge), überall gleich */
export function creatorColors(creators: readonly Creator[]) {
  return new Map([...creators].sort((a, b) => a.id - b.id).map((c, i) => [c.id, CREATOR_COLORS[i % CREATOR_COLORS.length]]))
}

export type LeagueRow = {
  creatorId: number
  name: string
  avatar: string | null
  color: string
  youtube: string | null
  leaguePoints: number
  wins: number
  rounds: number
  winRate: number
  points: number | null
}
export type LeagueSort = "ligapunkte" | "siege" | "teilnahmen" | "quote" | "punkte"

type SchemeOf = (seasonId: number) => readonly number[]

export function leagueTable(
  challenges: readonly LeagueChallenge[],
  results: readonly LeagueResult[],
  creators: readonly Creator[],
  schemeOf: SchemeOf,
  sort: LeagueSort = "ligapunkte",
): LeagueRow[] {
  const colors = creatorColors(creators)
  const byId = new Map(creators.map((c) => [c.id, c]))
  const season = new Map(challenges.map((c) => [c.id, c.season_id]))
  const rows = new Map<number, LeagueRow>()
  for (const r of results) {
    const s = season.get(r.challenge_id)
    const c = byId.get(r.creator_id)
    if (s == null || !c) continue
    const row =
      rows.get(c.id) ??
      ({ creatorId: c.id, name: c.name, avatar: c.avatar_url, color: colors.get(c.id)!, youtube: c.youtube_url ?? null, leaguePoints: 0, wins: 0, rounds: 0, winRate: 0, points: null } as LeagueRow)
    row.rounds++
    if (r.won) row.wins++
    row.leaguePoints += leaguePoints(r.placement, schemeOf(s))
    if (r.points != null) row.points = (row.points ?? 0) + r.points
    rows.set(c.id, row)
  }
  for (const row of rows.values()) row.winRate = Math.round((row.wins / row.rounds) * 100)
  const val: Record<LeagueSort, (r: LeagueRow) => number> = {
    ligapunkte: (r) => r.leaguePoints,
    siege: (r) => r.wins,
    teilnahmen: (r) => r.rounds,
    quote: (r) => r.winRate,
    punkte: (r) => r.points ?? -1,
  }
  return [...rows.values()].sort(
    (a, b) =>
      val[sort](b) - val[sort](a) ||
      b.leaguePoints - a.leaguePoints ||
      b.wins - a.wins ||
      b.winRate - a.winRate ||
      a.name.localeCompare(b.name, "de"),
  )
}

export type Slice = { key: string; label: string; value: number; color: string }

/** Anteil an allen Siegen: die Top 6, der Rest als „Andere“ */
export function winShare(rows: readonly LeagueRow[], top = 6): Slice[] {
  const withWins = [...rows].filter((r) => r.wins > 0).sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name, "de"))
  const slices: Slice[] = withWins.slice(0, top).map((r) => ({ key: String(r.creatorId), label: r.name, value: r.wins, color: r.color }))
  const rest = withWins.slice(top).reduce((s, r) => s + r.wins, 0)
  if (rest > 0) slices.push({ key: "andere", label: "Andere", value: rest, color: "#6b7280" })
  return slices
}

export type Timeline = { labels: string[]; series: { key: string; label: string; color: string; values: number[] }[] }

/** Kumulierte Ligapunkte nach jeder Challenge (chronologisch), für die besten `top` Creator */
export function pointsTimeline(
  challenges: readonly LeagueChallenge[],
  results: readonly LeagueResult[],
  rows: readonly LeagueRow[],
  schemeOf: SchemeOf,
  top = 6,
): Timeline {
  const ordered = [...challenges].sort((a, b) => a.played_at.localeCompare(b.played_at) || a.id - b.id)
  const shown = [...rows].sort((a, b) => b.leaguePoints - a.leaguePoints).slice(0, top)
  const byChallenge = new Map<number, LeagueResult[]>()
  for (const r of results) byChallenge.set(r.challenge_id, [...(byChallenge.get(r.challenge_id) ?? []), r])
  const totals = new Map(shown.map((r) => [r.creatorId, 0]))
  const values = new Map(shown.map((r) => [r.creatorId, [] as number[]]))
  for (const ch of ordered) {
    for (const r of byChallenge.get(ch.id) ?? []) {
      if (totals.has(r.creator_id)) totals.set(r.creator_id, totals.get(r.creator_id)! + leaguePoints(r.placement, schemeOf(ch.season_id)))
    }
    for (const [id, list] of values) list.push(totals.get(id)!)
  }
  return {
    labels: ordered.map((c) => c.played_at),
    series: shown.map((r) => ({ key: String(r.creatorId), label: r.name, color: r.color, values: values.get(r.creatorId)! })),
  }
}

export type HeadToHead = { shared: number; aBetter: number; bBetter: number; even: number; aWins: number; bWins: number }

/** Direkter Vergleich zweier Creator über ihre gemeinsamen Challenges */
export function headToHead(results: readonly LeagueResult[], a: number, b: number): HeadToHead {
  const byChallenge = new Map<number, { a?: LeagueResult; b?: LeagueResult }>()
  for (const r of results) {
    if (r.creator_id !== a && r.creator_id !== b) continue
    const e = byChallenge.get(r.challenge_id) ?? {}
    if (r.creator_id === a) e.a = r
    else e.b = r
    byChallenge.set(r.challenge_id, e)
  }
  const h: HeadToHead = { shared: 0, aBetter: 0, bBetter: 0, even: 0, aWins: 0, bWins: 0 }
  for (const { a: ra, b: rb } of byChallenge.values()) {
    if (!ra || !rb) continue
    h.shared++
    if (ra.placement < rb.placement) h.aBetter++
    else if (rb.placement < ra.placement) h.bBetter++
    else h.even++
    if (ra.won) h.aWins++
    if (rb.won) h.bWins++
  }
  return h
}

/** Prüft YouTube-Links (wie die Datenbank) */
export const isYoutubeUrl = (url: string) => /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\/\S+$/i.test(url.trim())
