"use client"

import { useEffect } from "react"

/** iOS-Safari zeigt :active (Klick-Effekt) nur, wenn die Seite auf Berührungen hört */
export function TouchActive() {
  useEffect(() => {
    const noop = () => {}
    document.addEventListener("touchstart", noop, { passive: true })
    return () => document.removeEventListener("touchstart", noop)
  }, [])
  return null
}
