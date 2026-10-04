import { describe, expect, it } from "vitest"
import { canBid, loadoutFor, phaseOf, quickBids, validateBid, type Auction, type Player, type Round } from "./auction"

const auction = (over: Partial<Auction> = {}): Auction => ({
  id: 1, host_id: "h", title: null, status: "laeuft", season_id: 1, start_gold: 500, items_per_player: 5, bid_step: 10,
  bid_seconds: 0, no_duplicates: false, rarities: [], max_players: 4, ended_reason: null, challenge_id: null,
  created_at: "", ended_at: null, ...over,
})
const round = (over: Partial<Round>): Round => ({
  id: 1, auction_id: 1, round_no: 1, item_id: 1, item_name: "X", item_rarity: "grau", item_type: "waffe", item_icon_url: null,
  status: "bietet", opens_at: "2026-01-01T00:00:00Z", deadline: null, winner_seat: null, price: null,
  tie: false, resolved_at: null, ...over,
})
const T = Date.parse("2026-01-01T00:00:10Z")

describe("validateBid", () => {
  it("akzeptiert gültige Gebote inkl. Mindestgebot und All-in", () => {
    expect(validateBid(10, 500, 10)).toBeNull()
    expect(validateBid(500, 500, 10)).toBeNull()
  })
  it("lehnt 0-Gold-Gebote ab", () => {
    expect(validateBid(0, 500, 10)).toMatch(/Mindestgebot/)
  })
  it("lehnt ungültige ab", () => {
    expect(validateBid(15, 500, 10)).toMatch(/10er/)
    expect(validateBid(510, 500, 10)).toMatch(/Gold/)
    expect(validateBid(-10, 500, 10)).toMatch(/Mindestgebot/)
    expect(validateBid(10.5, 500, 10)).toMatch(/ganze/)
  })
})

describe("quickBids", () => {
  it("nur gültige, sortierte Beträge", () => {
    expect(quickBids(500, 10)).toEqual([10, 50, 100, 250, 500])
    expect(quickBids(35, 10)).toEqual([10, 30])
    expect(quickBids(0, 10)).toEqual([])
  })
})

describe("canBid", () => {
  const player = (gold: number, item_count: number): Player => ({
    auction_id: 1, seat: 1, user_id: "u", display_name: null, avatar_url: null, gold, item_count, acted_round: 0, joined_at: "",
  })
  it("braucht freie Slots und mindestens das Mindestgebot", () => {
    expect(canBid(player(10, 4), auction())).toBe(true)
    expect(canBid(player(9, 0), auction())).toBe(false)
    expect(canBid(player(500, 5), auction())).toBe(false)
  })
})

describe("loadoutFor", () => {
  it("zählt zugeloste Items mit", () => {
    const rounds = [
      round({ id: 1, round_no: 1, status: "entschieden", winner_seat: 1, item_name: "A" }),
      round({ id: 2, round_no: 9, status: "zugelost", winner_seat: 1, item_name: "Z", price: 0 }),
    ]
    expect(loadoutFor(1, rounds, 3).map((r) => r?.item_name ?? null)).toEqual(["A", "Z", null])
  })

  it("füllt Slots in Gewinn-Reihenfolge", () => {
    const rounds = [
      round({ id: 3, round_no: 3, status: "entschieden", winner_seat: 2, item_name: "C" }),
      round({ id: 1, round_no: 1, status: "entschieden", winner_seat: 2, item_name: "A" }),
      round({ id: 2, round_no: 2, status: "verworfen" }),
      round({ id: 4, round_no: 4, status: "entschieden", winner_seat: 1, item_name: "D" }),
    ]
    const l = loadoutFor(2, rounds, 5)
    expect(l.map((r) => r?.item_name ?? null)).toEqual(["A", "C", null, null, null])
  })
})

describe("phaseOf", () => {
  it("Lobby", () => {
    expect(phaseOf(auction({ status: "lobby" }), [], T).kind).toBe("lobby")
  })
  it("Bieten, wenn die Runde offen ist", () => {
    expect(phaseOf(auction(), [round({})], T).kind).toBe("bidding")
  })
  it("Reveal bis zur Freigabe des nächsten Items", () => {
    const rounds = [
      round({ id: 1, status: "entschieden", winner_seat: 1, resolved_at: "2026-01-01T00:00:08Z" }),
      round({ id: 2, round_no: 2, opens_at: "2026-01-01T00:00:13Z" }),
    ]
    const p = phaseOf(auction(), rounds, T)
    expect(p.kind).toBe("reveal")
    expect(phaseOf(auction(), rounds, Date.parse("2026-01-01T00:00:14Z")).kind).toBe("bidding")
  })
  it("Zugeloste Items lösen keinen Reveal aus", () => {
    const rounds = [
      round({ id: 1, status: "entschieden", winner_seat: 1, resolved_at: "2026-01-01T00:00:00Z" }),
      round({ id: 2, round_no: 2, status: "zugelost", winner_seat: 2, price: 0, resolved_at: "2026-01-01T00:00:09Z" }),
    ]
    expect(phaseOf(auction({ status: "beendet" }), rounds, T).kind).toBe("ended")
  })
  it("Ende nach kurzem Reveal des letzten Ergebnisses", () => {
    const rounds = [round({ status: "entschieden", winner_seat: 1, resolved_at: "2026-01-01T00:00:08Z" })]
    expect(phaseOf(auction({ status: "beendet" }), rounds, T).kind).toBe("reveal")
    expect(phaseOf(auction({ status: "beendet" }), rounds, T + 10000).kind).toBe("ended")
  })
})
