import { describe, expect, it } from "vitest"
import { headToHead, isYoutubeUrl, leaguePoints, leagueTable, pointsTimeline, winShare, type LeagueChallenge, type LeagueResult } from "./league"

const creators = [
  { id: 1, name: "Alvi", avatar_url: null },
  { id: 2, name: "Kevin", avatar_url: null },
  { id: 3, name: "Lisa", avatar_url: null },
]
const ch = (id: number, played_at: string): LeagueChallenge => ({
  id, played_at, title: `C${id}`, category: null, scoring: "sieg", youtube_url: "https://youtu.be/x",
})
const res = (challenge_id: number, creator_id: number, placement: number, points: number | null = null): LeagueResult => ({
  challenge_id, creator_id, placement, points, won: placement === 1,
})
const challenges = [ch(1, "2026-10-01"), ch(2, "2026-10-02"), ch(3, "2026-10-03")]
const results = [
  res(1, 1, 1), res(1, 2, 2), res(1, 3, 3),
  res(2, 2, 1, 25), res(2, 1, 2, 10), res(2, 3, 2, 10),
  res(3, 1, 1), res(3, 2, 2),
]

describe("Creator-Liga", () => {
  it("vergibt Ligapunkte nach Platz", () => {
    expect([1, 2, 3, 4].map((p) => leaguePoints(p))).toEqual([3, 2, 1, 0])
  })

  it("baut die Tabelle nach Ligapunkten", () => {
    const rows = leagueTable(challenges, results, creators)
    expect(rows.map((r) => [r.name, r.leaguePoints, r.wins, r.rounds, r.points])).toEqual([
      ["Alvi", 8, 2, 3, 10],
      ["Kevin", 7, 1, 3, 25],
      ["Lisa", 3, 0, 2, 10],
    ])
    expect(leagueTable(challenges, results, creators, "punkte")[0].name).toBe("Kevin")
  })

  it("liefert Kuchen, Verlauf und Kopf-an-Kopf", () => {
    const rows = leagueTable(challenges, results, creators)
    expect(winShare(rows).map((s) => [s.label, s.value])).toEqual([["Alvi", 2], ["Kevin", 1]])
    expect(winShare(rows, 1).map((s) => s.label)).toEqual(["Alvi", "Andere"])
    const t = pointsTimeline(challenges, results, rows)
    expect(t.series.find((s) => s.label === "Alvi")!.values).toEqual([3, 5, 8])
    expect(t.series.find((s) => s.label === "Lisa")!.values).toEqual([1, 3, 3])
    expect(headToHead(results, 1, 2)).toEqual({ shared: 3, aBetter: 2, bBetter: 1, even: 0, aWins: 2, bWins: 1 })
    expect(headToHead(results, 1, 3)).toMatchObject({ shared: 2, aBetter: 1, even: 1 })
  })

  it("erkennt YouTube-Links", () => {
    expect(isYoutubeUrl("https://youtu.be/abc")).toBe(true)
    expect(isYoutubeUrl("https://www.youtube.com/watch?v=abc")).toBe(true)
    expect(isYoutubeUrl("https://twitch.tv/abc")).toBe(false)
    expect(isYoutubeUrl("http://youtube.com/abc")).toBe(false)
  })
})
