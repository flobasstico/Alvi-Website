"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { CardEditor, CardPreview } from "@/components/bingo/card-editor"
import type { Tables } from "@/lib/database.types"
import { createClient } from "@/lib/supabase/client"

type Card = Tables<"bingo_card_templates">

export function CardGallery({ cards, pool, userId, isAdmin }: { cards: Card[]; pool: string[]; userId: string | null; isAdmin: boolean }) {
  const router = useRouter()
  const [mine, setMine] = useState(false)
  const list = mine ? cards.filter((c) => c.author_id === userId) : cards

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <section className="panel flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-2xl">Alle Karten ({cards.length})</h2>
          {userId && (
            <label className="ml-auto flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Nur meine
            </label>
          )}
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
          {!list.length && <li className="text-muted">Noch keine Karten.</li>}
        </ul>
      </section>
      <aside className="panel h-fit">
        <h2 className="mb-3 font-display text-2xl">Karte erstellen</h2>
        {userId ? (
          <CardEditor pool={pool} onCreated={() => router.refresh()} />
        ) : (
          <p className="text-muted">Mit Twitch einloggen, um eine eigene Karte zu erstellen.</p>
        )}
      </aside>
    </div>
  )
}
