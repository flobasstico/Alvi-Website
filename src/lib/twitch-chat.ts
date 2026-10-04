// Twitch-Chat über die offizielle IRC-WebSocket-Schnittstelle (wie Chat-Bots sie nutzen).

export const TWITCH_IRC_URL = process.env.NEXT_PUBLIC_TWITCH_IRC_URL || "wss://irc-ws.chat.twitch.tv:443"

export type ChatMessage = { login: string; displayName: string; channel: string; text: string }

/** Parst eine IRC-Zeile; liefert nur Chat-Nachrichten (PRIVMSG). */
export function parsePrivmsg(line: string): ChatMessage | null {
  let rest = line
  let tags: Record<string, string> = {}
  if (rest.startsWith("@")) {
    const sp = rest.indexOf(" ")
    tags = Object.fromEntries(
      rest
        .slice(1, sp)
        .split(";")
        .map((kv) => {
          const i = kv.indexOf("=")
          return [kv.slice(0, i), kv.slice(i + 1)]
        }),
    )
    rest = rest.slice(sp + 1)
  }
  const m = rest.match(/^:([^!\s]+)![^\s]+ PRIVMSG #([^\s]+) :(.*)$/)
  if (!m) return null
  const login = m[1].toLowerCase()
  return { login, displayName: tags["display-name"] || m[1], channel: m[2].toLowerCase(), text: m[3].trim() }
}

/** „!1“, „!2“ oder „!3“ am Anfang der Nachricht (auch „!2 bitte“), sonst null. */
export function parseVote(text: string, options = 3): number | null {
  const m = text.trim().match(/^!([1-9])(?:\s|$)/)
  if (!m) return null
  const n = Number(m[1])
  return n >= 1 && n <= options ? n : null
}

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })

/** Twitch erlaubt max. 500 Zeichen pro Nachricht. */
function clip(s: string, max = 480) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s
}

export function pollMessage(options: { text: string }[], closesAt: string, position: number): string {
  const opts = options.map((o, i) => `!${i + 1} ${o.text}`).join(" | ")
  return clip(`🚨 REGEL-ABSTIMMUNG für Regel ${position}: ${opts} — stimmt bis ${clock(closesAt)} Uhr ab!`)
}

export function resultMessage(text: string, votes: number, total: number): string {
  return clip(total > 0 ? `✅ Der Chat hat entschieden: „${text}“ (${votes} von ${total} Stimmen)` : `🎲 Keine Stimmen – der Zufall wählt: „${text}“`)
}
