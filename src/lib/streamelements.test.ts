import { describe, expect, it } from "vitest"
import { formatWatchtime, isBot, rankEntries } from "./streamelements"

describe("StreamElements-Ranglisten", () => {
  it("formatiert Watchtime in Monate/Wochen/Tage/Stunden/Minuten", () => {
    expect(formatWatchtime(0)).toBe("0m")
    expect(formatWatchtime(45)).toBe("45m")
    expect(formatWatchtime(61)).toBe("1S 1m")
    expect(formatWatchtime(120)).toBe("2S")
    expect(formatWatchtime(24 * 60 + 5)).toBe("1T 5m")
    expect(formatWatchtime(8 * 24 * 60)).toBe("1W 1T")
    // 728750 Min. = 16 Monate (à 30 Tage) + 3 Wochen + 5 Tage + 1 Std. + 50 Min.
    expect(formatWatchtime(728750)).toBe("16M 3W 5T 1S 50m")
  })

  it("blendet Bots aus und nummeriert ohne Lücken", () => {
    expect(isBot("StreamElements")).toBe(true)
    expect(isBot("alvivb")).toBe(false)
    const first = [{ username: "streamelements", value: 9 }, { username: "kevin", value: 8 }, { username: "Nightbot", value: 7 }, { username: "lisa", value: 6 }]
    expect(rankEntries(first, 1).map((e) => [e.username, e.rank])).toEqual([["kevin", 1], ["lisa", 2]])
    expect(rankEntries([{ username: "tom", value: 1 }], 2, first)[0].rank).toBe(99)
  })
})
