"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

/**
 * Schmaler gelber Ladebalken oben, solange nach einem Klick auf einen internen Link die neue Seite lädt.
 * Ersetzt die frühere loading.tsx – deren Lade-Bereich um jede Seite führte auf großen Seiten (Admin)
 * gelegentlich zu Hydration-Fehlern.
 */
export function NavProgress() {
  const pathname = usePathname()
  const search = useSearchParams()
  const [loading, setLoading] = useState(false)

  // Neue Seite ist da → Balken weg
  useEffect(() => setLoading(false), [pathname, search])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return
      const url = new URL(a.href, location.href)
      if (url.origin !== location.origin) return
      if (url.pathname === location.pathname && url.search === location.search) return
      setLoading(true)
    }
    // Capture-Phase: Next-Links rufen selbst preventDefault() auf, bevor der Klick hochblubbert
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])

  // Sicherheitsnetz, falls die Navigation abgebrochen wird
  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => setLoading(false), 15000)
    return () => clearTimeout(t)
  }, [loading])

  if (!loading) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1 overflow-hidden" role="progressbar" aria-label="Seite lädt">
      <div className="h-full w-1/3 animate-[navprogress_1.1s_ease-in-out_infinite] bg-accent shadow-[0_0_10px_#ffe03d]" />
    </div>
  )
}
