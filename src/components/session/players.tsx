"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

/** Mitspieler einer Mehrspieler-Runde (Regel-Eskalation, Loadout-Würfel) */
export type SessionPlayer = { user_id: string; display_name: string | null; avatar_url: string | null }

/** Runden mit Join-Code */
export type JoinKind = "auktion" | "eskalation" | "loadout" | "bingo" | "olympiade"

/** Join-Code der Runde – nur Host und Admins bekommen ihn (sonst null) */
export function useJoinCode(kind: JoinKind, roundId: number, enabled: boolean) {
  const [code, setCode] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    createClient()
      .rpc("join_code", { p_kind: kind, p_id: roundId })
      .then(({ data }) => alive && setCode(data ?? null))
    return () => {
      alive = false
    }
  }, [kind, roundId, enabled])
  return code
}

/** Join-Funktionen melden einen falschen Code als Text (null = beigetreten) – hier als normaler Fehler */
export async function joinResult(call: PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  const { data, error } = await call
  return { error: error ?? (typeof data === "string" && data ? { message: data } : null) }
}

/** Code aus dem Einladungslink (?code=…) */
function codeFromUrl() {
  if (typeof window === "undefined") return ""
  return new URLSearchParams(location.search).get("code")?.toUpperCase() ?? ""
}

/** Für Host/Admins: Code verdeckt anzeigen (Stream!), kopieren, Einladungslink mit Code */
export function JoinCodeBox({ code }: { code: string }) {
  const [show, setShow] = useState(false)
  const link = typeof window === "undefined" ? "" : `${location.origin}${location.pathname}?code=${code}`
  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-accent/5 px-3 py-2 text-sm">
      <span className="font-bold">🔑 Join-Code:</span>
      <span className="font-mono text-lg tracking-[0.3em]">{show ? code : "••••"}</span>
      <button className="text-xs text-muted underline hover:text-white" onClick={() => setShow((v) => !v)}>
        {show ? "verbergen" : "anzeigen"}
      </button>
      <span className="ml-auto flex flex-wrap gap-1">
        <CopyButton text={code} label="Code kopieren" />
        <CopyButton text={link} label="Einladungslink kopieren" />
      </span>
      <p className="w-full text-xs text-muted">
        Nur an deine Mitspieler schicken (z. B. per Discord) – ohne Code kann niemand beitreten, auch wenn er die Seite im Stream sieht. Der Link
        enthält den Code schon.
      </p>
    </div>
  )
}

/** Für alle anderen: Code eingeben (aus dem Einladungslink vorausgefüllt) und beitreten */
export function JoinCodeForm({ busy, onJoin, label = "Mitspielen" }: { busy: boolean; onJoin: (code: string) => void; label?: string }) {
  const [value, setValue] = useState("")
  useEffect(() => setValue(codeFromUrl()), [])
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        onJoin(value.trim())
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        maxLength={4}
        placeholder="Code"
        aria-label="Join-Code"
        className="input w-24 py-1 text-center font-mono uppercase tracking-widest"
      />
      <button className="btn-primary px-3 py-1 text-sm" disabled={busy || !value.trim()}>
        {label}
      </button>
    </form>
  )
}

export function PlayersPanel({
  players,
  hostId,
  ended,
  userId,
  isHost,
  isPlayer,
  busy,
  onJoin,
  onLeave,
  canJoin = true,
  maxPlayers,
  codeKind,
  roundId,
}: {
  players: SessionPlayer[]
  hostId: string
  ended: boolean
  userId: string | null
  isHost: boolean
  isPlayer: boolean
  busy: boolean
  /** code: Join-Code (null für Host/Admins, die keinen brauchen) */
  onJoin: (code: string | null) => void
  onLeave: (user: string | null) => void
  /** Beitreten nur bis zu diesem Zeitpunkt möglich (z. B. vor dem Start) */
  canJoin?: boolean
  maxPlayers?: number
  /** Spielart und Runde für den Join-Code */
  codeKind: JoinKind
  roundId: number
}) {
  const full = !!maxPlayers && players.length >= maxPlayers
  // Host und Admins sehen den Code und brauchen selbst keinen
  const code = useJoinCode(codeKind, roundId, !!userId && !ended)
  return (
    <div className="panel flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl">
          Mitspieler ({players.length}
          {maxPlayers ? `/${maxPlayers}` : ""})
        </h2>
        {!ended && canJoin && userId && !isPlayer && !full && (
          <div className="ml-auto">
            {code ? (
              <button className="btn-primary px-3 py-1 text-sm" disabled={busy} onClick={() => onJoin(null)}>Mitspielen</button>
            ) : (
              <JoinCodeForm busy={busy} onJoin={onJoin} />
            )}
          </div>
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
      {!ended && code && canJoin && <JoinCodeBox code={code} />}
      {!ended && !code && canJoin && !isPlayer && (
        <p className="text-xs text-muted">
          {userId ? "Zum Mitspielen brauchst du den Join-Code vom Host." : "Zum Mitspielen mit Twitch einloggen – den Join-Code bekommst du vom Host."}
        </p>
      )}
    </div>
  )
}

export function CopyButton({ text, label = "Kopieren" }: { text: string; label?: string }) {
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

export function WinnerPicker({
  players,
  busy,
  onFinish,
  onBack,
}: {
  players: SessionPlayer[]
  busy: boolean
  onFinish: (winner: string | null) => void
  onBack: () => void
}) {
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
        <button className="btn-secondary" disabled={busy} onClick={onBack}>
          Zurück
        </button>
      </div>
      <p className="text-xs text-muted">Der Sieg zählt für die Bestenliste in den Stats.</p>
    </div>
  )
}
