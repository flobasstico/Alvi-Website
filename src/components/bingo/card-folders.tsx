"use client"

import clsx from "clsx"
import type { Tables } from "@/lib/database.types"

type Card = Tables<"bingo_card_templates">
export type CardFolder = "admin" | "zuschauer" | "meine" | "pruefen"

const LABEL: Record<CardFolder, string> = { admin: "📁 Admin-Karten", zuschauer: "📁 Zuschauer-Karten", meine: "Meine", pruefen: "🕓 Zu prüfen" }

export function cardsInFolder(cards: Card[], folder: CardFolder, userId: string | null) {
  if (folder === "meine") return cards.filter((c) => c.author_id === userId)
  // Zuschauer-Karten erscheinen erst nach Freigabe durch einen Admin
  if (folder === "pruefen") return cards.filter((c) => !c.approved)
  return cards.filter((c) => c.folder === folder && c.approved)
}

/** Ordner-Reiter: Karten von Admins und von Zuschauern getrennt, dazu „Meine“ */
export function CardFolderTabs({
  cards,
  folder,
  onChange,
  userId,
  isAdmin = false,
}: {
  cards: Card[]
  folder: CardFolder
  onChange: (f: CardFolder) => void
  userId: string | null
  isAdmin?: boolean
}) {
  const folders: CardFolder[] = [
    "admin",
    "zuschauer",
    ...(userId ? (["meine"] as const) : []),
    ...(isAdmin && cards.some((c) => !c.approved) ? (["pruefen"] as const) : []),
  ]
  return (
    <div className="flex flex-wrap gap-1 text-sm">
      {folders.map((f) => (
        <button
          key={f}
          type="button"
          className={clsx("rounded-lg px-2.5 py-1", folder === f ? "bg-accent text-black" : "bg-panel-2 text-muted hover:text-white")}
          onClick={() => onChange(f)}
        >
          {LABEL[f]} ({cardsInFolder(cards, f, userId).length})
        </button>
      ))}
    </div>
  )
}
