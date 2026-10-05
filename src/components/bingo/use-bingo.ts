"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchBingo, type BingoState } from "@/lib/bingo-live"
import { createClient } from "@/lib/supabase/client"

/** Live-Stand der neuesten Bingo-Runde: Realtime + Fallback-Polling. */
export function useBingo(initial: BingoState, pollMs = 5000) {
  const [supabase] = useState(createClient)
  const [state, setState] = useState(initial)

  const refetch = useCallback(async () => {
    try {
      setState(await fetchBingo(supabase))
    } catch {
      // nächster Versuch beim nächsten Event/Poll
    }
  }, [supabase])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(refetch, 100)
    }
    const channel = supabase
      .channel("bingo-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "bingo_games" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "bingo_marks" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "bingo_cards" }, schedule)
      .subscribe()
    const poll = setInterval(refetch, pollMs)
    return () => {
      clearTimeout(timer)
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [supabase, refetch, pollMs])

  return { state, setState, refetch, supabase }
}
