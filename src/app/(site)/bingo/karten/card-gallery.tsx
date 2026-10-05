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
            <CardFolderTabs cards={cards} folder={folder} onChange={setFolder} userId={userId} isAdmin={isAdmin} />
          </div>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 rounded-xl border border-line bg-bg/40 p-3">
              <div>
                <div className="truncate font-bold">{c.title}</div>
                {!c.approved && <div className="mt-1 text-xs font-bold text-accent">🕓 Wartet auf Freigabe – nur für {c.author_id === userId ? "dich" : "Ersteller"} und Admins sichtbar</div>}
              </div>
              <CardPreview tasks={c.tasks} />
              <div className="flex flex-wrap gap-2">
                <Link href={`/bingo/neu?karte=${c.id}`} className="btn-primary px-3 py-1 text-sm">Runde starten</Link>
                {isAdmin && !c.approved && (
                  <button
                    className="btn px-3 py-1 text-sm bg-win text-black"
                    onClick={async () => {
                      const { error } = await createClient().rpc("admin_approve_card", { p_card: c.id })
                      if (error) alert(error.message)
                      router.refresh()
                    }}
                  >
                    ✅ Freigeben
                  </button>
                )}
                {(c.author_id === userId || isAdmin) && (
                  <button
                    className="btn-secondary px-3 py-1 text-sm"
                    onClick={async () => {
                      if (!confirm(`Karte „${c.title}“ löschen?`)) return
                      const { error } = await createClient().from("bingo_card_templates").delete().eq("id", c.id)
                      if (error) alert(error.message)
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
            <p className="mb-3 text-xs text-muted">
              {isAdmin
                ? "Wird im Ordner Admin-Karten gespeichert und ist sofort für alle sichtbar."
                : "Wird im Ordner Zuschauer-Karten gespeichert. Für alle sichtbar wird sie erst nach Freigabe durch einen Admin – du kannst sie aber sofort selbst spielen. Höchstens 5 neue Karten pro Tag."}
            </p>
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
