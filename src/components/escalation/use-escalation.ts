"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { playAlarm } from "@/lib/alarm"
import { dueRuleCount, type EscPlayer, type EscRule, type EscSession } from "@/lib/escalation"
import { createClient } from "@/lib/supabase/client"

export type EscState = { session: EscSession; rules: EscRule[]; players: EscPlayer[] }

/** So lange dreht das Glücksrad – die Grundregel erscheint erst danach (keine Spoiler im Overlay). */
export const BASE_REVEAL_MS = 6000

/**
 * Live-Zustand einer Regel-Eskalation: Realtime + Fallback-Polling, zieht fällige Regeln
 * per escalation_tick nach (idempotent, jeder Bildschirm darf) und spielt bei neuen Regeln den Alarm.
 */
export function useEscalation(initial: EscState, serverNow: number, { sound }: { sound: boolean }) {
  const [supabase] = useState(createClient)
  const [state, setState] = useState(initial)
  const [now, setNow] = useState(serverNow)
  const [newest, setNewest] = useState<number | null>(null)
  const id = initial.session.id
  const known = useRef<number | null>(null)
  const soundRef = useRef(sound)
  soundRef.current = sound

  const refetch = useCallback(async () => {
    const [s, r, p] = await Promise.all([
      supabase.from("escalation_sessions").select("*").eq("id", id).single(),
      supabase.from("escalation_session_rules").select("*").eq("session_id", id).order("position"),
      supabase.from("escalation_players").select("*").eq("session_id", id).order("joined_at"),
    ])
    if (s.data) setState({ session: s.data, rules: r.data ?? [], players: p.data ?? [] })
  }, [supabase, id])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(refetch, 100)
    }
    const channel = supabase
      .channel(`escalation-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "escalation_sessions", filter: `id=eq.${id}` }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "escalation_session_rules", filter: `session_id=eq.${id}` }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "escalation_players", filter: `session_id=eq.${id}` }, schedule)
      .subscribe()
    const poll = setInterval(refetch, 10000)
    return () => {
      clearTimeout(timer)
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [supabase, id, refetch])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  // Fällige Regel nachziehen, sobald der Timer abläuft
  const lastTick = useRef(0)
  const { session, rules, players } = state
  const due = dueRuleCount(session, now)
  useEffect(() => {
    if (session.status !== "laeuft" || session.pool_exhausted) return
    if (rules.length >= due || now - lastTick.current < 1500) return
    lastTick.current = now
    supabase.rpc("escalation_tick", { p_session: id }).then(() => refetch())
  }, [session.status, session.pool_exhausted, rules.length, due, now, supabase, id, refetch])

  // Grundregel erst nach dem Dreh zeigen
  const visibleCount = rules.filter((r) => !(r.position === 1 && now < Date.parse(r.added_at) + BASE_REVEAL_MS)).length
  const visible = useMemo(() => rules.slice(0, visibleCount), [rules, visibleCount])

  // Neue sichtbare Regel → Alarm + Hervorhebung (nicht beim ersten Laden)
  useEffect(() => {
    const count = visible.length
    if (known.current !== null && count > known.current) {
      setNewest(visible[count - 1]?.position ?? null)
      if (soundRef.current) playAlarm()
    }
    known.current = count
  }, [visible])
  useEffect(() => {
    if (newest === null) return
    const t = setTimeout(() => setNewest(null), 6000)
    return () => clearTimeout(t)
  }, [newest])

  return { session, rules: visible, allRules: rules, players, now, newest, refetch, supabase }
}
