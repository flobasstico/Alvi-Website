"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import clsx from "clsx"

export function NavLinks({ items }: { items: readonly { href: string; label: string }[] }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const links = items.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={() => setOpen(false)}
      className={clsx(
        "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
        pathname.startsWith(item.href) ? "bg-accent text-black" : "text-muted hover:bg-panel-2 hover:text-white",
      )}
    >
      {item.label}
    </Link>
  ))
  return (
    <>
      <nav className="hidden flex-wrap gap-1 lg:flex">{links}</nav>
      <button className="btn-secondary px-3 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menü">
        ☰
      </button>
      {open && (
        <nav className="absolute inset-x-0 top-full flex flex-col gap-1 border-b border-line bg-bg p-3 lg:hidden">
          {links}
        </nav>
      )}
    </>
  )
}
