"use client"

import clsx from "clsx"
import { useRouter } from "next/navigation"
import { useActionState, useEffect, useState, useTransition } from "react"
import type { Views } from "@/lib/database.types"
import { createClient } from "@/lib/supabase/client"
import { adoptSubmissions, rejectSubmission, submitChallenge } from "./actions"

type Submission = Views<"submission_scores"> & { id: number; votes: number }

const MEDALS = ["🥇", "🥈", "🥉"]

export function VotingBoard({
  week,
  submissions,
  myVotes,
  userId,
  isAdmin,
}: {
  week: string
  submissions: Submission[]
  myVotes: number[]
  userId: string | null
  isAdmin: boolean
}) {
  const router = useRouter()
  const [supabase] = useState(createClient)
  const [voted, setVoted] = useState(new Set(myVotes))
  const [state, formAction, submitting] = useActionState(submitChallenge, null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setVoted(new Set(myVotes)), [myVotes])

  // Live-Updates: neue Votes/Einreichungen → Server-Daten neu laden
  useEffect(() => {
    const channel = supabase
      .channel(`voting-${week}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, () => router.refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, router, week])

  async function toggleVote(id: number) {
    if (!userId) return
    setError(null)
    const has = voted.has(id)
    setVoted((v) => {
      const n = new Set(v)
      if (has) n.delete(id)
      else n.add(id)
      return n
    })
    const { error } = has
      ? await supabase.from("votes").delete().eq("submission_id", id).eq("user_id", userId)
      : await supabase.from("votes").insert({ submission_id: id })
    if (error) setError("Vote fehlgeschlagen: " + error.message)
    router.refresh()
  }

  const visible = submissions.filter((s) => s.status !== "abgelehnt")
  const top3 = visible.slice(0, 3)
  const openTop3 = top3.filter((s) => !s.challenge_id)

  return (
    <div className="mb-10 grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="panel">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl">Vorschläge dieser Woche</h2>
          {isAdmin && openTop3.length > 0 && (
            <button
              className="btn-primary"
              disabled={pending}
              onClick={() => startTransition(() => adoptSubmissions(openTop3.map((s) => s.id)))}
            >
              Top 3 übernehmen
            </button>
          )}
        </div>
        {error && <p className="mb-2 text-sm text-fail">{error}</p>}
        <ul className="flex flex-col gap-2">
          {submissions.map((s) => {
            const rank = visible.indexOf(s)
            const isTop = rank >= 0 && rank < 3
            return (
              <li
                key={s.id}
                className={clsx(
                  "flex items-start gap-3 rounded-xl border p-3",
                  isTop ? "border-accent/70 bg-accent/10" : "border-line bg-bg/40",
                  s.status === "abgelehnt" && "opacity-40",
                )}
              >
                <button
                  onClick={() => toggleVote(s.id)}
                  disabled={!userId || s.status === "abgelehnt"}
                  title={userId ? "Voten" : "Zum Voten einloggen"}
                  className={clsx(
                    "flex w-14 shrink-0 flex-col items-center rounded-lg border py-1 font-bold transition",
                    voted.has(s.id) ? "border-accent bg-accent text-black" : "border-line bg-panel-2 hover:border-accent",
                  )}
                >
                  <span>▲</span>
                  <span className="tabular-nums">{s.votes}</span>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="font-bold">
                    {isTop && <span className="mr-1">{MEDALS[rank]}</span>}
                    {s.title}
                    {s.challenge_id && <span className="chip ml-2 border-win text-win">übernommen</span>}
                  </div>
                  {s.description && <p className="text-sm text-muted">{s.description}</p>}
                  <p className="text-xs text-muted">von {s.author_name ?? "Unbekannt"}</p>
                </div>
                {isAdmin && !s.challenge_id && s.status !== "abgelehnt" && (
                  <div className="flex flex-col gap-1">
                    <button
                      className="btn-win px-2 py-1 text-xs"
                      disabled={pending}
                      onClick={() => startTransition(() => adoptSubmissions([s.id]))}
                    >
                      Übernehmen
                    </button>
                    <button
                      className="btn-danger px-2 py-1 text-xs"
                      disabled={pending}
                      onClick={() => startTransition(() => rejectSubmission(s.id))}
                    >
                      Ablehnen
                    </button>
                  </div>
                )}
              </li>
            )
          })}
          {submissions.length === 0 && <li className="text-muted">Noch keine Vorschläge – sei der Erste!</li>}
        </ul>
      </section>

      <aside className="panel h-fit">
        <h2 className="mb-3 font-display text-2xl">Challenge einreichen</h2>
        {userId ? (
          <form action={formAction} className="flex flex-col gap-3">
            <div>
              <label className="label" htmlFor="title">Titel</label>
              <input id="title" name="title" className="input" required minLength={3} maxLength={120} placeholder="z. B. Nur Waffen aus Fischerstellen" />
            </div>
            <div>
              <label className="label" htmlFor="description">Details (optional)</label>
              <textarea id="description" name="description" className="input min-h-24" maxLength={500} />
            </div>
            <button className="btn-primary" disabled={submitting}>
              {submitting ? "Sende…" : "Einreichen"}
            </button>
            {state && <p className={clsx("text-sm", state.ok ? "text-win" : "text-fail")}>{state.message}</p>}
            <p className="text-xs text-muted">Max. 3 Vorschläge pro Woche. Ein Vote pro Vorschlag.</p>
          </form>
        ) : (
          <p className="text-muted">Logge dich mit Twitch ein, um Challenges einzureichen und zu voten.</p>
        )}
      </aside>
    </div>
  )
}
