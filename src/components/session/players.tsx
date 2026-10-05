"use client"

import { useState } from "react"

/** Mitspieler einer Mehrspieler-Runde (Regel-Eskalation, Loadout-Würfel) */
export type SessionPlayer = { user_id: string; display_name: string | null; avatar_url: string | null }

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
}: {
  players: SessionPlayer[]
  hostId: string
  ended: boolean
  userId: string | null
  isHost: boolean
  isPlayer: boolean
  busy: boolean
  onJoin: () => void
  onLeave: (user: string | null) => void
  /** Beitreten nur bis zu diesem Zeitpunkt möglich (z. B. vor dem Start) */
  canJoin?: boolean
}) {
  const pageUrl = typeof window === "undefined" ? "" : location.href
  return (
    <div className="panel flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl">Mitspieler ({players.length})</h2>
        {!ended && canJoin && userId && !isPlayer && (
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
