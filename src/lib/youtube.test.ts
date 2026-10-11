import { describe, expect, it } from "vitest"
import { avatarFromHtml, channelIdFromHtml, channelIdFromUrl, timeAgo, videosFromFeed } from "./youtube"

describe("YouTube-Kanalbild", () => {
  it("liest og:image der Kanalseite", () => {
    const html = `<html><head><meta property="og:title" content="Alvi"><meta property="og:image" content="https://yt3.googleusercontent.com/abc=s900-c-k-c0x00ffffff-no-rj"></head></html>`
    expect(avatarFromHtml(html)).toBe("https://yt3.googleusercontent.com/abc=s900-c-k-c0x00ffffff-no-rj")
  })
  it("akzeptiert umgekehrte Attribut-Reihenfolge und &amp;", () => {
    expect(avatarFromHtml(`<meta content="https://yt3.ggpht.com/x?a=1&amp;b=2" property="og:image">`)).toBe("https://yt3.ggpht.com/x?a=1&b=2")
  })
  it("ignoriert fremde Bilder und fehlende Angaben", () => {
    expect(avatarFromHtml(`<meta property="og:image" content="https://evil.example/x.png">`)).toBeNull()
    expect(avatarFromHtml("<html></html>")).toBeNull()
  })
})

describe("Neuestes Video", () => {
  const entry = (id: string, title: string, published: string, short = false) => `
  <entry>
    <id>yt:video:${id}</id>
    <yt:videoId>${id}</yt:videoId>
    <title>${title}</title>
    <link rel="alternate" href="https://www.youtube.com/${short ? `shorts/${id}` : `watch?v=${id}`}"/>
    <published>${published}</published>
  </entry>`
  const feed = (...entries: string[]) => `<?xml version="1.0"?><feed><title>Alvi</title>${entries.join("")}</feed>`

  it("nimmt das neueste lange Video und überspringt Shorts", () => {
    const xml = feed(
      entry("SHORT000001", "Short", "2026-10-10T12:00:00+00:00", true),
      entry("LONGVIDEO01", "Neues Video &amp; mehr", "2026-10-09T12:00:00+00:00"),
      entry("LONGVIDEO00", "Altes Video", "2026-10-01T12:00:00+00:00"),
    )
    const v = videosFromFeed(xml)
    expect(v.map((x) => x.id)).toEqual(["LONGVIDEO01", "LONGVIDEO00"])
    expect(v[0].title).toBe("Neues Video & mehr")
    expect(v[0].url).toBe("https://www.youtube.com/watch?v=LONGVIDEO01")
  })

  it("leerer oder kaputter Feed → keine Videos", () => {
    expect(videosFromFeed(feed())).toEqual([])
    expect(videosFromFeed("nicht xml")).toEqual([])
  })

  it("liest die Kanal-ID aus Adresse und Kanalseite", () => {
    expect(channelIdFromUrl("https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv")).toBe("UCabcdefghijklmnopqrstuv")
    expect(channelIdFromUrl("https://www.youtube.com/@alvivb")).toBeNull()
    expect(channelIdFromHtml(`<link rel="canonical" href="https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv">`)).toBe("UCabcdefghijklmnopqrstuv")
    expect(channelIdFromHtml(`..."externalId":"UCabcdefghijklmnopqrstuv",...`)).toBe("UCabcdefghijklmnopqrstuv")
    expect(channelIdFromHtml("<html></html>")).toBeNull()
  })

  it("relative Zeit", () => {
    const now = Date.parse("2026-10-11T12:00:00Z")
    expect(timeAgo("2026-10-11T11:30:00Z", now)).toBe("vor 30 Minuten")
    expect(timeAgo("2026-10-11T09:00:00Z", now)).toBe("vor 3 Stunden")
    expect(timeAgo("2026-10-10T12:00:00Z", now)).toBe("vor 1 Tag")
    expect(timeAgo("2026-10-01T12:00:00Z", now)).toBe("vor 10 Tagen")
  })
})
