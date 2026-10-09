"use client"

import { useState } from "react"
import { minigame, type MinigameKey } from "@/lib/minigames"
import { createClient } from "@/lib/supabase/client"
import { ShareButton } from "@/components/share-button"
import { DropZone } from "./drop-zone"
import { Leaderboard } from "./leaderboard"
import { StormRun } from "./storm-run"

type Result = { score: number; saved: boolean; record: boolean; error: string | null }

/**
 * Rahmen für ein Minispiel: Start, Spiel, Ergebnis + Bestenliste.
 * Eingeloggt wird jede Runde beim Server gestartet und danach eingereicht (die Datenbank prüft, ob das Ergebnis plausibel ist).
 */
export function GameShell({
  game,
  myId,
  myLogin = null,
  isAdmin,
  alviBest,
  myBest: initialBest,
}: {
  game: MinigameKey
  myId: string | null
  myLogin?: string | null
  isAdmin: boolean
  alviBest: number | null
  myBest: number | null
}) {
  const info = minigame(game)
  const [phase, setPhase] = useState<"start" | "play" | "result">("start")
  const [round, setRound] = useState(0)
  const [runId, setRunId] = useState<number | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [myBest, setMyBest] = useState(initialBest)
  const [reload, setReload] = useState(0)
  const [starting, setStarting] = useState(false)

  async function start() {
    if (starting) return
    setStarting(true)
    setStartError(null)
    setRunId(null)
    if (myId) {
      const { data, error } = await createClient().rpc("minigame_start", { p_game: game })
      if (error) setStartError(`${error.message} – diese Runde wird nicht gespeichert.`)
      else setRunId(data)
    }
    setRound((r) => r + 1)
    setPhase("play")
    setStarting(false)
  }

  async function finish(score: number) {
    let res: Result = { score, saved: false, record: false, error: null }
    if (runId) {
      const { data, error } = await createClient().rpc("minigame_submit", { p_run: runId, p_score: score })
      res = error ? { ...res, error: error.message } : { ...res, saved: true, record: !!data }
      if (!error && (myBest === null || score > myBest)) setMyBest(score)
      setReload((n) => n + 1)
    }
    setResult(res)
    setPhase("result")
  }

  const beatAlvi = result && alviBest !== null && result.score > alviBest

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="panel">
        <div className="relative mx-auto" style={{ maxWidth: game === "dropzone" ? 450 : 720 }}>
          {phase === "play" ? (
            game === "dropzone" ? (
              <DropZone key={round} onFinish={finish} />
            ) : (
              <StormRun key={round} onFinish={finish} />
            )
          ) : (
            <div
              className={
                "flex flex-col items-center justify-center gap-3 rounded-xl bg-gradient-to-b from-[#0f3a96] to-[#3d8bff] p-6 text-center " +
                (game === "dropzone" ? "aspect-[2/3]" : "aspect-[16/9]")
              }
            >
              {phase === "start" ? (
                <>
                  <div className="text-6xl">{info.emoji}</div>
                  <h2 className="font-display text-4xl text-accent">{info.title}</h2>
                  <p className="max-w-sm text-sm text-white/80">{info.controls}</p>
                </>
              ) : (
                result && (
                  <>
                    <div className="text-sm font-bold uppercase text-white/70">Ergebnis</div>
                    <div className="font-display text-6xl text-accent">{result.score.toLocaleString("de-DE")}</div>
                    {result.record && <div className="rounded-lg bg-accent px-3 py-1 font-display text-xl text-black">🏆 Neuer Rekord!</div>}
                    {beatAlvi && <div className="font-bold text-win">🔥 Du hast Alvi geschlagen ({alviBest})!</div>}
                    {alviBest !== null && !beatAlvi && <div className="text-sm text-white/80">Alvis Bestwert: {alviBest.toLocaleString("de-DE")}</div>}
                    {!myId && <p className="text-sm text-white/80">Mit Twitch einloggen, um in die Bestenliste zu kommen.</p>}
                    {result.error && <p className="text-sm text-fail">Nicht gespeichert: {result.error}</p>}
                    {/* Geteilt wird der Bestwert aus der Datenbank (Vorschaubild über ?von=) */}
                    <ShareButton
                      path={result.saved && myLogin ? `/minispiele/${game}?von=${myLogin}` : `/minispiele/${game}`}
                      text={
                        result.saved && myLogin
                          ? `Mein Rekord bei ${info.title}: ${(myBest ?? result.score).toLocaleString("de-DE")} Punkte – schlägst du mich?`
                          : `Ich habe ${result.score.toLocaleString("de-DE")} Punkte bei ${info.title} geschafft – schaffst du mehr?`
                      }
                      label="Ergebnis teilen"
                    />
                  </>
                )
              )}
              <button className="btn-primary mt-2 px-8 text-lg" onClick={start} disabled={starting}>
                {phase === "start" ? "▶ Spielen" : "↻ Nochmal"}
              </button>
            </div>
          )}
        </div>
        {startError && <p className="mt-2 text-center text-sm text-fail">{startError}</p>}
        <div className="mt-4 flex flex-wrap justify-center gap-3 text-sm">
          <span className="chip">Dein Rekord: {myBest !== null ? myBest.toLocaleString("de-DE") : "–"}</span>
          <span className="chip">🎮 Alvis Bestwert: {alviBest !== null ? alviBest.toLocaleString("de-DE") : "noch keiner"}</span>
        </div>
      </section>

      <aside className="panel h-fit">
        <h2 className="mb-3 font-display text-2xl">Bestenliste</h2>
        <Leaderboard game={game} myId={myId} isAdmin={isAdmin} reload={reload} />
      </aside>
    </div>
  )
}
