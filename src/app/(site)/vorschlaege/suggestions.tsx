"use client"

import clsx from "clsx"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

const MAX = 1000

/** Neuen Vorschlag einsenden (left = übrige Einsendungen heute, null = unbegrenzt) */
export function SuggestionForm({ left }: { left: number | null }) {
  const router = useRouter()
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const empty = left === 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await createClient().rpc("suggestion_create", { p_body: body })
    setBusy(false)
    if (error) return setError(error.message)
    setBody("")
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label className="label" htmlFor="sg-body">
        Dein Vorschlag
      </label>
      <textarea
        id="sg-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MAX}
        rows={4}
        className="input resize-y"
        placeholder="z. B. Eine Challenge, bei der …"
        disabled={empty}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={busy || empty || !body.trim()}>
          {busy ? "Sendet…" : "Einsenden"}
        </button>
        <span className="text-xs text-muted">
          {left === null ? "Admin: unbegrenzt" : empty ? "Heute keine Einsendungen mehr – morgen geht es weiter" : `Heute noch ${left} von 5 Einsendungen`}
          {" · "}
          {body.length}/{MAX}
        </span>
      </div>
      {error && <p className="text-sm text-fail">{error}</p>}
    </form>
  )
}

type Suggestion = {
  id: number
  body: string
  created_at: string
  likes: number
  dislikes: number
  myVote: number
  authorName: string
  authorAvatar: string | null
}

/** Ein Vorschlag mit Like/Dislike (erneuter Klick nimmt die Stimme zurück) */
export function SuggestionItem({ s, loggedIn, canDelete }: { s: Suggestion; loggedIn: boolean; canDelete: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true)
    setError(null)
    const { error } = await action()
    setBusy(false)
    if (error) return setError(error.message)
    router.refresh()
  }

  const vote = (value: 1 | -1) => run(() => createClient().rpc("suggestion_vote", { p_id: s.id, p_value: s.myVote === value ? 0 : value }))
  const remove = () => {
    if (confirm("Vorschlag wirklich löschen?")) run(() => createClient().from("suggestions").delete().eq("id", s.id))
  }

  return (
    <li className="panel flex gap-4 p-4">
      <div className="flex flex-col items-center gap-1">
        <VoteButton active={s.myVote === 1} disabled={!loggedIn || busy} onClick={() => vote(1)} label="Gefällt mir" tone="win">
          👍 {s.likes}
        </VoteButton>
        <VoteButton active={s.myVote === -1} disabled={!loggedIn || busy} onClick={() => vote(-1)} label="Gefällt mir nicht" tone="fail">
          👎 {s.dislikes}
        </VoteButton>
      </div>
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-line break-words">{s.body}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          {s.authorAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.authorAvatar} alt="" className="h-5 w-5 rounded-full" />
          ) : (
            <span>👤</span>
          )}
          <span className="font-semibold text-white/80">{s.authorName}</span>
          <span>· {new Date(s.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
          {canDelete && (
            <button type="button" onClick={remove} disabled={busy} className="ml-auto underline hover:text-fail">
              Löschen
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-sm text-fail">{error}</p>}
      </div>
    </li>
  )
}

function VoteButton({
  active,
  disabled,
  onClick,
  label,
  tone,
  children,
}: {
  active: boolean
  disabled: boolean
  onClick: () => void
  label: string
  tone: "win" | "fail"
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Zum Bewerten mit Twitch einloggen" : label}
      aria-pressed={active}
      className={clsx(
        "min-w-16 rounded-lg border px-2 py-1 text-sm font-bold tabular-nums transition",
        active ? (tone === "win" ? "border-win bg-win/20 text-win" : "border-fail bg-fail/20 text-fail") : "border-line bg-panel-2 hover:bg-line",
        "disabled:cursor-not-allowed disabled:hover:bg-panel-2",
      )}
    >
      {children}
    </button>
  )
}
