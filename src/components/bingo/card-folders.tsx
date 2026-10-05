"use client"

import clsx from "clsx"
import type { Tables } from "@/lib/database.types"

type Card = Tables<"bingo_card_templates">
export type CardFolder = "admin" | "zuschauer" | "meine"

const LABEL: Record<CardFolder, string> = { admin: "📁 Admin-Karten", zuschauer: "📁 Zuschauer-Karten", meine: "Meine" }

export function cardsInFolder(cards: Card[], folder: CardFolder, userId: string | null) {
  return folder === "meine" ? cards.filter((c) => c.author_id === userId) : cards.filter((c) => c.folder === folder)
}

/** Ordner-Reiter: Karten von Admins und von Zuschauern getrennt, dazu „Meine“ */
export function CardFolderTabs({
  cards,
  folder,
  onChange,
  userId,
}: {
  cards: Card[]
  folder: CardFolder
  onChange: (f: CardFolder) => void
  userId: string | null
}) {
  const folders: CardFolder[] = userId ? ["admin", "zuschauer", "meine"] : ["admin", "zuschauer"]
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
