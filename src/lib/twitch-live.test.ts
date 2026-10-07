import { afterEach, describe, expect, it, vi } from "vitest"
import { liveSince, liveStream } from "./twitch-live"

describe("Twitch-Live-Status", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("formatiert die Laufzeit", () => {
    const start = "2026-10-07T10:00:00Z"
    expect(liveSince(start, Date.parse("2026-10-07T10:42:30Z"))).toBe("seit 42 min")
    expect(liveSince(start, Date.parse("2026-10-07T12:05:00Z"))).toBe("seit 2 h 5 min")
  })

  it("ohne Zugangsdaten offline, mit Stream live", async () => {
    expect(await liveStream("alvivb")).toBeNull()
    vi.stubEnv("TWITCH_CLIENT_ID", "id")
    vi.stubEnv("TWITCH_CLIENT_SECRET", "secret")
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("token")
        ? new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }))
        : new Response(JSON.stringify({ data: [{ type: "live", user_login: "alvivb", user_name: "AlviVB", title: "Bingo!", game_name: "Fortnite", viewer_count: 1234, started_at: "2026-10-07T10:00:00Z", thumbnail_url: "https://x/{width}x{height}.jpg" }] })),
    )
    vi.stubGlobal("fetch", fetchMock)
    expect(await liveStream("alvivb")).toMatchObject({ name: "AlviVB", viewers: 1234, thumbnail: "https://x/320x180.jpg" })
    fetchMock.mockImplementation(async (url: string) => new Response(JSON.stringify(url.includes("token") ? { access_token: "t", expires_in: 3600 } : { data: [] })))
    expect(await liveStream("alvivb")).toBeNull()
  })
})
