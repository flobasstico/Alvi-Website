"use client"

import { useCallback, useEffect, useState } from "react"
import type { OlympicState } from "@/lib/olympiade"
import { fetchOlympic } from "@/lib/olympiade-live"
import { createClient } from "@/lib/supabase/client"

/**
 * Live-Stand einer Olympiade (Realtime + Polling).
 * follow = true: immer die neueste offizielle (fester OBS-Link). gone = Olympiade wurde gelöscht.
 */
export function useOlympic(initial: OlympicState | null, { follow = false, pollMs = 4000 } = {}) {
  const [supabase] = useState(createClient)
  const [state, setState] = useState(initial)
  const [gone, setGone] = useState(false)
  const id = follow ? null : (initial?.olympic.id ?? null)

  const refetch = useCallback(async () => {
    try {
      const next = await fetchOlympic(supabase, id)
      if (next) setState(next)
      else if (id) setGone(true)
      else setState(null)
    } catch {
      // nächster Versuch beim nächsten Event/Poll
    }
  }, [supabase, id])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(refetch, 100)
    }
    const channel = supabase
      .channel(`olympiade-${id ?? "neueste"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "olympics" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "olympic_games" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "olympic_players" }, schedule)
      .subscribe()
    const poll = setInterval(refetch, pollMs)
    return () => {
      clearTimeout(timer)
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [supabase, id, refetch, pollMs])

  return { state, refetch, supabase, gone }
}
