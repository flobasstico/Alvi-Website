"use client"

import { CopyButton } from "@/components/session/players"
import type { OverlayKind } from "@/lib/live-overlay"

/** Persönlicher OBS-Link: zeigt immer das letzte eigene Ergebnis */
export function OverlayLink({ kind, login, size, className = "panel" }: { kind: OverlayKind; login: string | null; size: string; className?: string }) {
  if (!login) return null
  const url = `${typeof window === "undefined" ? "" : location.origin}/overlay/${kind}/${encodeURIComponent(login.toLowerCase())}`
  return (
    <details className={`${className} text-sm`}>
      <summary className="cursor-pointer font-display text-lg">📺 OBS-Overlay</summary>
      <p className="mt-2 text-xs text-muted">
        Kleine Einblendung deines letzten Ergebnisses – aktualisiert sich bei jedem Wurf live. Als Browserquelle in OBS einfügen ({size}, Hintergrund
        transparent).
      </p>
      <div className="mt-2 flex gap-2">
        <input readOnly value={url} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
        <CopyButton text={url} />
      </div>
    </details>
  )
}
