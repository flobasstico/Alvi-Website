"use client"

import { useEffect, useRef } from "react"
import { isTyping } from "./keys"
import { DROP_JUMPS, DROP_PERFECT, DROP_RADIUS, landingPoints } from "@/lib/minigames"

const W = 360
const H = 540
const GROUND = 492
const BUS_Y = 104 // unter der Anzeige oben
const FALL_SPEED = 105 // px/s nach unten
const ACCEL = 420 // px/s² Lenkung
const MAX_VX = 170

type Cloud = { x: number; y: number; r: number; vx: number }
type Phase = "bus" | "fall" | "landed"

/** Drop-Zone: aus dem Bus springen, mit dem Gleiter auf dem Ziel landen. Ruft onFinish(Gesamtpunkte) nach 3 Sprüngen auf. */
export function DropZone({ onFinish }: { onFinish: (score: number) => void }) {
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

    const input = { left: false, right: false, action: false }
    let jump = 0
    let total = 0
    let phase: Phase = "bus"
    let busX = -40
    let px = 0
    let py = BUS_Y
    let vx = 0
    let wind = 0
    let windPhase = 0
    let target = 0
    let clouds: Cloud[] = []
    let message = ""
    let messageUntil = 0
    let landedAt = 0
    let lastPoints: number | null = null
    let done = false
    let t = 0

    const rand = (a: number, b: number) => a + Math.random() * (b - a)
    function setupJump() {
      phase = "bus"
      busX = -40
      py = BUS_Y
      vx = 0
      wind = rand(-45, 45)
      windPhase = rand(0, Math.PI * 2)
      target = rand(50, W - 50)
      clouds = Array.from({ length: 2 + jump }, () => ({ x: rand(30, W - 30), y: rand(170, GROUND - 90), r: rand(16, 24), vx: rand(-40, 40) }))
      lastPoints = null
    }
    setupJump()

    function doJump() {
      if (phase !== "bus") return
      phase = "fall"
      px = Math.max(20, Math.min(W - 20, busX))
    }

    function land(points: number, text: string) {
      phase = "landed"
      lastPoints = points
      total += points
      message = text
      messageUntil = t + 1.6
      landedAt = t
    }

    function update(dt: number) {
      t += dt
      clouds.forEach((c) => {
        c.x += c.vx * dt
        if (c.x < 20 || c.x > W - 20) c.vx *= -1
      })
      if (phase === "bus") {
        busX += 120 * dt
        if (input.action) doJump()
        if (busX > W - 20) doJump() // spätestens am Rand springen
        return
      }
      if (phase === "fall") {
        const w = wind + Math.sin(t * 1.3 + windPhase) * 25
        const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0)
        vx += steer * ACCEL * dt
        vx *= 1 - 1.6 * dt // Luftwiderstand
        vx = Math.max(-MAX_VX, Math.min(MAX_VX, vx))
        px += (vx + w) * dt
        px = Math.max(8, Math.min(W - 8, px))
        py += FALL_SPEED * dt
        if (clouds.some((c) => Math.hypot(c.x - px, c.y - py) < c.r + 9)) return land(0, "⚡ Sturmwolke – 0 Punkte")
        if (py >= GROUND - 12) {
          py = GROUND - 12
          const d = px - target
          const p = landingPoints(d)
          return land(p, Math.abs(d) <= DROP_PERFECT ? `🎯 PERFEKT! +${p}` : p ? `+${p} Punkte` : "Daneben – 0 Punkte")
        }
        return
      }
      if (phase === "landed" && t - landedAt > 1.7) {
        jump++
        if (jump >= DROP_JUMPS) {
          if (!done) {
            done = true
            finish.current(total)
          }
          return
        }
        setupJump()
      }
    }

    function draw() {
      const sky = ctx.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, "#1e3a8a")
      sky.addColorStop(0.6, "#38bdf8")
      sky.addColorStop(1, "#bae6fd")
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H)

      // Insel
      ctx.fillStyle = "#16a34a"
      ctx.fillRect(0, GROUND, W, H - GROUND)
      ctx.fillStyle = "#15803d"
      ctx.fillRect(0, GROUND, W, 6)
      for (let i = 0; i < 6; i++) {
        const tx = ((i * 71 + 23) % (W - 20)) + 10
        ctx.fillStyle = "#14532d"
        ctx.beginPath()
        ctx.moveTo(tx, GROUND - 22)
        ctx.lineTo(tx - 9, GROUND)
        ctx.lineTo(tx + 9, GROUND)
        ctx.fill()
      }
      // Ziel
      ctx.fillStyle = "rgba(255,214,10,.25)"
      ctx.fillRect(target - DROP_RADIUS, GROUND, DROP_RADIUS * 2, 5)
      for (const [r, c] of [[26, "#fff"], [18, "#ef4444"], [10, "#fff"], [4, "#ef4444"]] as const) {
        ctx.fillStyle = c
        ctx.beginPath()
        ctx.ellipse(target, GROUND + 9, r, r / 3, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      // Sturmwolken
      clouds.forEach((c) => {
        ctx.fillStyle = "rgba(124,58,237,.85)"
        for (const [dx, dy, s] of [[0, 0, 1], [-c.r * 0.7, 4, 0.7], [c.r * 0.7, 4, 0.7]] as const) {
          ctx.beginPath()
          ctx.arc(c.x + dx, c.y + dy, c.r * s, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = "#fde047"
        ctx.font = "bold 14px sans-serif"
        ctx.textAlign = "center"
        ctx.fillText("⚡", c.x, c.y + 5)
      })

      // Battle Bus mit Ballon
      if (phase === "bus") {
        ctx.fillStyle = "#e0f2fe"
        ctx.beginPath()
        ctx.ellipse(busX, BUS_Y - 30, 22, 16, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = "#e0f2fe"
        ctx.beginPath()
        ctx.moveTo(busX, BUS_Y - 14)
        ctx.lineTo(busX, BUS_Y - 6)
        ctx.stroke()
        ctx.fillStyle = "#2563eb"
        ctx.fillRect(busX - 26, BUS_Y - 6, 52, 22)
        ctx.fillStyle = "#93c5fd"
        for (let i = 0; i < 4; i++) ctx.fillRect(busX - 22 + i * 12, BUS_Y - 2, 8, 7)
        ctx.fillStyle = "#111"
        ctx.beginPath()
        ctx.arc(busX - 16, BUS_Y + 17, 4, 0, Math.PI * 2)
        ctx.arc(busX + 16, BUS_Y + 17, 4, 0, Math.PI * 2)
        ctx.fill()
      }

      // Spieler mit Gleiter
      if (phase !== "bus") {
        if (phase === "fall") {
          ctx.fillStyle = "#facc15"
          ctx.beginPath()
          ctx.moveTo(px - 22, py - 20)
          ctx.quadraticCurveTo(px, py - 34, px + 22, py - 20)
          ctx.lineTo(px, py - 14)
          ctx.closePath()
          ctx.fill()
          ctx.strokeStyle = "#78350f"
          ctx.beginPath()
          ctx.moveTo(px - 20, py - 20)
          ctx.lineTo(px, py - 4)
          ctx.lineTo(px + 20, py - 20)
          ctx.stroke()
        }
        ctx.fillStyle = "#f97316"
        ctx.fillRect(px - 5, py - 6, 10, 12)
        ctx.fillStyle = "#fcd34d"
        ctx.beginPath()
        ctx.arc(px, py - 9, 5, 0, Math.PI * 2)
        ctx.fill()
      }

      // HUD
      ctx.textAlign = "left"
      ctx.fillStyle = "rgba(0,0,0,.45)"
      ctx.fillRect(8, 8, 128, 44)
      ctx.fillStyle = "#fff"
      ctx.font = "bold 14px sans-serif"
      ctx.fillText(`Sprung ${Math.min(jump + 1, DROP_JUMPS)}/${DROP_JUMPS}`, 16, 26)
      ctx.fillStyle = "#ffd60a"
      ctx.fillText(`${total} Punkte`, 16, 44)
      // Wind
      const w = wind + Math.sin(t * 1.3 + windPhase) * 25
      ctx.textAlign = "right"
      ctx.fillStyle = "rgba(0,0,0,.45)"
      ctx.fillRect(W - 108, 8, 100, 26)
      ctx.fillStyle = "#fff"
      ctx.fillText(`Wind ${w < -5 ? "←" : w > 5 ? "→" : "·"} ${Math.abs(Math.round(w / 10))}`, W - 16, 26)

      if (phase === "bus") {
        ctx.textAlign = "center"
        ctx.fillStyle = "rgba(0,0,0,.5)"
        ctx.fillRect(W / 2 - 130, H / 2 - 22, 260, 40)
        ctx.fillStyle = "#fff"
        ctx.font = "bold 16px sans-serif"
        ctx.fillText("Tippen / Leertaste = Springen!", W / 2, H / 2 + 4)
      }
      if (message && t < messageUntil) {
        ctx.textAlign = "center"
        ctx.font = "bold 22px sans-serif"
        ctx.lineWidth = 4
        ctx.strokeStyle = "rgba(0,0,0,.7)"
        ctx.strokeText(message, W / 2, H / 2 - 40)
        ctx.fillStyle = lastPoints ? "#ffd60a" : "#fca5a5"
        ctx.fillText(message, W / 2, H / 2 - 40)
      }
    }

    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      update(dt)
      input.action = false
      draw()
      if (!done) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    // Tastatur
    const key = (down: boolean) => (e: KeyboardEvent) => {
      if (isTyping(e)) return
      if (["ArrowLeft", "a", "A"].includes(e.key)) input.left = down
      else if (["ArrowRight", "d", "D"].includes(e.key)) input.right = down
      else if ((e.key === " " || e.key === "ArrowUp" || e.key === "Enter") && down) input.action = true
      else return
      e.preventDefault()
    }
    const kd = key(true)
    const ku = key(false)
    window.addEventListener("keydown", kd)
    window.addEventListener("keyup", ku)
    // Touch/Maus: Tippen = springen, gedrückt halten links/rechts = lenken
    const pointer = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      const left = e.clientX - rect.left < rect.width / 2
      if (e.type === "pointerdown") {
        input.action = true
        input.left = left
        input.right = !left
      } else {
        input.left = false
        input.right = false
      }
    }
    el.addEventListener("pointerdown", pointer)
    window.addEventListener("pointerup", pointer)
    window.addEventListener("pointercancel", pointer)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("keydown", kd)
      window.removeEventListener("keyup", ku)
      el.removeEventListener("pointerdown", pointer)
      window.removeEventListener("pointerup", pointer)
      window.removeEventListener("pointercancel", pointer)
    }
  }, [])

  return <canvas ref={canvas} role="img" aria-label="Drop-Zone Spielfeld" className="block aspect-[2/3] w-full touch-none select-none rounded-xl" style={{ maxWidth: W * 1.25 }} />
}
