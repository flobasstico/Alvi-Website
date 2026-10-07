"use client"

import clsx from "clsx"
import { useEffect, useRef, useState } from "react"

/**
 * Teilen-Button: am Handy das System-Teilen-Menü, sonst ein kleines Menü mit
 * Link kopieren (z. B. für Discord), WhatsApp, X und Telegram.
 */
export function ShareButton({ path, text, label = "Teilen", className }: { path: string; text: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const url = () => new URL(path, window.location.origin).toString()

  // Menü schließen bei Klick daneben oder Escape
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", close)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", close)
    }
  }, [open])

  async function share() {
    const mobile = window.matchMedia("(pointer: coarse)").matches
    if (mobile && navigator.share) {
      try {
        await navigator.share({ title: document.title, text, url: url() })
        return
      } catch (e) {
        if ((e as Error).name === "AbortError") return
      }
    }
    setOpen((o) => !o)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt("Link kopieren:", url())
    }
  }

  const enc = encodeURIComponent
  const targets = [
    { name: "WhatsApp", href: () => `https://wa.me/?text=${enc(`${text} ${url()}`)}` },
    { name: "X", href: () => `https://x.com/intent/post?text=${enc(text)}&url=${enc(url())}` },
    { name: "Telegram", href: () => `https://t.me/share/url?url=${enc(url())}&text=${enc(text)}` },
  ]

  return (
    <div ref={box} className={clsx("relative inline-block", className)}>
      <button type="button" className="btn-secondary px-3 py-1.5 text-sm" onClick={share} aria-expanded={open} aria-haspopup="menu">
        📣 {label}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 flex w-56 flex-col gap-1 rounded-xl border border-line bg-panel p-2 text-left shadow-xl">
          <button type="button" role="menuitem" onClick={copy} className="rounded-lg px-3 py-2 text-left text-sm hover:bg-panel-2">
            {copied ? "✅ Link kopiert" : "🔗 Link kopieren"}
            <span className="block text-xs text-muted">z. B. für Discord</span>
          </button>
          {targets.map((t) => (
            <a
              key={t.name}
              role="menuitem"
              href="#"
              onClick={(e) => {
                e.preventDefault()
                window.open(t.href(), "_blank", "noopener,noreferrer")
                setOpen(false)
              }}
              className="rounded-lg px-3 py-2 text-sm hover:bg-panel-2"
            >
              {t.name}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
