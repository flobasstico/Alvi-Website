"use client"

import { toPng } from "html-to-image"
import { useState, type RefObject } from "react"

async function render(node: HTMLElement) {
  return toPng(node, { pixelRatio: 2, backgroundColor: "#071640", cacheBust: true })
}

export function ExportButtons({ target, filename }: { target: RefObject<HTMLDivElement | null>; filename: string }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function download() {
    if (!target.current) return
    setBusy(true)
    setMessage(null)
    try {
      const url = await render(target.current)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
    } catch {
      setMessage("Bild konnte nicht erstellt werden (evtl. blockiert ein Item-Icon den Export).")
    }
    setBusy(false)
  }

  async function share() {
    if (!target.current) return
    setBusy(true)
    setMessage(null)
    try {
      const blob = await (await fetch(await render(target.current))).blob()
      const file = new File([blob], filename, { type: "image/png" })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Loot-Auktion", url: location.href })
      } else {
        await navigator.clipboard.writeText(location.href)
        setMessage("Teilen wird hier nicht unterstützt – Link wurde kopiert.")
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setMessage("Teilen fehlgeschlagen.")
    }
    setBusy(false)
  }

  return (
    <>
      <button className="btn-primary" onClick={download} disabled={busy}>📸 Als Bild speichern</button>
      <button className="btn-secondary" onClick={share} disabled={busy}>Teilen</button>
      {message && <span className="text-sm text-muted">{message}</span>}
    </>
  )
}
