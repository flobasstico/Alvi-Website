import { describe, expect, it } from "vitest"
import { formatWatchtime, isBot, rankEntries } from "./streamelements"

describe("StreamElements-Ranglisten", () => {
  it("formatiert Watchtime", () => {
    expect(formatWatchtime(0)).toBe("0 Min.")
    expect(formatWatchtime(45)).toBe("45 Min.")
    expect(formatWatchtime(120)).toBe("2 Std.")
    expect(formatWatchtime(728750)).toBe("12.145 Std. 50 Min.")
  })

  it("blendet Bots aus und nummeriert ohne Lücken", () => {
    expect(isBot("StreamElements")).toBe(true)
    expect(isBot("alvivb")).toBe(false)
    const first = [{ username: "streamelements", value: 9 }, { username: "kevin", value: 8 }, { username: "Nightbot", value: 7 }, { username: "lisa", value: 6 }]
    expect(rankEntries(first, 1).map((e) => [e.username, e.rank])).toEqual([["kevin", 1], ["lisa", 2]])
    expect(rankEntries([{ username: "tom", value: 1 }], 2, first)[0].rank).toBe(99)
  })
})
