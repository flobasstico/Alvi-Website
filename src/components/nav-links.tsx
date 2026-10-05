"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import clsx from "clsx"

export function NavLinks({ items }: { items: readonly { href: string; label: string }[] }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  // Angeklickter Menüpunkt, bis die neue Seite da ist → sofortige Rückmeldung beim Klick
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => setPending(null), [pathname])

  const isActive = (href: string) => pathname.startsWith(href)
  const links = items.map((item) => {
    const loading = pending === item.href
    const active = loading || (!pending && isActive(item.href))
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => {
          setOpen(false)
          if (pathname !== item.href) setPending(item.href)
        }}
        aria-current={isActive(item.href) ? "page" : undefined}
        className={clsx(
          "relative rounded-lg px-2.5 py-1.5 text-sm font-semibold transition active:scale-95",
          active ? "bg-accent text-black shadow-[0_0_12px_rgba(255,214,10,.45)]" : "text-muted hover:bg-panel-2 hover:text-white",
          loading && "animate-pulse",
        )}
      >
        {item.label}
      </Link>
    )
  })
  return (
    <>
      <nav className="hidden gap-0.5 xl:flex">{links}</nav>
      <button className="btn-secondary px-3 xl:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menü">
        ☰
      </button>
      {open && (
        <nav className="absolute inset-x-0 top-full flex flex-col gap-1 border-b border-line bg-bg p-3 xl:hidden">
          {links}
        </nav>
      )}
    </>
  )
}
