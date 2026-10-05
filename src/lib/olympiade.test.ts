import { describe, expect, it } from "vitest"
import { drawnGames, openGame, parseGames, pointsLeft, standings, wheelGames, type OlympicGame, type OlympicPlayer } from "./olympiade"

const g = (id: number, position: number | null, winner: string | null = null): OlympicGame => ({
  id, name: `Spiel ${id}`, olympic_id: 1, position, winner_id: winner, created_at: "",
})
const p = (id: string, joined: string): OlympicPlayer => ({
  olympic_id: 1, user_id: id, display_name: id, avatar_url: null, points: 0, won: false, joined_at: joined,
})

describe("Olympiade", () => {
  const games = [g(1, 2, "kev"), g(2, null), g(3, 1, "alvi"), g(4, 3, "alvi"), g(5, 4)]
  const players = [p("alvi", "1"), p("kev", "2"), p("flo", "3")]

  it("Spiel n bringt n Punkte, Rangliste mit geteilten Plätzen", () => {
    const s = standings({ games, players, streamerId: "alvi" })
    expect(s.map((r) => [r.userId, r.points, r.rank])).toEqual([["alvi", 4, 1], ["kev", 2, 2], ["flo", 0, 3]])
    expect(s[0].streamer).toBe(true)
    const tie = standings({ games: [g(1, 1, "kev"), g(2, 2, "flo"), g(3, 3, "kev")], players, streamerId: null })
    expect(tie.map((r) => r.rank)).toEqual([1, 2, 3])
    const even = standings({ games: [g(1, 1, "kev"), g(2, 2, "kev"), g(3, 3, "flo")], players, streamerId: null })
    expect(even.map((r) => [r.userId, r.rank])).toEqual([["kev", 1], ["flo", 1], ["alvi", 3]])
  })

  it("trennt Rad und gezogene Spiele, erkennt offenes Spiel", () => {
    expect(drawnGames(games).map((x) => x.id)).toEqual([3, 1, 4, 5])
    expect(wheelGames(games).map((x) => x.id)).toEqual([2])
    expect(openGame({ olympic: { current_game_id: 5 } as never, games })?.id).toBe(5)
    expect(openGame({ olympic: { current_game_id: 4 } as never, games })).toBeNull()
  })

  it("rechnet die restlichen Punkte", () => {
    expect(pointsLeft(games)).toBe(4 + 5) // offenes Spiel 4 + letztes Spiel auf dem Rad
    expect(pointsLeft([g(1, null), g(2, null), g(3, null)])).toBe(6)
  })

  it("liest die Spiele-Liste", () => {
    expect(parseGames("Boxfight\n Zonewars , boxfight;\n\nPistolen")).toEqual(["Boxfight", "Zonewars", "Pistolen"])
  })
})
