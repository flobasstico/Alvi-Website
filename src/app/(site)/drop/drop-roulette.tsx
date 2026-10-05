"use client"

import clsx from "clsx"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"
import { IslandMap } from "@/components/island-map"
import { OverlayLink } from "@/components/live-overlay/overlay-link"
import { SaveChallenge } from "@/components/save-challenge"
import { celebrate } from "@/lib/confetti"
import { MAX_DIAMETER, MAX_PLAYERS, MIN_DIAMETER, PLAYER_COLORS, rollCircles, type DropCircle, type DropSpot } from "@/lib/drop"
import { pushOverlay } from "@/lib/live-overlay"
import { pick, randomInt } from "@/lib/random"
import { createClient } from "@/lib/supabase/client"

type Rule = { id: number; text: string; weight: number }
type Result = { circles: DropCircle[]; names: string[]; rule: Rule | null }

const STORAGE_KEY = "drop-spieler"
const sizeLabel = (d: number) => (d < 12 ? "klein" : d < 20 ? "mittel" : "groß")

export function DropRoulette({
  spots,
  rules,
  mapUrl,
  isAdmin,
  overlayLogin = null,
}: {
  spots: DropSpot[]
  rules: Rule[]
  mapUrl?: string | null
  isAdmin: boolean
  /** Twitch-Name für den eigenen OBS-Link; mit Login wird jeder Sprung fürs Overlay gespeichert */
  overlayLogin?: string | null
}) {
  const [names, setNames] = useState<string[]>(["Spieler 1"])
  const [diameter, setDiameter] = useState(16)
  const [withRule, setWithRule] = useState(true)
  const [rolling, setRolling] = useState(false)
  const [preview, setPreview] = useState<DropCircle[]>([])
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Spielernamen und Kreisgröße pro Browser merken
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")
      if (Array.isArray(saved?.names) && saved.names.length) setNames(saved.names.slice(0, MAX_PLAYERS).map(String))
      if (typeof saved?.diameter === "number") setDiameter(Math.min(MAX_DIAMETER, Math.max(MIN_DIAMETER, saved.diameter)))
    } catch {}
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ names, diameter }))
    } catch {}
  }, [names, diameter])

  const count = names.length
  const label = (i: number) => names[i]?.trim() || `Spieler ${i + 1}`

  function setCount(n: number) {
    const next = Math.min(MAX_PLAYERS, Math.max(1, n))
    setNames((cur) => (next > cur.length ? [...cur, ...Array.from({ length: next - cur.length }, (_, i) => `Spieler ${cur.length + i + 1}`)] : cur.slice(0, next)))
  }

  async function roll() {
    if (rolling) return
    setError(null)
    const final = rollCircles(spots, count, diameter)
    if (!final) {
      setError(
        spots.length < count
          ? `Nur ${spots.length} Spots für ${count} Spieler – im Admin mehr Spots setzen.`
          : "Kein Platz für getrennte Kreise – kleinere Kreise wählen oder Spots weiter auseinander setzen.",
      )
      return
    }
    setRolling(true)
    setResult(null)
    const names = Array.from({ length: count }, (_, i) => label(i))
    // „Bus fliegt“: Kreise springen über die Karte, dann stehen sie
    const steps = 14 + randomInt(5)
    for (let t = 0; t < steps; t++) {
      setPreview(rollCircles(spots, count, diameter, 20) ?? final)
      await new Promise((r) => setTimeout(r, 60 + t * t * 1.1))
    }
    setPreview(final)
    const rule = withRule && rules.length ? pick(rules) : null
    setResult({ circles: final, names, rule })
    setRolling(false)
    if (overlayLogin)
      pushOverlay(createClient(), "drop", {
        circles: final.map((c, i) => ({ player: names[i], spot: c.spotName, color: PLAYER_COLORS[i] })),
        rule: rule?.text ?? null,
      })
    celebrate()
  }

  const shown = result?.circles ?? preview
  const title = result
    ? `Drop: ${result.circles.map((c, i) => (count > 1 ? `${result.names[i]} bei ${c.spotName}` : `Kreis bei ${c.spotName}`)).join(", ")}${result.rule ? ` – ${result.rule.text}` : ""}`
    : ""

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="panel p-2">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl">
          <IslandMap imageUrl={mapUrl} />
          <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full">
            <AnimatePresence>
              {shown.map((c, i) => (
                <motion.g key={`${i}-${rolling ? "roll" : "fix"}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <circle
                    cx={c.cx}
                    cy={c.cy}
                    r={c.r}
                    fill={PLAYER_COLORS[i]}
                    fillOpacity={rolling ? 0.15 : 0.25}
                    stroke={PLAYER_COLORS[i]}
                    strokeWidth={0.6}
                    strokeDasharray={rolling ? "1.5 1" : undefined}
                  />
                </motion.g>
              ))}
            </AnimatePresence>
          </svg>
          {!rolling &&
            result?.circles.map((c, i) => (
              <div
                key={i}
                className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded px-2 py-0.5 text-sm font-black text-black shadow"
                style={{ left: `${c.cx}%`, top: `${c.cy}%`, background: PLAYER_COLORS[i] }}
              >
                {count > 1 ? result.names[i] : "Hier landen!"}
              </div>
            ))}
        </div>
      </div>

      <aside className="panel flex flex-col gap-4">
        <div>
          <span className="label">Spieler</span>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Spieleranzahl">
            {Array.from({ length: MAX_PLAYERS }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                disabled={rolling}
                aria-pressed={n === count}
                className={clsx("h-9 w-9 rounded-lg border font-bold transition", n === count ? "border-accent bg-accent text-black" : "border-line bg-bg/60 hover:border-accent")}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        {count > 1 && (
          <div className="flex flex-col gap-2">
            {names.map((n, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: PLAYER_COLORS[i] }} />
                <input
                  value={n}
                  maxLength={30}
                  onChange={(e) => setNames((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))}
                  className="input py-1 text-sm"
                  disabled={rolling}
                  aria-label={`Name Spieler ${i + 1}`}
                />
              </div>
            ))}
          </div>
        )}
        <div>
          <label className="label" htmlFor="diameter">
            Kreisgröße: {sizeLabel(diameter)} ({diameter} % der Karte)
          </label>
          <input
            id="diameter"
            type="range"
            min={MIN_DIAMETER}
            max={MAX_DIAMETER}
            value={diameter}
            onChange={(e) => setDiameter(Number(e.target.value))}
            className="w-full accent-[var(--color-accent)]"
            disabled={rolling}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={withRule} onChange={(e) => setWithRule(e.target.checked)} />
          Mit Zusatzregel
        </label>
        <button className="btn-primary py-4 font-display text-2xl" onClick={roll} disabled={rolling || spots.length === 0}>
          {rolling ? "Bus fliegt…" : "ABSPRINGEN!"}
        </button>
        {spots.length === 0 && <p className="text-muted">Noch keine Drop-Spots – im Admin-Bereich anlegen.</p>}
        {error && <p className="text-sm text-fail">{error}</p>}
        {result && !rolling && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="text-sm text-muted">Landebereich</div>
              {result.circles.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: PLAYER_COLORS[i] }} />
                  <span className="font-display text-2xl" style={{ color: PLAYER_COLORS[i] }}>
                    {count > 1 ? result.names[i] : "Im Kreis"}
                  </span>
                  <span className="text-sm text-muted">bei {c.spotName}</span>
                </div>
              ))}
            </div>
            {result.rule && (
              <div className="rounded-xl border border-accent-2/50 bg-accent-2/10 p-3">
                <div className="text-sm text-muted">Zusatzregel{count > 1 ? " für alle" : ""}</div>
                <div className="text-lg font-bold">{result.rule.text}</div>
              </div>
            )}
            {isAdmin && (
              <SaveChallenge
                source="drop"
                title={title}
                config={{
                  rule: result.rule?.text ?? null,
                  diameter,
                  circles: result.circles.map((c, i) => ({ player: result.names[i], spot: c.spotName, cx: c.cx, cy: c.cy, r: c.r })),
                }}
              />
            )}
          </motion.div>
        )}
        <OverlayLink kind="drop" login={overlayLogin} size="ca. 460 × 220" className="rounded-xl border border-line p-3" />
      </aside>
    </div>
  )
}
