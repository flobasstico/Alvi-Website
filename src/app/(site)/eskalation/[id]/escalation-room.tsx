"use client"

import { useMotionValue } from "framer-motion"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ChatBridge } from "@/components/escalation/chat-bridge"
import { GoneNote, ReplayButton, UnofficialNote } from "@/components/replay-button"
import { RuleBoard } from "@/components/escalation/rule-board"
import { useEscalation, type EscState } from "@/components/escalation/use-escalation"
import { buildSlices, spinTo, WheelSvg } from "@/components/wheel-svg"
import { audioReady, playAlarm, unlockAudio } from "@/lib/alarm"
import type { EscPlayer } from "@/lib/escalation"
import { CopyButton, PlayersPanel, WinnerPicker } from "@/components/session/players"
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
  const { session, rules, allRules, players, polls, openPoll, now, newest, refetch, supabase, gone } = useEscalation(initial, serverNow, { sound })
  const router = useRouter()
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
    const slice = slices.find((s) => s.item.id === (data ?? -1)) ?? slices[0]
    await spinTo(rotation, slice)
    setSpinning(false)
    celebrate()
    await refetch()
  }

  const overlayUrl = typeof window === "undefined" ? "" : `${location.origin}/overlay/eskalation/${session.id}`
  const needsBase = session.status === "bereit" && allRules.length === 0
  const showWheel = isHost && (needsBase || spinning)

  const back = session.replay_of ? `/eskalation/${session.replay_of}` : "/eskalation"
  if (gone) return <GoneNote back={back} />

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
      {!session.official && <UnofficialNote game="eskalation" replay />}

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
              onFinish={async (winner) => {
                await call(() => supabase.rpc("escalation_finish", { p_session: session.id, p_winner: winner }))
                if (!session.official) router.push(back)
              }}
              players={players}
              winnerName={session.winner_name}
              official={session.official}
              replay={
                session.official ? <ReplayButton kind="eskalation" sourceId={session.id} loggedIn={!!userId} /> : null
              }
            />
          )}

          {isHost && session.mode === "chat" && <ChatBridge session={session} polls={polls} supabase={supabase} />}

          <PlayersPanel
            players={players}
            hostId={session.host_id}
            ended={session.status === "beendet"}
            maxPlayers={session.max_players}
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
  official,
  replay,
}: {
  isHost: boolean
  status: string
  busy: boolean
  onStart: () => void
  onFinish: (winner: string | null) => void
  players: EscPlayer[]
  winnerName: string | null
  official: boolean
  replay: React.ReactNode
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
        <div className="mt-2">{replay}</div>
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
    return <WinnerPicker players={players} busy={busy} onFinish={onFinish} onBack={() => setChoosing(false)} />
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
      <button
        className="btn-danger px-8 py-3 font-display text-2xl"
        onClick={() =>
          official ? setChoosing(true) : confirm("Runde beenden? Nachspiel-Runden ohne Admin werden nicht gespeichert.") && onFinish(null)
        }
        disabled={busy}
      >
        ⏹ ENDE
      </button>
    </div>
  )
}
