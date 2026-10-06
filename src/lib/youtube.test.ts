import { describe, expect, it } from "vitest"
import { avatarFromHtml } from "./youtube"

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
