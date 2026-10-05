"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { CardEditor, CardPreview } from "@/components/bingo/card-editor"
import { CardFolderTabs, cardsInFolder, type CardFolder } from "@/components/bingo/card-folders"
import type { Tables } from "@/lib/database.types"
import { createClient } from "@/lib/supabase/client"

type Card = Tables<"bingo_card_templates">

export function CardGallery({ cards, pool, userId, isAdmin }: { cards: Card[]; pool: string[]; userId: string | null; isAdmin: boolean }) {
  const router = useRouter()
  const [folder, setFolder] = useState<CardFolder>(isAdmin || !userId ? "admin" : "zuschauer")
  const list = cardsInFolder(cards, folder, userId)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <section className="panel flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-2xl">Karten</h2>
          <div className="ml-auto">
            <CardFolderTabs cards={cards} folder={folder} onChange={setFolder} userId={userId} />
          </div>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 rounded-xl border border-line bg-bg/40 p-3">
              <div>
                <div className="truncate font-bold">{c.title}</div>
                <div className="text-xs text-muted">von {c.author_name ?? "?"}</div>
              </div>
              <CardPreview tasks={c.tasks} />
              <div className="flex flex-wrap gap-2">
                <Link href={`/bingo/neu?karte=${c.id}`} className="btn-primary px-3 py-1 text-sm">Runde starten</Link>
                {(c.author_id === userId || isAdmin) && (
                  <button
                    className="btn-secondary px-3 py-1 text-sm"
                    onClick={async () => {
                      if (!confirm(`Karte „${c.title}“ löschen?`)) return
                      await createClient().from("bingo_card_templates").delete().eq("id", c.id)
                      router.refresh()
                    }}
                  >
                    Löschen
                  </button>
                )}
              </div>
            </li>
          ))}
          {!list.length && <li className="text-muted">Noch keine Karten in diesem Ordner.</li>}
        </ul>
      </section>
      <aside className="panel h-fit">
        <h2 className="mb-3 font-display text-2xl">Karte erstellen</h2>
        {userId ? (
          <>
            <p className="mb-3 text-xs text-muted">Wird im Ordner {isAdmin ? "Admin-Karten" : "Zuschauer-Karten"} gespeichert.</p>
            <CardEditor
              pool={pool}
              onCreated={() => {
                setFolder("meine")
                router.refresh()
              }}
            />
          </>
        ) : (
          <p className="text-muted">Mit Twitch einloggen, um eine eigene Karte zu erstellen.</p>
        )}
      </aside>
    </div>
  )
}
