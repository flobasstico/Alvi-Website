"use client"

import clsx from "clsx"
import { AnimatePresence, motion } from "framer-motion"
import {
  formatClock,
  pollOptions,
  ruleColor,
  secondsToNextRule,
  type EscRule,
  type EscSession,
  type PollWithCounts,
} from "@/lib/escalation"

/** Die Regelkachel: Timer oben, darunter nummerierte, farbige Regeln. Wird auf der Seite und im OBS-Overlay genutzt. */
export function RuleBoard({
  session,
  rules,
  now,
  newest,
  poll = null,
  overlay = false,
}: {
  session: EscSession
  rules: EscRule[]
  now: number
  newest: number | null
  poll?: PollWithCounts | null
  overlay?: boolean
}) {
  const left = secondsToNextRule(session, now)
  const urgent = left !== null && left <= 10

  let timerLabel: string
  let timerValue: string
  if (session.status === "bereit") {
    timerLabel = rules.length ? "Wartet auf Start" : "Grundregel wird gedreht…"
    timerValue = formatClock(session.interval_s)
  } else if (session.status === "beendet") {
    timerLabel = session.winner_name ? `🏆 ${session.winner_name} gewinnt!` : "Beendet"
    timerValue = "--:--"
  } else if (left === null) {
    timerLabel = "Alle Regeln gezogen"
    timerValue = "∞"
  } else {
    timerLabel = session.mode === "chat" ? "Chat-Abstimmung endet in" : "Nächste Regel in"
    timerValue = formatClock(left)
  }

  return (
    <div
      className={clsx(
        "flex flex-col overflow-hidden rounded-3xl border-2 border-white/15 text-white shadow-2xl",
        overlay ? "bg-[#071640]/85" : "bg-[#071640]",
      )}
    >
      <div
        className={clsx(
          "flex items-center justify-between gap-4 px-5 py-3",
          urgent ? "animate-pulse bg-fail" : "bg-gradient-to-r from-[#7c3aed] to-[#2563eb]",
        )}
      >
        <div className="min-w-0">
          <div className="font-display text-xl leading-none tracking-wide drop-shadow sm:text-2xl">REGEL-ESKALATION</div>
          <div className="mt-1 text-sm font-bold uppercase tracking-wider text-white/85">{timerLabel}</div>
        </div>
        <div className="font-display text-4xl tabular-nums drop-shadow-[0_3px_0_rgba(0,0,0,.4)] sm:text-5xl">{timerValue}</div>
      </div>

      {session.mode === "chat" && session.status === "laeuft" && poll && <PollBox poll={poll} />}

      <ol className="flex flex-col gap-2 p-3">
        <AnimatePresence initial={false}>
          {rules.map((r) => {
            const color = ruleColor(r.position)
            const isNew = newest === r.position
            return (
              <motion.li
                key={r.position}
                layout
                initial={{ opacity: 0, x: -60, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className={clsx("flex items-stretch overflow-hidden rounded-2xl border-2", isNew && "ring-4 ring-white")}
                style={{ borderColor: color, background: `${color}26` }}
              >
                <span
                  className="flex w-12 shrink-0 items-center justify-center font-display text-2xl text-white sm:w-14 sm:text-3xl"
                  style={{ background: color, textShadow: "0 2px 0 rgba(0,0,0,.35)" }}
                >
                  {r.position}
                </span>
                <span
                  className="flex-1 px-3 py-2 text-lg font-extrabold leading-snug sm:text-xl"
                  style={{ textShadow: "0 2px 3px rgba(0,0,0,.9)" }}
                >
                  {r.text}
                  {r.position === 1 && <span className="ml-2 align-middle text-xs font-bold uppercase text-white/70">Grundregel</span>}
                  {isNew && r.position > 1 && <span className="ml-2 align-middle text-xs font-black uppercase text-white">Neu!</span>}
                </span>
              </motion.li>
            )
          })}
        </AnimatePresence>
        {rules.length === 0 && <li className="px-2 py-3 text-center text-white/70">Noch keine Regel – gleich wird gedreht.</li>}
      </ol>
    </div>
  )
}

const POLL_COLORS = ["#a855f7", "#22d3ee", "#facc15"]

function PollBox({ poll }: { poll: PollWithCounts }) {
  const options = pollOptions(poll)
  const total = poll.counts.reduce((a, b) => a + b, 0)
  const max = Math.max(...poll.counts, 0)
  return (
    <div className="border-b-2 border-white/10 bg-white/5 px-3 py-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-black uppercase tracking-wider">💬 Chat stimmt ab: Regel {poll.position}</span>
        <span className="text-xs font-bold text-white/70">{total} {total === 1 ? "Stimme" : "Stimmen"}</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {options.map((o, i) => {
          const votes = poll.counts[i] ?? 0
          const pct = total ? Math.round((votes / total) * 100) : 0
          const leading = total > 0 && votes === max
          return (
            <li key={i} className="relative overflow-hidden rounded-xl border border-white/15 bg-black/30">
              <motion.div
                className="absolute inset-y-0 left-0"
                style={{ background: `${POLL_COLORS[i]}55` }}
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
              <div className="relative flex items-center gap-2 px-2 py-1.5">
                <span
                  className="rounded-md px-1.5 font-display text-lg leading-tight text-black"
                  style={{ background: POLL_COLORS[i] }}
                >
                  !{i + 1}
                </span>
                <span className={clsx("flex-1 font-extrabold leading-snug", leading && "text-white")} style={{ textShadow: "0 2px 3px rgba(0,0,0,.9)" }}>
                  {o.text}
                </span>
                <span className="font-display text-lg tabular-nums">{votes}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
