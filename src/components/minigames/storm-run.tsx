"use client"

import { useEffect, useRef } from "react"
import { isTyping } from "./keys"
import { rollRarity, runScore, runSpeed } from "@/lib/minigames"

const W = 480
const H = 270
const GROUND = 232
const PX = 96 // Spieler-x
const PW = 18
const PH = 30
const JUMP_V = 540
const GRAVITY = 1550

type Block = { x: number; w: number; h: number }
type Loot = { x: number; y: number; color: string; points: number; shield: boolean; taken: boolean }

/** Sturm-Lauf: über Hindernisse springen, Loot sammeln, Schild hält einen Treffer aus. onFinish(Punkte) beim Aus. */
export function StormRun({ onFinish }: { onFinish: (score: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const finish = useRef(onFinish)
  finish.current = onFinish

  useEffect(() => {
    const el = canvas.current!
    const ctx = el.getContext("2d")!
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    el.width = W * dpr
    el.height = H * dpr
    ctx.scale(dpr, dpr)

    let t = 0
    let distance = 0
    let loot = 0
    let py = GROUND - PH
    let vy = 0
    let onGround = true
    let shield = false
    let invulnUntil = 0
    let blocks: Block[] = []
    let items: Loot[] = []
    let nextBlock = 800 // erstes Hindernis erst nach ~3 s
    let nextItem = 250
    let popups: { x: number; y: number; text: string; until: number; color: string }[] = []
    let done = false
    let jumpQueued = false
    const rand = (a: number, b: number) => a + Math.random() * (b - a)

    function jump() {
      if (onGround) {
        vy = -JUMP_V
        onGround = false
      } else if (vy > 0 && GROUND - PH - py < 30) jumpQueued = true // kurz vor der Landung gedrückt → direkt wieder springen
    }

    function update(dt: number) {
      t += dt
      const speed = runSpeed(t)
      const dx = speed * dt
      distance += dx

      // Spieler
      vy += GRAVITY * dt
      py += vy * dt
      if (py >= GROUND - PH) {
        py = GROUND - PH
        vy = 0
        onGround = true
        if (jumpQueued) {
          jumpQueued = false
          jump()
        }
      }

      // Hindernisse und Loot bewegen / erzeugen
      blocks.forEach((b) => (b.x -= dx))
      items.forEach((i) => (i.x -= dx))
      blocks = blocks.filter((b) => b.x + b.w > -10)
      items = items.filter((i) => i.x > -10 && !i.taken)
      nextBlock -= dx
      nextItem -= dx
      if (nextBlock <= 0) {
        const h = rand(22, Math.min(62, 34 + t * 1.2))
        blocks.push({ x: W + 10, w: rand(18, 34), h })
        if (t > 20 && Math.random() < 0.25) blocks.push({ x: W + 10 + rand(70, 90), w: rand(16, 24), h: rand(20, 34) })
        nextBlock = rand(speed * 0.75, speed * 1.5) + 140
      }
      if (nextItem <= 0) {
        const shieldDrop = !shield && Math.random() < 0.07
        const r = rollRarity(Math.random())
        items.push({
          x: W + 10,
          y: GROUND - rand(24, 100),
          color: shieldDrop ? "#38bdf8" : r.color,
          points: shieldDrop ? 0 : r.points,
          shield: shieldDrop,
          taken: false,
        })
        nextItem = rand(120, 320)
      }

      // Einsammeln
      for (const i of items) {
        if (Math.abs(i.x - (PX + PW / 2)) < 16 && Math.abs(i.y - (py + PH / 2)) < 22) {
          i.taken = true
          if (i.shield) {
            shield = true
            popups.push({ x: i.x, y: i.y, text: "🛡️ Schild!", until: t + 0.8, color: "#38bdf8" })
          } else {
            loot += i.points
            popups.push({ x: i.x, y: i.y, text: `+${i.points}`, until: t + 0.6, color: i.color })
          }
        }
      }

      // Treffer
      if (t > invulnUntil) {
        for (const b of blocks) {
          const hit = PX + PW - 3 > b.x && PX + 3 < b.x + b.w && py + PH > GROUND - b.h + 2
          if (!hit) continue
          if (shield) {
            shield = false
            invulnUntil = t + 1
            popups.push({ x: PX, y: py - 10, text: "Schild weg!", until: t + 0.8, color: "#fca5a5" })
          } else if (!done) {
            done = true
            finish.current(runScore(distance, loot))
          }
          break
        }
      }
      popups = popups.filter((p) => p.until > t)
    }

    function draw() {
      const sky = ctx.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, "#312e81")
      sky.addColorStop(1, "#7dd3fc")
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H)
      // Hügel im Hintergrund (Parallax)
      ctx.fillStyle = "#15803d55"
      for (let i = 0; i < 4; i++) {
        const x = ((i * 180 - (distance * 0.2) % 180) + 720) % 720 - 120
        ctx.beginPath()
        ctx.ellipse(x, GROUND, 110, 50, 0, Math.PI, 0)
        ctx.fill()
      }
      ctx.fillStyle = "#16a34a"
      ctx.fillRect(0, GROUND, W, H - GROUND)
      ctx.fillStyle = "#166534"
      for (let x = -((distance * 1) % 40); x < W; x += 40) ctx.fillRect(x, GROUND + 10, 18, 4)

      // Hindernisse (Holzwände)
      blocks.forEach((b) => {
        ctx.fillStyle = "#a16207"
        ctx.fillRect(b.x, GROUND - b.h, b.w, b.h)
        ctx.strokeStyle = "#713f12"
        ctx.lineWidth = 2
        ctx.strokeRect(b.x + 1, GROUND - b.h + 1, b.w - 2, b.h - 2)
        ctx.beginPath()
        ctx.moveTo(b.x + 2, GROUND - b.h + 2)
        ctx.lineTo(b.x + b.w - 2, GROUND - 2)
        ctx.stroke()
      })

      // Loot
      items.forEach((i) => {
        ctx.fillStyle = i.color
        if (i.shield) {
          ctx.beginPath()
          ctx.moveTo(i.x, i.y - 10)
          ctx.lineTo(i.x + 8, i.y - 5)
          ctx.lineTo(i.x + 6, i.y + 6)
          ctx.lineTo(i.x, i.y + 10)
          ctx.lineTo(i.x - 6, i.y + 6)
          ctx.lineTo(i.x - 8, i.y - 5)
          ctx.closePath()
          ctx.fill()
        } else {
          ctx.save()
          ctx.translate(i.x, i.y)
          ctx.rotate(Math.PI / 4)
          ctx.fillRect(-6, -6, 12, 12)
          ctx.restore()
        }
      })

      // Spieler (blinkt nach Schild-Treffer)
      if (!(t < invulnUntil && Math.floor(t * 12) % 2)) {
        if (shield) {
          ctx.strokeStyle = "#38bdf8"
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.ellipse(PX + PW / 2, py + PH / 2, 18, 22, 0, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.fillStyle = "#f97316"
        ctx.fillRect(PX, py + 8, PW, PH - 8)
        ctx.fillStyle = "#fcd34d"
        ctx.beginPath()
        ctx.arc(PX + PW / 2, py + 6, 7, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = "#1f2937"
        const step = onGround ? Math.sin(t * 20) * 4 : 0
        ctx.fillRect(PX + 2, py + PH - 2, 5, 4 + step)
        ctx.fillRect(PX + PW - 7, py + PH - 2, 5, 4 - step)
      }

      // Sturm links
      const storm = ctx.createLinearGradient(0, 0, 60, 0)
      storm.addColorStop(0, "rgba(147,51,234,.95)")
      storm.addColorStop(1, "rgba(147,51,234,0)")
      ctx.fillStyle = storm
      ctx.fillRect(0, 0, 60 + Math.sin(t * 3) * 6, H)

      popups.forEach((p) => {
        ctx.font = "bold 14px sans-serif"
        ctx.textAlign = "center"
        ctx.fillStyle = p.color
        ctx.fillText(p.text, p.x, p.y - 14 - (0.8 - (p.until - t)) * 20)
      })

      // HUD
      ctx.textAlign = "right"
      ctx.fillStyle = "rgba(0,0,0,.45)"
      ctx.fillRect(W - 128, 8, 120, 44)
      ctx.font = "bold 15px sans-serif"
      ctx.fillStyle = "#ffe03d"
      ctx.fillText(`${runScore(distance, loot)} Punkte`, W - 16, 26)
      ctx.font = "12px sans-serif"
      ctx.fillStyle = "#fff"
      ctx.fillText(`Loot ${loot} · ${Math.round(runSpeed(t) / 10)} km/h${shield ? " · 🛡️" : ""}`, W - 16, 44)
    }

    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.04, (now - last) / 1000)
      last = now
      update(dt)
      draw()
      if (!done) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const kd = (e: KeyboardEvent) => {
      if (isTyping(e)) return
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        e.preventDefault()
        jump()
      }
    }
    const pd = () => jump()
    window.addEventListener("keydown", kd)
    el.addEventListener("pointerdown", pd)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("keydown", kd)
      el.removeEventListener("pointerdown", pd)
    }
  }, [])

  return <canvas ref={canvas} role="img" aria-label="Sturm-Lauf Spielfeld" className="block aspect-[16/9] w-full touch-none select-none rounded-xl" />
}
