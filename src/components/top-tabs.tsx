"use client"

import clsx from "clsx"
import Link from "next/link"
import { usePathname } from "next/navigation"

/** Lobby-Reiter in der Kopfleiste; der aktive ist gelb unterstrichen */
export function TopTabs({ items }: { items: readonly { href: string; label: string }[] }) {
  const pathname = usePathname()
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))
  return (
    <nav className="hidden items-stretch gap-1 lg:flex" aria-label="Hauptbereiche">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={active(i.href) ? "page" : undefined}
          className={clsx(
            "relative px-3 py-2 font-display text-lg tracking-wider transition xl:px-4",
            active(i.href) ? "text-white" : "text-white/60 hover:text-white",
          )}
        >
          {i.label}
          <span
            className={clsx(
              "absolute inset-x-2 -bottom-[13px] h-1 -skew-x-12 bg-accent transition-opacity",
              active(i.href) ? "opacity-100" : "opacity-0",
            )}
          />
        </Link>
      ))}
    </nav>
  )
}
