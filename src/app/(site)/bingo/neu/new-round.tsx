"use client"

import clsx from "clsx"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { CardEditor, CardPreview } from "@/components/bingo/card-editor"
import { StaleNote } from "@/components/replay-button"
import { CardFolderTabs, cardsInFolder, type CardFolder } from "@/components/bingo/card-folders"
import type { Tables } from "@/lib/database.types"
import { createClient } from "@/lib/supabase/client"

type Card = Tables<"bingo_card_templates">

export function NewRound({ cards, pool, preselect, userId }: { cards: Card[]; pool: string[]; preselect: number | null; userId: string }) {
  const router = useRouter()
  const [selected, setSelected] = useState<number | null>(preselect && cards.some((c) => c.id === preselect) ? preselect : null)
  const [creating, setCreating] = useState(cards.length === 0)
  const pre = cards.find((c) => c.id === preselect)
  const [folder, setFolder] = useState<CardFolder>(pre ? (pre.approved ? (pre.folder as CardFolder) : "meine") : "admin")
  const [title, setTitle] = useState("")
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const list = cardsInFolder(cards, folder, userId)
  const card = cards.find((c) => c.id === selected) ?? null

  async function open() {
    if (!selected) return
    setBusy(true)
    setError(null)
    const { data, error } = await createClient().rpc("bingo_round_create", { p_template: selected, p_title: title, p_max_players: maxPlayers })
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    router.push(`/bingo/${data}`)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="panel flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-2xl">1. Karte wählen</h2>
          <div className="ml-auto flex flex-wrap gap-1 text-sm">
            <CardFolderTabs cards={cards} folder={folder} onChange={setFolder} userId={userId} />
            <button className={clsx("rounded-lg px-2.5 py-1", creating ? "bg-accent text-black" : "bg-panel-2 text-muted")} onClick={() => setCreating((c) => !c)}>
              + Neue Karte
            </button>
          </div>
        </div>
        {creating && (
          <div className="rounded-xl border border-accent/40 p-3">
            <CardEditor
              pool={pool}
              onCreated={(id) => {
                setCreating(false)
                setSelected(id)
                setFolder("meine")
                router.refresh()
              }}
            />
          </div>
        )}
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelected(c.id)}
                className={clsx(
                  "flex w-full flex-col gap-2 rounded-xl border-2 bg-bg/40 p-3 text-left transition",
                  selected === c.id ? "border-accent" : "border-line hover:border-accent/60",
                )}
              >
                <span className="truncate font-bold">{c.title}</span>
                <span className="text-xs text-muted">
                  von {c.author_name ?? "?"}
                  {!c.approved && " · 🕓 noch nicht freigegeben"}
                </span>
                <CardPreview tasks={c.tasks} />
              </button>
            </li>
          ))}
          {!list.length && <li className="text-muted">Keine Karten in diesem Ordner – erstelle oben eine.</li>}
        </ul>
      </section>

      <aside className="panel flex h-fit flex-col gap-3">
        <h2 className="font-display text-2xl">2. Lobby öffnen</h2>
        {card ? (
          <>
            <p className="text-sm">
              Karte: <b>{card.title}</b> <span className="text-muted">von {card.author_name}</span>
            </p>
            <CardPreview tasks={card.tasks} />
          </>
        ) : (
          <p className="text-sm text-muted">Links eine Karte auswählen.</p>
        )}
        <div>
          <label className="label" htmlFor="round-title">Titel (optional)</label>
          <input id="round-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="input" placeholder={card?.title ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="round-max">Spieler (max.)</label>
          <input id="round-max" type="number" min={2} max={8} value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))} className="input" />
        </div>
        <button className="btn-primary" onClick={open} disabled={!selected || busy}>
          {busy ? "Öffne…" : "Lobby öffnen"}
        </button>
        <p className="text-xs text-muted">Runden ohne Admin werden nach dem Ende nicht gespeichert.</p>
        <StaleNote game="bingo" />
        {error && <p className="text-sm text-fail">{error}</p>}
      </aside>
    </div>
  )
}
