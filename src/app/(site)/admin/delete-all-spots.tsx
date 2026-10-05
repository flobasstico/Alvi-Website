"use client"

import { useTransition } from "react"
import { deleteAllSpots } from "./actions"

export function DeleteAllSpots({ seasonId, count }: { seasonId: number; count: number }) {
  const [pending, start] = useTransition()
  return (
    <button
      className="btn-danger px-3 py-2 text-sm"
      disabled={pending}
      onClick={() => confirm(`Alle ${count} Spots dieser Season löschen?`) && start(() => deleteAllSpots(seasonId))}
    >
      {pending ? "Lösche…" : `Alle ${count} Spots löschen`}
    </button>
  )
}
