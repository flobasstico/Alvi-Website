"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchRound, type BingoState } from "@/lib/bingo-live"
import { createClient } from "@/lib/supabase/client"

/**
 * Live-Stand einer Bingo-Runde (Realtime + Polling).
 * follow = true: immer die neueste offizielle Runde (feste OBS-Links). gone = Runde wurde gelöscht.
 */
export function useBingoRound(initial: BingoState | null, { follow = false, pollMs = 4000 } = {}) {
  const [supabase] = useState(createClient)
  const [state, setState] = useState(initial)
  const [gone, setGone] = useState(false)
  const id = follow ? null : (initial?.round.id ?? null)

  const refetch = useCallback(async () => {
    try {
      const next = await fetchRound(supabase, id)
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
      .channel(`bingo-${id ?? "neueste"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bingo_rounds" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "bingo_round_players" }, schedule)
      .subscribe()
    const poll = setInterval(refetch, pollMs)
    return () => {
      clearTimeout(timer)
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [supabase, id, refetch, pollMs])

  return { state, setState, refetch, supabase, gone }
}
