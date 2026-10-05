"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchOverlay, type OverlayKind } from "@/lib/live-overlay"
import { createClient } from "@/lib/supabase/client"

/** Letztes Ergebnis einer Person live (Realtime + Polling) */
export function useLiveOverlay<T>(userId: string, kind: OverlayKind, initial: T | null) {
  const [supabase] = useState(createClient)
  const [data, setData] = useState<T | null>(initial)
  const [stamp, setStamp] = useState(0)

  const refetch = useCallback(async () => {
    try {
      const row = await fetchOverlay(supabase, userId, kind)
      if (row) {
        setData((cur) => (JSON.stringify(cur) === JSON.stringify(row.data) ? cur : (row.data as T)))
        setStamp(new Date(row.updated_at).getTime())
      }
    } catch {
      // nächster Versuch beim nächsten Event/Poll
    }
  }, [supabase, userId, kind])

  useEffect(() => {
    const channel = supabase
      .channel(`overlay-${kind}-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_overlays", filter: `user_id=eq.${userId}` }, () => refetch())
      .subscribe()
    const poll = setInterval(refetch, 3000)
    return () => {
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [supabase, userId, kind, refetch])

  return { data, stamp }
}
