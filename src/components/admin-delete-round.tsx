"use client"

import clsx from "clsx"
import { useState, useTransition } from "react"
import { deleteRound, type RoundKind } from "@/lib/round-actions"

/** Löschen-Knopf für Admins: entfernt die Runde und ihren Eintrag in den Stats */
export function AdminDeleteRound({
  kind,
  id,
  name,
  back,
  className,
  children = "🗑 Runde löschen",
}: {
  kind: RoundKind
  id: number
  name: string
  back?: string
  className?: string
  children?: React.ReactNode
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <span className={clsx("inline-flex flex-col", className)}>
      <button
        type="button"
        className="self-start text-sm text-muted underline hover:text-fail disabled:opacity-50"
        disabled={pending}
        onClick={() => {
          if (!confirm(`„${name}“ endgültig löschen? Auch der Eintrag in den Stats wird entfernt.`)) return
          setError(null)
          start(async () => {
            try {
              await deleteRound(kind, id, back)
            } catch (e) {
              // redirect() wirft absichtlich – nur echte Fehler anzeigen
              if (e instanceof Error && !e.message.includes("NEXT_REDIRECT")) setError(e.message)
              else throw e
            }
          })
        }}
      >
        {pending ? "Lösche…" : children}
      </button>
      {error && <span className="text-xs text-fail">{error}</span>}
    </span>
  )
}
