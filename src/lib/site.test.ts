import { describe, expect, it } from "vitest"
import { channelsFromSettings, invalidChannelLine, parseChannelLinks, safeUrl } from "./site"

describe("Kanal-Links", () => {
  it("ein Link ohne Namen bekommt den Plattform-Namen", () => {
    expect(parseChannelLinks("https://www.twitch.tv/alvivb", "Twitch")).toEqual([{ name: "Twitch", url: "https://www.twitch.tv/alvivb" }])
  })

  it("mehrere YouTube-Kanäle mit Namen", () => {
    const v = "Alvi | https://www.youtube.com/@alvi\n\n  Alvi Clips | https://www.youtube.com/@alviclips  \nkaputt | javascript:alert(1)"
    expect(parseChannelLinks(v, "YouTube")).toEqual([
      { name: "Alvi", url: "https://www.youtube.com/@alvi" },
      { name: "Alvi Clips", url: "https://www.youtube.com/@alviclips" },
    ])
    expect(invalidChannelLine(v)).toBe("kaputt | javascript:alert(1)")
    expect(invalidChannelLine("A | https://a.de\nhttps://b.de")).toBeNull()
  })

  it("nur http(s)", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull()
    expect(safeUrl("youtube.com/@x")).toBeNull()
  })

  it("Plattformen ohne Kanal werden ausgeblendet, Reihenfolge YouTube, Twitch, Instagram, TikTok, Merch", () => {
    const s = new Map([
      ["link_tiktok", "https://tiktok.com/@alvi"],
      ["link_youtube", "A | https://youtube.com/@a\nB | https://youtube.com/@b"],
      ["link_twitch", "https://twitch.tv/alvivb"],
      ["link_instagram", ""],
    ])
    expect(channelsFromSettings(s).map((c) => [c.label, c.entries.length])).toEqual([["YouTube", 2], ["Twitch", 1], ["TikTok", 1]])
  })
})
