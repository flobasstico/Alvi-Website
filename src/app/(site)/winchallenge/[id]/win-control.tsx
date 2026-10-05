"use client"

import clsx from "clsx"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { CopyButton } from "@/components/session/players"
import { useWin } from "@/components/winchallenge/use-win"
import { WinBoard } from "@/components/winchallenge/win-board"
import { celebrate } from "@/lib/confetti"
import { progress, remainingSeconds, type WinState } from "@/lib/winchallenge"
import { deleteWinChallenge } from "../actions"

export function WinControl({ initial, isAdmin, serverNow }: { initial: WinState; isAdmin: boolean; serverNow: number }) {
  const { state, setState, now, refetch, supabase } = useWin(initial, serverNow)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newTarget, setNewTarget] = useState(1)
  const { challenge: c, games } = state!
  const p = progress(games)
  const remaining = remainingSeconds(c, now)
  const ended = c.status === "beendet"
  const timeUp = remaining === 0 && !ended

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true)
    setError(null)
    const { error } = await fn()
    if (error) setError(error.message)
    await refetch()
    setBusy(false)
  }

  // Alle Ziele erreicht → Timer anhalten (umkehrbar: mit −1 korrigieren und fortsetzen)
  const wasComplete = useRef(p.complete)
  useEffect(() => {
    if (p.complete && !wasComplete.current) {
      celebrate()
      if (isAdmin && c.status === "laeuft") void run(() => supabase.rpc("win_timer", { p_id: c.id, p_action: "pause" }))
    }
    wasComplete.current = p.complete
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.complete])

  async function addWin(gameId: number, delta: number) {
    // Sofort anzeigen, Datenbank bestätigt
    setState((s) => s && { ...s, games: s.games.map((g) => (g.id === gameId ? { ...g, wins: Math.max(0, g.wins + delta) } : g)) })
    await run(() => supabase.rpc("win_add", { p_game: gameId, p_delta: delta }))
  }

  const overlayUrl = typeof window === "undefined" ? "" : `${location.origin}/overlay/winchallenge`
  const overlayIdUrl = typeof window === "undefined" ? "" : `${location.origin}/overlay/winchallenge/${c.id}`

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/winchallenge" className="text-sm text-muted hover:text-white">← Winchallenges</Link>
      </div>
      {error && <p className="rounded-xl border border-fail bg-fail/10 px-3 py-2 text-sm text-fail">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
        <div className="flex flex-col gap-4">
          {isAdmin && !ended ? (
            <>
              <section className="panel flex flex-col gap-3">
                <h2 className="font-display text-2xl">Timer</h2>
                <div className="flex flex-wrap gap-2">
                  {c.status !== "laeuft" ? (
                    <button
                      className="btn-primary px-8 py-3 font-display text-2xl"
                      disabled={busy || timeUp}
                      onClick={() => run(() => supabase.rpc("win_timer", { p_id: c.id, p_action: "start" }))}
                    >
                      {c.status === "pausiert" ? "▶ FORTSETZEN" : "▶ START"}
                    </button>
                  ) : (
                    <button
                      className="btn-secondary px-8 py-3 font-display text-2xl"
                      disabled={busy}
                      onClick={() => run(() => supabase.rpc("win_timer", { p_id: c.id, p_action: "pause" }))}
                    >
                      ⏸ PAUSE
                    </button>
                  )}
                  <button
                    className="btn-secondary"
                    disabled={busy || c.status === "bereit"}
                    onClick={() => confirm("Timer auf Anfang zurücksetzen? Die Siege bleiben.") && run(() => supabase.rpc("win_timer", { p_id: c.id, p_action: "reset" }))}
                  >
                    ↺ Zurücksetzen
                  </button>
                </div>
                {timeUp && <p className="text-sm text-fail">Die Zeit ist abgelaufen – jetzt werten.</p>}
                {p.complete && <p className="text-sm text-win">Alle Siege geschafft! Der Timer ist angehalten – jetzt werten.</p>}
              </section>

              <section className="panel flex flex-col gap-3">
                <h2 className="font-display text-2xl">Siege zählen</h2>
                <ul className="flex flex-col gap-2">
                  {games.map((g) => (
                    <li key={g.id} className={clsx("flex flex-wrap items-center gap-2 rounded-xl border p-2", g.wins >= g.target ? "border-win/60 bg-win/10" : "border-line bg-bg/40")}>
                      <span className="min-w-32 flex-1 font-bold">{g.name}</span>
                      <button className="btn-secondary h-10 w-10 px-0 text-xl" disabled={busy || g.wins === 0} onClick={() => addWin(g.id, -1)} aria-label={`${g.name} −1`}>
                        −
                      </button>
                      <span className="w-20 text-center font-mono text-xl font-bold tabular-nums">
                        {g.wins} / {g.target}
                      </span>
                      <button className="btn-primary h-10 w-14 px-0 text-xl" disabled={busy} onClick={() => addWin(g.id, 1)} aria-label={`${g.name} +1`}>
                        +1
                      </button>
                      <TargetInput
                        value={g.target}
                        onSave={(target) => run(() => supabase.from("win_challenge_games").update({ target }).eq("id", g.id))}
                      />
                      <button
                        className="text-muted hover:text-fail"
                        title="Spiel entfernen"
                        disabled={busy}
                        onClick={() => confirm(`„${g.name}“ entfernen?`) && run(() => supabase.from("win_challenge_games").delete().eq("id", g.id))}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
                <form
                  className="flex flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const name = newName.trim()
                    if (!name) return
                    const position = Math.max(-1, ...games.map((g) => g.position)) + 1
                    void run(() => supabase.from("win_challenge_games").insert({ challenge_id: c.id, name, target: Math.max(1, newTarget || 1), position }))
                    setNewName("")
                    setNewTarget(1)
                  }}
                >
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Spiel hinzufügen" maxLength={60} className="input min-w-40 flex-1" />
                  <input type="number" min={1} max={999} value={newTarget} onChange={(e) => setNewTarget(Number(e.target.value))} className="input w-20" aria-label="Benötigte Siege" />
                  <button className="btn-secondary" disabled={busy || !newName.trim()}>Hinzufügen</button>
                </form>
              </section>

              <button
                className="btn-danger self-start px-6 py-3 font-display text-xl"
                disabled={busy}
                onClick={() =>
                  confirm(p.complete ? "Winchallenge als GESCHAFFT werten?" : "Noch nicht alle Siege – Winchallenge als GESCHEITERT werten?") &&
                  run(() => supabase.rpc("win_finish", { p_id: c.id }))
                }
              >
                ⏹ Beenden &amp; werten
              </button>
            </>
          ) : (
            <section className="panel text-muted">
              {ended ? (c.result === "geschafft" ? "🏆 Geschafft! Das Ergebnis steht in den Stats." : "Gescheitert – das Ergebnis steht in den Stats.") : "Live-Ansicht – gesteuert wird von Alvi."}
            </section>
          )}

          {isAdmin && (
            <section className="panel flex flex-col gap-2">
              <h2 className="font-display text-xl">OBS-Overlay</h2>
              <p className="text-sm text-muted">
                Als <b>Browserquelle</b> einfügen (z. B. 480 × 600), Hintergrund transparent. Der erste Link zeigt immer die neueste Winchallenge – in OBS nur einmal einrichten.
              </p>
              <div className="flex gap-2">
                <input readOnly value={overlayUrl} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
                <CopyButton text={overlayUrl} />
              </div>
              <details className="text-xs text-muted">
                <summary className="cursor-pointer">Link nur für diese Winchallenge</summary>
                <div className="mt-2 flex gap-2">
                  <input readOnly value={overlayIdUrl} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
                  <CopyButton text={overlayIdUrl} />
                </div>
              </details>
            </section>
          )}

          {isAdmin && (
            <button
              className="self-start text-sm text-muted underline hover:text-fail"
              disabled={busy}
              onClick={async () => {
                if (!confirm(`Winchallenge „${c.title ?? `#${c.id}`}“ endgültig löschen?`)) return
                setBusy(true)
                await deleteWinChallenge(c.id)
              }}
            >
              Winchallenge löschen
            </button>
          )}
        </div>

        <div className="self-start lg:sticky lg:top-20">
          <WinBoard state={state!} now={now} />
        </div>
      </div>
    </div>
  )
}

function TargetInput({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value))
  useEffect(() => setV(String(value)), [value])
  return (
    <label className="flex items-center gap-1 text-xs text-muted" title="Benötigte Siege ändern">
      Ziel
      <input
        type="number"
        min={1}
        max={999}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = Math.min(999, Math.max(1, Math.round(Number(v)) || 1))
          if (n !== value) onSave(n)
          else setV(String(value))
        }}
        className="input w-16 py-1 text-sm"
      />
    </label>
  )
}
