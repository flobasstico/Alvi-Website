"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import clsx from "clsx"

/** Aufklapp-Menü (☰) mit allen Seiten – die Kopfleiste selbst bleibt leer */
export function NavLinks({ items }: { items: readonly { href: string; label: string }[] }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  // Angeklickter Menüpunkt, bis die neue Seite da ist → sofortige Rückmeldung beim Klick
  const [pending, setPending] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPending(null)
    setOpen(false)
  }, [pathname])

  // Schließen bei Klick daneben oder Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const isActive = (href: string) => pathname.startsWith(href)

  return (
    <div ref={ref} className="relative">
      <button
        className={clsx("flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-panel-2", open && "bg-panel-2")}
        onClick={() => setOpen((o) => !o)}
        aria-label="Menü"
        aria-expanded={open}
      >
        <span className="relative block h-4 w-5">
          <span className={clsx("absolute left-0 h-0.5 w-5 rounded bg-white transition-all", open ? "top-[7px] rotate-45" : "top-0")} />
          <span className={clsx("absolute left-0 top-[7px] h-0.5 w-5 rounded bg-white transition-all", open && "opacity-0")} />
          <span className={clsx("absolute left-0 h-0.5 w-5 rounded bg-white transition-all", open ? "top-[7px] -rotate-45" : "top-[14px]")} />
        </span>
      </button>
      {open && (
        <nav className="absolute left-0 top-full mt-2 flex w-60 flex-col gap-0.5 rounded-xl border border-line bg-bg p-2 shadow-2xl">
          {items.map((item) => {
            const loading = pending === item.href
            const active = loading || (!pending && isActive(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (pathname !== item.href) setPending(item.href)
                  else setOpen(false)
                }}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={clsx(
                  "rounded-lg px-3 py-2 text-sm font-semibold transition active:scale-[.98]",
                  active ? "bg-accent text-black" : "text-muted hover:bg-panel-2 hover:text-white",
                  loading && "animate-pulse",
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
