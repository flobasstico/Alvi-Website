"use client"

import { useSearchParams } from "next/navigation"
import { useState } from "react"

/** Hinweis nach einem fehlgeschlagenen Twitch-Login (?login=fehler&grund=…), wegklickbar */
export function LoginError() {
  const params = useSearchParams()
  const [closed, setClosed] = useState(false)
  if (closed || params.get("login") !== "fehler") return null
  const reason = params.get("grund") ?? ""

  // Sofort ausblenden und die Hinweis-Parameter aus der Adresse entfernen (ohne Neuladen)
  function close() {
    setClosed(true)
    const url = new URL(window.location.href)
    url.searchParams.delete("login")
    url.searchParams.delete("grund")
    window.history.replaceState(window.history.state, "", url)
  }

  return (
    <div role="alert" className="flex items-start justify-center gap-3 bg-fail px-4 py-2 text-sm text-white">
      <span>
        <b>Login mit Twitch hat nicht geklappt.</b> Bitte nochmal versuchen – klappt es weiterhin nicht, Bescheid geben.
        {reason && <span className="block text-xs opacity-80">Grund: {reason}</span>}
      </span>
      <button type="button" onClick={close} className="shrink-0 font-bold" aria-label="Hinweis schließen">
        ✕
      </button>
    </div>
  )
}
