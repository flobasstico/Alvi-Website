"use client"

import clsx from "clsx"
import { useTransition } from "react"
import { setChallengeStatus } from "@/app/actions"
import type { Tables } from "@/lib/database.types"

export function Wall({ challenges, isAdmin }: { challenges: Tables<"challenges">[]; isAdmin: boolean }) {
  const [pending, start] = useTransition()
  if (challenges.length === 0) return null

  return (
    <section>
      <h2 className="mb-4 font-display text-3xl">Erledigt / Gescheitert – die Wand</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {challenges.map((c) => {
          const cfg = (c.config ?? {}) as { week?: string; votes?: number; author?: string }
          const done = c.status === "geschafft"
          const failed = c.status === "gescheitert"
          return (
            <div
              key={c.id}
              className={clsx(
                "relative overflow-hidden rounded-2xl border-2 p-4",
                done && "border-win bg-win/10",
                failed && "border-fail bg-fail/10",
                !done && !failed && "border-line bg-panel",
              )}
            >
              {(done || failed) && (
                <div
                  className={clsx(
                    "absolute right-[-30px] top-3 rotate-12 px-10 py-0.5 font-display text-sm",
                    done ? "bg-win text-black" : "bg-fail text-white",
                  )}
                >
                  {done ? "ERLEDIGT" : "GESCHEITERT"}
                </div>
              )}
              <div className="pr-16 font-bold">{c.title}</div>
              <div className="mt-1 text-xs text-muted">
                {cfg.week && `KW ${cfg.week.split("-W")[1]}`}
                {cfg.votes !== undefined && ` · ${cfg.votes} Votes`}
                {cfg.author && ` · von ${cfg.author}`}
              </div>
              {c.video_url && (
                <a href={c.video_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-accent-2 underline">
                  Zum Video
                </a>
              )}
              {isAdmin && !done && !failed && (
                <div className="mt-3 flex gap-2">
                  <button className="btn-win px-2 py-1 text-xs" disabled={pending} onClick={() => start(() => setChallengeStatus(c.id, "geschafft"))}>
                    Geschafft
                  </button>
                  <button className="btn-danger px-2 py-1 text-xs" disabled={pending} onClick={() => start(() => setChallengeStatus(c.id, "gescheitert"))}>
                    Gescheitert
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
