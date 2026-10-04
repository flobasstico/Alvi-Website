import { describe, expect, it } from "vitest"
import { parsePrivmsg, parseVote, pollMessage, resultMessage } from "./twitch-chat"

describe("parsePrivmsg", () => {
  it("liest Nachrichten mit Tags", () => {
    const line = "@badge-info=;display-name=KevinTV;mod=0 :kevintv!kevintv@kevintv.tmi.twitch.tv PRIVMSG #alvivb :!2"
    expect(parsePrivmsg(line)).toEqual({ login: "kevintv", displayName: "KevinTV", channel: "alvivb", text: "!2" })
  })
  it("liest Nachrichten ohne Tags", () => {
    expect(parsePrivmsg(":anna!anna@anna.tmi.twitch.tv PRIVMSG #alvivb :hallo !1")?.text).toBe("hallo !1")
  })
  it("ignoriert andere IRC-Zeilen", () => {
    expect(parsePrivmsg("PING :tmi.twitch.tv")).toBeNull()
    expect(parsePrivmsg(":tmi.twitch.tv 001 justinfan123 :Welcome, GLHF!")).toBeNull()
  })
})

describe("parseVote", () => {
  it("erkennt !1 bis !3", () => {
    expect(parseVote("!1")).toBe(1)
    expect(parseVote("  !3  ")).toBe(3)
    expect(parseVote("!2 bitte die")).toBe(2)
  })
  it("ignoriert alles andere", () => {
    expect(parseVote("!4")).toBeNull()
    expect(parseVote("!12")).toBeNull()
    expect(parseVote("ich will !1")).toBeNull()
    expect(parseVote("!1abc")).toBeNull()
  })
  it("respektiert weniger Optionen", () => {
    expect(parseVote("!3", 2)).toBeNull()
  })
})

describe("Nachrichten", () => {
  it("Abstimmung listet die Optionen", () => {
    const msg = pollMessage([{ text: "Kein Bauen" }, { text: "Nur Pistolen" }, { text: "Keine Schilde" }], "2026-01-01T20:04:00Z", 2)
    expect(msg).toContain("!1 Kein Bauen | !2 Nur Pistolen | !3 Keine Schilde")
    expect(msg).toContain("21:04")
    expect(msg.length).toBeLessThanOrEqual(480)
  })
  it("kürzt überlange Nachrichten", () => {
    expect(pollMessage([{ text: "x".repeat(600) }], "2026-01-01T20:04:00Z", 2).length).toBeLessThanOrEqual(480)
  })
  it("Ergebnis mit und ohne Stimmen", () => {
    expect(resultMessage("Kein Bauen", 3, 6)).toContain("3 von 6")
    expect(resultMessage("Kein Bauen", 0, 0)).toContain("Zufall")
  })
})
