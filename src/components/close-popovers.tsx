"use client"

import { useEffect } from "react"

/** Schließt offene <details data-popover>-Menüs bei Klick daneben oder mit Escape */
export function ClosePopovers() {
  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      for (const d of document.querySelectorAll<HTMLDetailsElement>("details[data-popover][open]")) {
        if (e instanceof KeyboardEvent ? e.key === "Escape" : !d.contains(e.target as Node)) d.open = false
      }
    }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", close)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", close)
    }
  }, [])
  return null
}
