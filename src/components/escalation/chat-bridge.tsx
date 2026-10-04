"use client"

import clsx from "clsx"
import { useEffect, useRef, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { pollOptions, type EscSession, type PollWithCounts } from "@/lib/escalation"
import { parsePrivmsg, parseVote, pollMessage, resultMessage, TWITCH_IRC_URL } from "@/lib/twitch-chat"

type Status = "getrennt" | "verbinde" | "verbunden" | "fehler"

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : null
}
function clearChatCookies() {
  document.cookie = "twitch_chat_token=; Max-Age=0; path=/"
  document.cookie = "twitch_chat_login=; Max-Age=0; path=/"
}

/**
 * Chat-Brücke für den Chat-Modus (läuft nur im Browser des Hosts):
 * liest den Twitch-Chat, trägt !1/!2/!3-Stimmen ein und postet Abstimmung und Ergebnis.
 * Ohne Chat-Schreibrechte wird nur gelesen; die Nachrichten lassen sich dann kopieren.
 */
export function ChatBridge({
  session,
  polls,
  supabase,
}: {
  session: EscSession
  polls: PollWithCounts[]
  supabase: SupabaseClient<Database>
}) {
  const channel = session.twitch_channel ?? ""
  const [status, setStatus] = useState<Status>("getrennt")
  const [writeAs, setWriteAs] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [votesSeen, setVotesSeen] = useState(0)
  const [lastPosted, setLastPosted] = useState<string | null>(null)
  const ws = useRef<WebSocket | null>(null)
  const ready = useRef(false)
  const openPollRef = useRef<PollWithCounts | null>(null)
  const active = session.status !== "beendet" && !!channel

  openPollRef.current = polls.find((p) => p.status === "offen") ?? null

  // Verbindung zum Twitch-Chat (mit automatischem Neuverbinden)
  useEffect(() => {
    if (!active) return
    let stopped = false
    let retry = 1000
    let timer: ReturnType<typeof setTimeout> | undefined

    const connect = () => {
      const token = readCookie("twitch_chat_token")
      const login = readCookie("twitch_chat_login")
      const socket = new WebSocket(TWITCH_IRC_URL)
      ws.current = socket
      ready.current = false
      setStatus("verbinde")

      socket.onopen = () => {
        socket.send("CAP REQ :twitch.tv/tags twitch.tv/commands")
        if (token && login) {
          socket.send(`PASS oauth:${token}`)
          socket.send(`NICK ${login}`)
        } else {
          socket.send(`NICK justinfan${Math.floor(10000 + Math.random() * 80000)}`)
        }
        socket.send(`JOIN #${channel}`)
      }

      socket.onmessage = (ev) => {
        for (const line of String(ev.data).split("\r\n")) {
          if (!line) continue
          if (line.startsWith("PING")) {
            socket.send(line.replace("PING", "PONG"))
            continue
          }
          if (/NOTICE \* :(Login authentication failed|Improperly formatted auth)/.test(line)) {
            setAuthError("Twitch hat die Chat-Anmeldung abgelehnt (Token abgelaufen?). Bitte neu verbinden – bis dahin nur Lesen.")
            clearChatCookies()
            socket.close()
            continue
          }
          if (/ 366 /.test(line) || /:End of \/NAMES list/.test(line)) {
            ready.current = true
            retry = 1000
            setStatus("verbunden")
            setWriteAs(token && login ? login : null)
            continue
          }
          const msg = parsePrivmsg(line)
          if (!msg || msg.channel !== channel) continue
          const poll = openPollRef.current
          if (!poll) continue
          const vote = parseVote(msg.text, pollOptions(poll).length)
          if (vote === null) continue
          setVotesSeen((n) => n + 1)
          // Supabase-Abfragen starten erst mit then() – daher nicht nur „void“
          supabase
            .rpc("escalation_poll_vote", { p_poll: poll.id, p_voter: msg.login, p_option: vote })
            .then(({ error }) => error && console.warn("Stimme nicht gespeichert:", error.message))
        }
      }

      socket.onclose = () => {
        ready.current = false
        if (stopped) return
        setStatus("fehler")
        timer = setTimeout(connect, retry)
        retry = Math.min(retry * 2, 30000)
      }
    }

    connect()
    return () => {
      stopped = true
      clearTimeout(timer)
      ws.current?.close()
      ws.current = null
      setStatus("getrennt")
    }
  }, [active, channel, supabase])

  // Abstimmung bzw. Ergebnis genau einmal in den Chat posten
  const posting = useRef(false)
  useEffect(() => {
    if (!writeAs || status !== "verbunden" || posting.current) return
    const now = Date.now()
    const pendingResult = polls.find(
      (p) => p.status === "entschieden" && !p.result_announced_at && now - Date.parse(p.closes_at) < 120_000,
    )
    const pendingPoll = polls.find((p) => p.status === "offen" && !p.announced_at && Date.parse(p.closes_at) > now)
    const next = pendingResult ?? pendingPoll
    if (!next) return
    posting.current = true
    const kind = next === pendingResult ? "result" : "announced"
    void (async () => {
      const { data: first } = await supabase.rpc("escalation_poll_mark", { p_poll: next.id, p_kind: kind })
      if (first && ws.current && ready.current) {
        const text =
          kind === "result"
            ? resultMessage(pollOptions(next)[(next.winner_option ?? 1) - 1]?.text ?? "?", next.winner_votes ?? 0, next.total_votes ?? 0)
            : pollMessage(pollOptions(next), next.closes_at, next.position)
        ws.current.send(`PRIVMSG #${channel} :${text}`)
        setLastPosted(text)
      }
      posting.current = false
    })()
  }, [polls, writeAs, status, supabase, channel])

  async function connectWithWriteAccess() {
    await supabase.auth.signInWithOAuth({
      provider: "twitch",
      options: {
        scopes: "chat:read chat:edit",
        redirectTo: `${location.origin}/auth/callback?chat=1&next=${encodeURIComponent(location.pathname)}`,
      },
    })
  }

  const openPoll = polls.find((p) => p.status === "offen") ?? null
  const manualText = openPoll ? pollMessage(pollOptions(openPoll), openPoll.closes_at, openPoll.position) : null

  return (
    <div className="panel flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl">💬 Twitch-Chat #{channel}</h2>
        <span
          className={clsx(
            "chip ml-auto",
            status === "verbunden" ? "border-win text-win" : status === "fehler" ? "border-fail text-fail" : "",
          )}
        >
          {{ getrennt: "getrennt", verbinde: "verbinde…", verbunden: "verbunden", fehler: "Verbindung weg – neuer Versuch…" }[status]}
        </span>
      </div>

      {!active ? (
        <p className="text-sm text-muted">Die Runde ist beendet – die Chat-Brücke ist aus.</p>
      ) : (
        <>
          <p className="text-sm">
            {writeAs ? (
              <>
                Postet als <b>{writeAs}</b> und zählt Stimmen. <b>Diese Seite während der Runde offen lassen.</b>
              </>
            ) : (
              <>Zählt Stimmen (nur lesen). Zum automatischen Posten Chat-Schreibrechte erteilen:</>
            )}
          </p>
          {authError && <p className="text-sm text-fail">{authError}</p>}
          <div className="flex flex-wrap gap-2">
            {!writeAs && (
              <button className="btn bg-[#9146ff] text-white hover:brightness-110" onClick={connectWithWriteAccess}>
                Mit Twitch-Chat verbinden
              </button>
            )}
            {writeAs && (
              <button
                className="btn-secondary px-3 py-1 text-sm"
                onClick={() => {
                  clearChatCookies()
                  location.reload()
                }}
              >
                Schreibrechte trennen
              </button>
            )}
          </div>
          <p className="text-xs text-muted">Stimmen empfangen: {votesSeen}{lastPosted && <> · Zuletzt gepostet: „{lastPosted}“</>}</p>
          {!writeAs && manualText && (
            <div className="flex flex-col gap-1">
              <span className="label">Abstimmung zum Selbst-Posten:</span>
              <textarea readOnly value={manualText} className="input min-h-16 text-xs" onFocus={(e) => e.target.select()} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
