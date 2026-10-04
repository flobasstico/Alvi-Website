"use client"

import { useMotionValue } from "framer-motion"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ChatBridge } from "@/components/escalation/chat-bridge"
import { RuleBoard } from "@/components/escalation/rule-board"
import { useEscalation, type EscState } from "@/components/escalation/use-escalation"
import { buildSlices, spinTo, WheelSvg } from "@/components/wheel-svg"
import { audioReady, playAlarm, unlockAudio } from "@/lib/alarm"
import type { EscPlayer } from "@/lib/escalation"
import { celebrate } from "@/lib/confetti"

type PoolRule = { id: number; text: string }

export function EscalationRoom({
  initial,
  pool,
  userId,
  serverNow,
}: {
  initial: EscState
  pool: PoolRule[]
  userId: string | null
  serverNow: number
}) {
  const [sound, setSound] = useState(false)
  const { session, rules, allRules, players, polls, openPoll, now, newest, refetch, supabase } = useEscalation(initial, serverNow, { sound })
  const isHost = !!userId && userId === session.host_id
  const isPlayer = !!userId && players.some((p) => p.user_id === userId)
  const [busy, setBusy] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rotation = useMotionValue(0)
  const slices = useMemo(() => buildSlices(pool.map((p) => ({ ...p, weight: 1 }))), [pool])

  useEffect(() => {
    try {
      if (localStorage.getItem("eskalation-ton") === "an" && audioReady()) setSound(true)
    } catch {}
  }, [])

  async function toggleSound() {
    if (sound) {
      setSound(false)
      try { localStorage.setItem("eskalation-ton", "aus") } catch {}
      return
    }
    await unlockAudio()
    setSound(true)
    playAlarm(0.2)
    try { localStorage.setItem("eskalation-ton", "an") } catch {}
  }

  async function call(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true)
    setError(null)
    const { error } = await fn()
    if (error) setError(error.message)
    await refetch()
    setBusy(false)
  }

  async function drawBase() {
    setSpinning(true)
    setError(null)
    const { data, error } = await supabase.rpc("escalation_draw_base", { p_session: session.id })
    if (error) {
      setError(error.message)
      setSpinning(false)
      return
    }
    const slice = slices.find((s) => s.item.id === data) ?? slices[0]
    await spinTo(rotation, slice)
    setSpinning(false)
    celebrate()
    await refetch()
  }

  const overlayUrl = typeof window === "undefined" ? "" : `${location.origin}/overlay/eskalation/${session.id}`
  const needsBase = session.status === "bereit" && allRules.length === 0
  const showWheel = isHost && (needsBase || spinning)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/eskalation" className="text-sm text-muted hover:text-white">← Runden</Link>
        <h1 className="font-display text-3xl text-accent sm:text-4xl">{session.title ?? `Regel-Eskalation #${session.id}`}</h1>
        <button className={sound ? "btn-secondary ml-auto" : "btn-primary ml-auto"} onClick={toggleSound}>
          {sound ? "🔊 Ton an" : "🔇 Ton aktivieren"}
        </button>
      </div>
      {error && <p className="rounded-xl border border-fail bg-fail/10 px-3 py-2 text-sm text-fail">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
        <div className="flex flex-col gap-4">
          {showWheel ? (
            <div className="panel flex flex-col items-center gap-5">
              <h2 className="font-display text-2xl">Grundregel drehen</h2>
              <WheelSvg slices={slices} rotation={rotation} />
              <button className="btn-primary px-10 py-4 font-display text-2xl" onClick={drawBase} disabled={spinning || pool.length === 0}>
                {spinning ? "Dreht…" : "DREHEN!"}
              </button>
            </div>
          ) : (
            <HostPanel
              isHost={isHost}
              status={session.status}
              busy={busy}
              onStart={() => call(() => supabase.rpc("escalation_start", { p_session: session.id }))}
              onFinish={(winner) => call(() => supabase.rpc("escalation_finish", { p_session: session.id, p_winner: winner }))}
              players={players}
              winnerName={session.winner_name}
            />
          )}

          {isHost && session.mode === "chat" && <ChatBridge session={session} polls={polls} supabase={supabase} />}

          <PlayersPanel
            players={players}
            hostId={session.host_id}
            ended={session.status === "beendet"}
            userId={userId}
            isHost={isHost}
            isPlayer={isPlayer}
            busy={busy}
            onJoin={() => call(() => supabase.rpc("escalation_join", { p_session: session.id }))}
            onLeave={(user) => call(() => supabase.rpc("escalation_leave", { p_session: session.id, p_user: user }))}
          />

          <div className="panel flex flex-col gap-2">
            <h2 className="font-display text-xl">OBS-Overlay</h2>
            <p className="text-sm text-muted">
              Als <b>Browserquelle</b> in OBS einfügen (z. B. 520 × 900). Hintergrund ist transparent. Für den Alarm in OBS
              „Audio über OBS steuern“ aktivieren.
            </p>
            <div className="flex gap-2">
              <input readOnly value={overlayUrl} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
              <CopyButton text={overlayUrl} />
            </div>
          </div>
        </div>

        <div className="self-start lg:sticky lg:top-20">
          <RuleBoard session={session} rules={rules} now={now} newest={newest} poll={openPoll} />
        </div>
      </div>
    </div>
  )
}

function HostPanel({
  isHost,
  status,
  busy,
  onStart,
  onFinish,
  players,
  winnerName,
}: {
  isHost: boolean
  status: string
  busy: boolean
  onStart: () => void
  onFinish: (winner: string | null) => void
  players: EscPlayer[]
  winnerName: string | null
}) {
  const [choosing, setChoosing] = useState(false)

  if (status === "beendet") {
    return (
      <div className="panel flex flex-col gap-2 text-center">
        <div className="font-display text-3xl text-accent">{winnerName ? `🏆 ${winnerName} gewinnt!` : "Runde beendet"}</div>
        <p className="text-sm text-muted">
          {winnerName ? "Das Ergebnis ist in den Stats eingetragen." : "Ohne Wertung beendet."}{" "}
          <Link href="/eskalation" className="text-accent-2 underline">Neue Runde</Link>
        </p>
      </div>
    )
  }
  if (!isHost) {
    return (
      <div className="panel text-muted">
        {status === "bereit" && "Warte auf den Start – wer die Runde eröffnet hat, startet sie."}
        {status === "laeuft" && "Die Runde läuft. Neue Regeln erscheinen automatisch."}
      </div>
    )
  }
  if (choosing) {
    return (
      <div className="panel flex flex-col gap-3">
        <h2 className="font-display text-2xl">Wer hat gewonnen?</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {players.map((p) => (
            <button
              key={p.user_id}
              className="btn-secondary justify-start py-3 text-left text-lg"
              disabled={busy}
              onClick={() => confirm(`${p.display_name} als Sieger eintragen und Runde beenden?`) && onFinish(p.user_id)}
            >
              🏆 {p.display_name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" disabled={busy} onClick={() => confirm("Runde ohne Sieger beenden?") && onFinish(null)}>
            Ohne Wertung beenden
          </button>
          <button className="btn-secondary" disabled={busy} onClick={() => setChoosing(false)}>
            Zurück
          </button>
        </div>
        <p className="text-xs text-muted">Der Sieg zählt für die Bestenliste in den Stats.</p>
      </div>
    )
  }
  return (
    <div className="panel flex flex-col items-center gap-3 text-center">
      {status === "bereit" && (
        <>
          <p className="text-muted">Grundregel steht. Startet jetzt gemeinsam die Fortnite-Runde und drückt dann Start.</p>
          <button className="btn-primary px-12 py-5 font-display text-3xl" onClick={onStart} disabled={busy}>
            ▶ START
          </button>
          <p className="text-xs text-muted">Danach kommt automatisch nach jedem Timer-Ablauf eine neue Regel dazu.</p>
        </>
      )}
      <button className="btn-danger px-8 py-3 font-display text-2xl" onClick={() => setChoosing(true)} disabled={busy}>
        ⏹ ENDE
      </button>
    </div>
  )
}

function PlayersPanel({
  players,
  hostId,
  ended,
  userId,
  isHost,
  isPlayer,
  busy,
  onJoin,
  onLeave,
}: {
  players: EscPlayer[]
  hostId: string
  ended: boolean
  userId: string | null
  isHost: boolean
  isPlayer: boolean
  busy: boolean
  onJoin: () => void
  onLeave: (user: string | null) => void
}) {
  const pageUrl = typeof window === "undefined" ? "" : location.href
  return (
    <div className="panel flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl">Mitspieler ({players.length})</h2>
        {!ended && userId && !isPlayer && (
          <button className="btn-primary ml-auto px-3 py-1 text-sm" disabled={busy} onClick={onJoin}>Mitspielen</button>
        )}
        {!ended && isPlayer && !isHost && (
          <button className="btn-secondary ml-auto px-3 py-1 text-sm" disabled={busy} onClick={() => onLeave(null)}>Austreten</button>
        )}
      </div>
      <ul className="flex flex-wrap gap-2">
        {players.map((p) => (
          <li key={p.user_id} className="flex items-center gap-2 rounded-full border border-line bg-panel-2 py-1 pl-1 pr-3 text-sm font-semibold">
            {p.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.avatar_url} alt="" className="h-6 w-6 rounded-full" />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-line text-xs">👤</span>
            )}
            {p.display_name}
            {p.user_id === hostId && <span className="text-xs text-accent">Host</span>}
            {isHost && !ended && p.user_id !== hostId && (
              <button className="text-muted hover:text-fail" title="Entfernen" disabled={busy} onClick={() => onLeave(p.user_id)}>✕</button>
            )}
          </li>
        ))}
      </ul>
      {!ended && (
        <p className="text-xs text-muted">
          {userId ? "" : "Zum Mitspielen mit Twitch einloggen. "}Diesen Seitenlink an die Mitspieler schicken – nur Mitspieler können als Sieger gewählt werden.
          <span className="ml-1 inline-block align-middle"><CopyButton text={pageUrl} label="Einladungslink kopieren" /></span>
        </p>
      )}
    </div>
  )
}

function CopyButton({ text, label = "Kopieren" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className="btn-secondary shrink-0"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setDone(true)
        setTimeout(() => setDone(false), 2000)
      }}
    >
      {done ? "Kopiert ✓" : label}
    </button>
  )
}
