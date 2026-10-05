"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { WinState } from "@/lib/winchallenge"
import { fetchWin } from "@/lib/winchallenge-live"

/**
 * Live-Stand einer Winchallenge (Realtime + Polling) und eine mit dem Server abgeglichene Uhr.
 * follow = true: immer die neueste Winchallenge zeigen (fester OBS-Link).
 */
export function useWin(initial: WinState | null, serverNow: number, { follow = false, pollMs = 4000 } = {}) {
  const [supabase] = useState(createClient)
  const [state, setState] = useState(initial)
  const [now, setNow] = useState(serverNow)
  // Abstand Server- zu Browser-Uhr, damit der Timer auf allen Geräten gleich läuft
  const offset = useRef(0)
  const id = follow ? null : (initial?.challenge.id ?? null)

  useEffect(() => {
    offset.current = serverNow - Date.now()
    const t = setInterval(() => setNow(Date.now() + offset.current), 250)
    return () => clearInterval(t)
  }, [serverNow])

  const refetch = useCallback(async () => {
    const next = await fetchWin(supabase, id).catch(() => undefined)
    if (next !== undefined) setState(next)
  }, [supabase, id])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(refetch, 100)
    }
    const channel = supabase
      .channel(`win-${id ?? "neueste"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "win_challenges" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "win_challenge_games" }, schedule)
      .subscribe()
    const poll = setInterval(refetch, pollMs)
    return () => {
      clearTimeout(timer)
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [supabase, id, refetch, pollMs])

  return { state, setState, now, refetch, supabase }
}
