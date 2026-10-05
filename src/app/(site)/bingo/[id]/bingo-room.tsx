"use client"

import clsx from "clsx"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { BingoGrid } from "@/components/bingo/bingo-grid"
import { CardPreview } from "@/components/bingo/card-editor"
import { RankingList } from "@/components/bingo/ranking-list"
import { useBingoRound } from "@/components/bingo/use-bingo"
import { GoneNote, UnofficialNote } from "@/components/replay-button"
import { CopyButton, PlayersPanel } from "@/components/session/players"
import { ranking, type BingoState } from "@/lib/bingo-live"
import { createClient } from "@/lib/supabase/client"

export function BingoRoom({ initial, userId, isAdmin }: { initial: BingoState; userId: string | null; isAdmin: boolean }) {
  const router = useRouter()
  const { state, setState, refetch, supabase, gone } = useBingoRound(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { round, players } = state ?? initial
  const me = players.find((p) => p.user_id === userId) ?? null
  const isHost = !!userId && userId === round.host_id
  const ranked = useMemo(() => (state ? ranking(state) : []), [state])
  const ended = round.status === "beendet"

  if (gone) return <GoneNote back="/bingo" />

  async function call(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true)
    setError(null)
    const { error } = await fn()
    if (error) setError(error.message)
    await refetch()
    setBusy(false)
  }

  async function toggle(index: number) {
    if (!me) return
    const on = !me.marks[index]
    // Sofort anzeigen, Datenbank bestätigt
    setState((s) => s && { ...s, players: s.players.map((p) => (p.user_id === me.user_id ? { ...p, marks: p.marks.map((m, i) => (i === index ? on : m)) } : p)) })
    const { error } = await supabase.rpc("bingo_mark", { p_round: round.id, p_index: index, p_on: on })
    if (error) setError(error.message)
    await refetch()
  }

  async function finish() {
    const q = round.official
      ? "Runde beenden? Wer die meisten Punkte hat, gewinnt."
      : "Runde beenden? Runden ohne Admin werden nicht gespeichert."
    if (!confirm(q)) return
    setBusy(true)
    const { data, error } = await supabase.rpc("bingo_finish", { p_round: round.id })
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    if (data === "geloescht") router.push("/bingo")
    else await refetch()
    setBusy(false)
  }

  async function playAgain() {
    if (!round.template_id) return
    setBusy(true)
    const { data, error } = await createClient().rpc("bingo_round_create", { p_template: round.template_id, p_title: round.title ?? "", p_max_players: round.max_players })
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    router.push(`/bingo/${data}`)
  }

  const winners = players.filter((p) => p.won).map((p) => p.display_name)
  const origin = typeof window === "undefined" ? "" : location.origin

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/bingo" className="text-sm text-muted hover:text-white">← Runden</Link>
        <h1 className="font-display text-3xl text-accent sm:text-4xl">{round.title ?? `Bingo #${round.id}`}</h1>
        <span className={clsx("chip ml-auto", round.status === "laeuft" && "border-win text-win")}>
          {{ lobby: "Lobby", laeuft: "Läuft", beendet: "Beendet" }[round.status]}
        </span>
      </div>
      {error && <p className="rounded-xl border border-fail bg-fail/10 px-3 py-2 text-sm text-fail">{error}</p>}
      {!round.official && <UnofficialNote game="bingo" />}

      {ended && (
        <section className="panel flex flex-col items-center gap-3 text-center">
          <div className="font-display text-3xl text-accent">{winners.length ? `🏆 ${winners.join(" & ")} ${winners.length > 1 ? "gewinnen" : "gewinnt"}!` : "Runde beendet"}</div>
          {userId && round.template_id && (
            <button className="btn-primary" onClick={playAgain} disabled={busy}>
              🔁 Nochmal mit dieser Karte
            </button>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          {round.status === "lobby" ? (
            <section className="panel flex flex-col gap-3">
              <h2 className="font-display text-2xl">Die Karte</h2>
              <div className="max-w-md">
                <CardPreview tasks={round.tasks} />
              </div>
              {isHost ? (
                <button
                  className="btn-primary self-start px-10 py-4 font-display text-2xl"
                  disabled={busy}
                  onClick={() => (players.length > 1 || confirm("Allein starten?")) && call(() => supabase.rpc("bingo_start", { p_round: round.id }))}
                >
                  ▶ START
                </button>
              ) : (
                <p className="text-sm text-muted">Warte auf den Start – der Host startet die Runde.</p>
              )}
            </section>
          ) : me ? (
            <BingoGrid
              title={ended ? "Deine Karte" : "Deine Karte – antippen zum Abhaken"}
              tasks={round.tasks}
              marks={me.marks}
              onToggle={ended ? undefined : toggle}
              highlight
            />
          ) : (
            <p className="panel text-muted">Du spielst in dieser Runde nicht mit – unten siehst du die Karten aller Spieler live.</p>
          )}

          {round.status !== "lobby" && (
            <section className="flex flex-col gap-3">
              <h2 className="font-display text-xl">Alle Karten</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {players
                  .filter((p) => p.user_id !== userId)
                  .map((p) => (
                    <BingoGrid key={p.user_id} title={`${p.won ? "🏆 " : ""}${p.display_name}`} tasks={round.tasks} marks={p.marks} compact />
                  ))}
              </div>
            </section>
          )}

          <PlayersPanel
            players={players}
            hostId={round.host_id}
            ended={round.status !== "lobby" /* Beitreten/Austreten nur in der Lobby */}
            maxPlayers={round.max_players}
            userId={userId}
            isHost={isHost}
            isPlayer={!!me}
            busy={busy}
            canJoin={round.status === "lobby"}
            codeKind="bingo"
            roundId={round.id}
            onJoin={(code) => call(() => supabase.rpc("bingo_join", { p_round: round.id, p_code: code }))}
            onLeave={(user) => call(() => supabase.rpc("bingo_leave", { p_round: round.id, p_user: user }))}
          />
        </div>

        <div className="flex flex-col gap-4 self-start lg:sticky lg:top-20">
          <section className="panel">
            <h2 className="mb-3 font-display text-2xl">Punkte</h2>
            <RankingList entries={ranked} me={userId} />
          </section>
          {isHost && round.status === "laeuft" && (
            <button className="btn-danger px-6 py-3 font-display text-xl" onClick={finish} disabled={busy}>
              ⏹ Runde beenden
            </button>
          )}
          {(isHost || isAdmin) && round.official && (
            <section className="panel flex flex-col gap-2">
              <h2 className="font-display text-xl">OBS-Overlays</h2>
              <p className="text-xs text-muted">Zeigen immer die neueste offizielle Runde – Alvis Karte, wenn er mitspielt. Hintergrund transparent.</p>
              {[
                ["Karte (z. B. 600 × 680)", `${origin}/overlay/bingo/karte`],
                ["Rangliste (z. B. 460 × 700)", `${origin}/overlay/bingo/rangliste`],
              ].map(([label, url]) => (
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
