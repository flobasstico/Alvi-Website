"use client"

import clsx from "clsx"
import { useMotionValue } from "framer-motion"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ScoreBoard } from "@/components/olympiade/score-board"
import { useOlympic } from "@/components/olympiade/use-olympic"
import { UnofficialNote } from "@/components/replay-button"
import { CopyButton, joinResult, PlayersPanel } from "@/components/session/players"
import { buildSlices, spinTo, WheelSvg } from "@/components/wheel-svg"
import { celebrate } from "@/lib/confetti"
import { drawnGames, OLYMPIC_STATUS, openGame, wheelGames, type OlympicGame, type OlympicState } from "@/lib/olympiade"

const pts = (n: number) => `${n} ${n === 1 ? "Punkt" : "Punkte"}`

export function OlympicRoom({ initial, userId, isAdmin }: { initial: OlympicState; userId: string | null; isAdmin: boolean }) {
  const router = useRouter()
  const { state, refetch, supabase, gone } = useOlympic(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newGame, setNewGame] = useState("")
  const s = state ?? initial
  const { olympic, games, players } = s
  const isHost = !!userId && userId === olympic.host_id
  const canControl = isHost || isAdmin
  const isPlayer = players.some((p) => p.user_id === userId)
  const ended = olympic.status === "beendet"
  const running = olympic.status === "laeuft"

  // ---- Rad: jede neue Ziehung wird bei allen Zuschauern animiert ----
  const rotation = useMotionValue(0)
  const [spinTarget, setSpinTarget] = useState<OlympicGame | null>(null)
  const lastSpin = useRef(olympic.spun_at)
  useEffect(() => {
    const spun = olympic.spun_at
    if (!spun || spun === lastSpin.current) return
    lastSpin.current = spun
    const target = games.find((g) => g.id === olympic.current_game_id)
    // Nur frische Ziehungen animieren (nicht beim späten Öffnen der Seite)
    if (!target || Date.now() - new Date(spun).getTime() > 20000) return
    setSpinTarget(target)
  }, [olympic.spun_at, olympic.current_game_id, games])

  const wheelList = spinTarget ? games.filter((g) => g.position == null || g.id === spinTarget.id).sort((a, b) => a.id - b.id) : wheelGames(games)
  const slices = buildSlices(wheelList.map((g) => ({ ...g, text: g.name, weight: 1 })))

  useEffect(() => {
    if (!spinTarget) return
    const slice = slices.find((x) => x.item.id === spinTarget.id)
    if (!slice) return setSpinTarget(null)
    let cancelled = false
    spinTo(rotation, slice).then(() => {
      if (cancelled) return
      celebrate()
      setSpinTarget(null)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinTarget])

  if (gone)
    return (
      <div className="panel flex flex-col items-center gap-3 py-10 text-center">
        <div className="font-display text-3xl">Olympiade beendet</div>
        <p className="text-muted">Olympiaden ohne Admin werden nicht gespeichert.</p>
        <Link href="/olympiade" className="btn-primary">Zur Übersicht</Link>
      </div>
    )

  async function call(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true)
    setError(null)
    const { error } = await fn()
    if (error) setError(error.message)
    await refetch()
    setBusy(false)
  }

  async function finish() {
    const open = wheelGames(games).length + (openGame(s) ? 1 : 0)
    const q = [
      open ? `Noch ${open} ${open === 1 ? "Spiel ist" : "Spiele sind"} offen.` : "",
      olympic.official ? "Olympiade beenden? Wer die meisten Punkte hat, gewinnt." : "Olympiade beenden? Ohne Admin wird sie nicht gespeichert.",
    ].join(" ")
    if (!confirm(q.trim())) return
    setBusy(true)
    const { data, error } = await supabase.rpc("olympic_finish", { p_id: olympic.id })
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    if (data === "geloescht") router.push("/olympiade")
    else {
      await refetch()
      celebrate()
    }
    setBusy(false)
  }

  const current = spinTarget ? null : openGame(s)
  const drawn = drawnGames(games)
  const onWheel = wheelGames(games)
  const nameOf = (id: string | null) => players.find((p) => p.user_id === id)?.display_name ?? "?"
  const winners = players.filter((p) => p.won).map((p) => p.display_name)
  const origin = typeof window === "undefined" ? "" : location.origin

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/olympiade" className="text-sm text-muted hover:text-white">← Olympiaden</Link>
        <h1 className="font-display text-3xl text-accent sm:text-4xl">{olympic.title ?? `Olympiade #${olympic.id}`}</h1>
        <span className={clsx("chip ml-auto", running && "border-win text-win")}>{OLYMPIC_STATUS[olympic.status]}</span>
      </div>
      {error && <p className="rounded-xl border border-fail bg-fail/10 px-3 py-2 text-sm text-fail">{error}</p>}
      {!olympic.official && <UnofficialNote game="olympiade" />}

      {ended && (
        <section className="panel text-center font-display text-3xl text-accent">
          {winners.length ? `🏆 ${winners.join(" & ")} ${winners.length > 1 ? "gewinnen" : "gewinnt"}!` : "Olympiade beendet"}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          {olympic.status === "lobby" && (
            <section className="panel flex flex-col gap-3">
              <h2 className="font-display text-2xl">Lobby</h2>
              <p className="text-sm text-muted">
                Mitspieler treten über den Einladungslink bei. {games.length} Spiele auf dem Rad – das 1. gedrehte Spiel bringt 1 Punkt, das 2. zwei Punkte usw.
              </p>
              {canControl ? (
                <button
                  className="btn-primary self-start px-10 py-4 font-display text-2xl"
                  disabled={busy || players.length < 2 || games.length < 2}
                  onClick={() => call(() => supabase.rpc("olympic_start", { p_id: olympic.id }))}
                >
                  START
                </button>
              ) : (
                <p className="text-muted">Warte auf den Start durch den Host…</p>
              )}
              {canControl && players.length < 2 && <p className="text-xs text-muted">Mindestens 2 Spieler nötig.</p>}
            </section>
          )}

          {running && (current ? (
            <section className="panel flex flex-col items-center gap-4 text-center">
              <div className="text-sm font-bold uppercase text-muted">Spiel {current.position} von {games.length}</div>
              <div className="font-display text-4xl text-accent sm:text-5xl">{current.name}</div>
              <div className="chip">{pts(current.position!)}</div>
              {canControl ? (
                <>
                  <div className="text-sm text-muted">Wer hat gewonnen?</div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {players.map((p) => (
                      <button
                        key={p.user_id}
                        className="btn-secondary px-4 py-2 font-bold"
                        disabled={busy}
                        onClick={() => call(() => supabase.rpc("olympic_decide", { p_game: current.id, p_winner: p.user_id }))}
                      >
                        🏆 {p.display_name}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-muted">Wird gespielt – der Host markiert gleich den Sieger.</p>
              )}
            </section>
          ) : wheelList.length > 0 ? (
            <section className="panel flex flex-col items-center gap-4">
              <WheelSvg slices={slices} rotation={rotation} />
              {canControl ? (
                <button
                  className="btn-primary px-10 py-4 font-display text-2xl"
                  disabled={busy || !!spinTarget}
                  onClick={() => call(() => supabase.rpc("olympic_spin", { p_id: olympic.id }))}
                >
                  {spinTarget ? "Dreht…" : `DREHEN! (Spiel ${drawn.length + 1})`}
                </button>
              ) : (
                <p className="text-muted">{spinTarget ? "Dreht…" : "Der Host dreht gleich das nächste Spiel."}</p>
              )}
            </section>
          ) : (
            <section className="panel flex flex-col items-center gap-3 text-center">
              <div className="font-display text-3xl">Alle Spiele gespielt!</div>
              {canControl && (
                <button className="btn-primary px-8 py-3 font-display text-xl" onClick={finish} disabled={busy}>
                  🏁 Olympiade beenden &amp; Sieger küren
                </button>
              )}
            </section>
          ))}

          {drawn.length > 0 && (
            <section className="panel">
              <h2 className="mb-2 font-display text-xl">Gespielt</h2>
              <ol className="flex flex-col gap-1.5">
                {drawn.map((g) => (
                  <li key={g.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-bg/40 px-3 py-2">
                    <span className="w-8 font-display text-xl text-muted">{g.position}.</span>
                    <span className="flex-1 font-bold">{g.name}</span>
                    <span className="text-xs text-muted">{pts(g.position!)}</span>
                    {canControl && running && g.winner_id ? (
                      <select
                        className="input w-auto py-1 text-sm"
                        value={g.winner_id}
                        disabled={busy}
                        title="Sieger korrigieren"
                        onChange={(e) => call(() => supabase.rpc("olympic_decide", { p_game: g.id, p_winner: e.target.value }))}
                      >
                        {players.map((p) => (
                          <option key={p.user_id} value={p.user_id}>🏆 {p.display_name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={clsx("chip", g.winner_id && "border-accent text-accent")}>{g.winner_id ? `🏆 ${nameOf(g.winner_id)}` : "läuft"}</span>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {!ended && (
            <section className="panel">
              <h2 className="mb-2 font-display text-xl">Auf dem Rad ({onWheel.length})</h2>
              <ul className="flex flex-wrap gap-2">
                {onWheel.map((g) => (
                  <li key={g.id} className="flex items-center gap-2 rounded-full border border-line bg-panel-2 px-3 py-1 text-sm font-semibold">
                    {g.name}
                    {canControl && (
                      <button
                        className="text-muted hover:text-fail"
                        title="Entfernen"
                        disabled={busy || !!spinTarget}
                        onClick={() => call(() => supabase.rpc("olympic_remove_game", { p_game: g.id }))}
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
                {!onWheel.length && <li className="text-sm text-muted">Leer.</li>}
              </ul>
              {canControl && (
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!newGame.trim()) return
                    call(() => supabase.rpc("olympic_add_game", { p_id: olympic.id, p_name: newGame })).then(() => setNewGame(""))
                  }}
                >
                  <input value={newGame} onChange={(e) => setNewGame(e.target.value)} maxLength={60} className="input" placeholder="Spiel hinzufügen" />
                  <button className="btn-secondary shrink-0" disabled={busy || !newGame.trim()}>+ Hinzufügen</button>
                </form>
              )}
            </section>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <ScoreBoard state={s} />
          <PlayersPanel
            players={players}
            hostId={olympic.host_id}
            ended={olympic.status !== "lobby"}
            userId={userId}
            isHost={isHost}
            isPlayer={isPlayer}
            busy={busy}
            canJoin={olympic.status === "lobby"}
            maxPlayers={olympic.max_players}
            codeKind="olympiade"
            roundId={olympic.id}
            onJoin={(code) => call(() => joinResult(supabase.rpc("olympic_join", { p_id: olympic.id, p_code: code })))}
            onLeave={(u) => call(() => supabase.rpc("olympic_leave", { p_id: olympic.id, p_user: u }))}
          />
          {canControl && running && (
            <button className="btn-secondary px-6 py-3 font-display text-xl" onClick={finish} disabled={busy}>
              ⏹ Olympiade beenden
            </button>
          )}
          {canControl && (
            <section className="panel flex flex-col gap-2">
              <h2 className="font-display text-xl">OBS-Overlay</h2>
              <p className="text-xs text-muted">Kleine Punkteanzeige mit transparentem Hintergrund (z. B. 420 × 400).</p>
              {(olympic.official
                ? [["Fester Link – immer die neueste offizielle Olympiade", `${origin}/overlay/olympiade`], ["Nur diese Olympiade", `${origin}/overlay/olympiade/${olympic.id}`]]
                : [["Nur diese Olympiade", `${origin}/overlay/olympiade/${olympic.id}`]]
              ).map(([label, url]) => (
                <div key={url}>
                  <div className="label">{label}</div>
                  <div className="flex gap-2">
                    <input readOnly value={url} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
                    <CopyButton text={url} />
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
