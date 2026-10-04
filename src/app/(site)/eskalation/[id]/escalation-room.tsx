"use client"

import { useMotionValue } from "framer-motion"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { RuleBoard } from "@/components/escalation/rule-board"
import { useEscalation, type EscState } from "@/components/escalation/use-escalation"
import { buildSlices, spinTo, WheelSvg } from "@/components/wheel-svg"
import { audioReady, playAlarm, unlockAudio } from "@/lib/alarm"
import { celebrate } from "@/lib/confetti"

type PoolRule = { id: number; text: string }

export function EscalationRoom({
  initial,
  pool,
  isHost,
  serverNow,
}: {
  initial: EscState
  pool: PoolRule[]
  isHost: boolean
  serverNow: number
}) {
  const [sound, setSound] = useState(false)
  const { session, rules, allRules, now, newest, refetch, supabase } = useEscalation(initial, serverNow, { sound })
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
              onStop={(result) => call(() => supabase.rpc("escalation_stop", { p_session: session.id, p_result: result }))}
              hasChallenge={!!session.challenge_id}
            />
          )}

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
          <RuleBoard session={session} rules={rules} now={now} newest={newest} />
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
  onStop,
  hasChallenge,
}: {
  isHost: boolean
  status: string
  busy: boolean
  onStart: () => void
  onStop: (result: "geschafft" | "gescheitert" | null) => void
  hasChallenge: boolean
}) {
  if (!isHost) {
    return (
      <div className="panel text-muted">
        {status === "bereit" && "Warte auf den Start – der Host startet die Runde."}
        {status === "laeuft" && "Die Runde läuft. Neue Regeln erscheinen automatisch."}
        {status === "beendet" && "Diese Runde ist beendet."}
      </div>
    )
  }
  if (status === "bereit") {
    return (
      <div className="panel flex flex-col items-center gap-3 text-center">
        <p className="text-muted">Grundregel steht. Startet jetzt gemeinsam die Fortnite-Runde und drückt dann Start.</p>
        <button className="btn-primary px-12 py-5 font-display text-3xl" onClick={onStart} disabled={busy}>
          ▶ START
        </button>
        <p className="text-xs text-muted">Danach kommt automatisch nach jedem Timer-Ablauf eine neue Regel dazu.</p>
      </div>
    )
  }
  if (status === "laeuft") {
    return (
      <div className="panel flex flex-col gap-3">
        <h2 className="font-display text-xl">Runde beenden</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn-win" disabled={busy} onClick={() => onStop("geschafft")}>🏆 Geschafft</button>
          <button className="btn-danger" disabled={busy} onClick={() => onStop("gescheitert")}>💀 Gescheitert</button>
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={() => confirm("Runde ohne Wertung beenden?") && onStop(null)}
          >
            Ohne Wertung beenden
          </button>
        </div>
        <p className="text-xs text-muted">Mit Ergebnis landet die Runde in den Stats.</p>
      </div>
    )
  }
  return (
    <div className="panel text-muted">
      Runde beendet{hasChallenge ? " – in den Stats eingetragen." : "."}{" "}
      <Link href="/eskalation" className="text-accent-2 underline">Neue Runde eröffnen</Link>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
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
      {done ? "Kopiert ✓" : "Kopieren"}
    </button>
  )
}
