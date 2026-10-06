import { describe, expect, it } from "vitest"
import { formatWatchtime, isBot, rankEntries } from "./streamelements"

describe("StreamElements-Ranglisten", () => {
  it("formatiert Watchtime in Monate/Wochen/Tage/Stunden/Minuten", () => {
    expect(formatWatchtime(0)).toBe("0 Min.")
    expect(formatWatchtime(45)).toBe("45 Min.")
    expect(formatWatchtime(61)).toBe("1 Std. 1 Min.")
    expect(formatWatchtime(120)).toBe("2 Std.")
    expect(formatWatchtime(24 * 60 + 5)).toBe("1 Tg. 5 Min.")
    expect(formatWatchtime(8 * 24 * 60)).toBe("1 Wo. 1 Tg.")
    // 728750 Min. = 16 Monate (à 30 Tage) + 3 Wochen + 5 Tage + 1 Std. + 50 Min.
    expect(formatWatchtime(728750)).toBe("16 Mon. 3 Wo. 5 Tg. 1 Std. 50 Min.")
  })

  it("blendet Bots aus und nummeriert ohne Lücken", () => {
    expect(isBot("StreamElements")).toBe(true)
    expect(isBot("alvivb")).toBe(false)
    const first = [{ username: "streamelements", value: 9 }, { username: "kevin", value: 8 }, { username: "Nightbot", value: 7 }, { username: "lisa", value: 6 }]
    expect(rankEntries(first, 1).map((e) => [e.username, e.rank])).toEqual([["kevin", 1], ["lisa", 2]])
    expect(rankEntries([{ username: "tom", value: 1 }], 2, first)[0].rank).toBe(99)
  })
})
