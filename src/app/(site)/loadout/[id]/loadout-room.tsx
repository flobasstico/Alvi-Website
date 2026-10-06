"use client"

import clsx from "clsx"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { LoadoutBar, type SlotItem } from "@/components/loadout-bar"
import { GoneNote, UnofficialNote } from "@/components/replay-button"
import { joinResult, PlayersPanel, WinnerPicker } from "@/components/session/players"
import type { Tables } from "@/lib/database.types"
import { LOADOUT_SLOTS, type LootItem } from "@/lib/loadout"
import { createClient } from "@/lib/supabase/client"
import { LoadoutDice } from "../loadout-dice"

type Session = Tables<"loadout_sessions">
type Player = Tables<"loadout_players">
type Item = LootItem & { active: boolean }
type State = { session: Session; players: Player[] }

export function LoadoutRoom({ initial, items, userId, login }: { initial: State; items: Item[]; userId: string | null; login: string | null }) {
  const [supabase] = useState(createClient)
  const [{ session, players }, setState] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [gone, setGone] = useState(false)
  const id = session.id

  const refetch = useCallback(async () => {
    const [s, p] = await Promise.all([
      supabase.from("loadout_sessions").select("*").eq("id", id).maybeSingle(),
      supabase.from("loadout_players").select("*").eq("session_id", id).order("joined_at"),
    ])
    if (s.data) setState({ session: s.data, players: p.data ?? [] })
    else if (!s.error) setGone(true)
  }, [supabase, id])

  // Realtime + Fallback-Polling
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(refetch, 100)
    }
    const channel = supabase
      .channel(`loadout-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "loadout_sessions", filter: `id=eq.${id}` }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "loadout_players", filter: `session_id=eq.${id}` }, schedule)
      .subscribe()
    const poll = setInterval(refetch, 5000)
    return () => {
      clearTimeout(timer)
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [supabase, id, refetch])

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const pool = useMemo(() => items.filter((i) => i.active), [items])
  const me = players.find((p) => p.user_id === userId)
  const isHost = !!userId && userId === session.host_id
  const ended = session.status === "beendet"
  const toItems = (p: Player) =>
    Array.from({ length: session.slots }, (_, n) => {
      const itemId = p.item_ids[n]
      return itemId == null ? null : (byId.get(Number(itemId)) ?? null)
    })
  const rolledCount = players.filter((p) => p.rolled_at).length

  async function call(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true)
    setError(null)
    const { error } = await fn()
    if (error) setError(error.message)
    await refetch()
    setBusy(false)
  }

  async function saveRoll(slots: (LootItem | null)[]) {
    const { error } = await supabase.rpc("loadout_set_items", { p_session: id, p_items: slots.map((i) => i?.id ?? null) })
    if (error) setError(`Loadout nicht gespeichert: ${error.message}`)
    else setError(null)
    await refetch()
  }

  if (gone) return <GoneNote back="/loadout?modus=mehrspieler" />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/loadout?modus=mehrspieler" className="text-sm text-muted hover:text-white">← Runden</Link>
        <h1 className="font-display text-3xl text-accent sm:text-4xl">{session.title ?? `Loadout-Runde #${session.id}`}</h1>
        <span className="chip ml-auto">
          {{ offen: "🎲 Würfeln läuft", laeuft: "▶ Läuft – Loadouts fest", beendet: "Beendet" }[session.status] ?? session.status}
        </span>
      </div>
      {error && <p className="rounded-xl border border-fail bg-fail/10 px-3 py-2 text-sm text-fail">{error}</p>}
      {!session.official && <UnofficialNote game="loadout" />}

      {session.status === "offen" && me && (
        <section className="panel flex flex-col gap-3">
          <h2 className="font-display text-2xl">Dein Loadout</h2>
          <LoadoutDice
            items={pool}
            isAdmin={false}
            fixedOptions={{ rarities: session.rarities, mustHeal: session.must_heal }}
            initialSlots={me.rolled_at ? toItems(me).slice(0, LOADOUT_SLOTS) : undefined}
            initialRolls={me.rolls}
            onRolled={saveRoll}
            overlayLogin={login}
          />
        </section>
      )}

      <HostArea
        session={session}
        isHost={isHost}
        busy={busy}
        choosing={choosing}
        setChoosing={setChoosing}
        rolledCount={rolledCount}
        playerCount={players.length}
        players={players}
        onStart={() => call(() => supabase.rpc("loadout_start", { p_session: id }))}
        onFinish={(winner) => call(() => supabase.rpc("loadout_finish", { p_session: id, p_winner: winner }))}
      />

      <section className="panel flex flex-col gap-4">
        <h2 className="font-display text-2xl">Alle Loadouts</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {players.map((p) => {
            const winner = ended && session.winner_id === p.user_id
            return (
              <div
                key={p.user_id}
                className={clsx("flex flex-col gap-2 rounded-xl border bg-bg/40 p-3", winner ? "border-accent ring-2 ring-accent" : "border-line")}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {p.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatar_url} alt="" className="h-7 w-7 rounded-full" />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-line text-xs">👤</span>
                  )}
                  <span className="text-lg">{p.display_name}</span>
                  {p.user_id === session.host_id && <span className="text-xs text-accent">Host</span>}
                  {winner && <span className="ml-auto font-display text-accent">🏆 Sieger</span>}
                  {!p.rolled_at && !winner && <span className="ml-auto text-xs text-muted">würfelt noch…</span>}
                </div>
                <LoadoutBar items={toItems(p).map(toSlot)} />
                <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${session.slots}, minmax(0, 1fr))` }}>
                  {toItems(p).map((item, n) => (
                    <span key={n} className="text-center text-[11px] font-semibold leading-tight text-muted sm:text-xs" title={item?.name}>
                      {item?.name ?? "–"}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <PlayersPanel
        players={players}
        hostId={session.host_id}
        ended={ended}
        userId={userId}
        isHost={isHost}
        isPlayer={!!me}
        busy={busy}
        canJoin={session.status === "offen"}
        maxPlayers={session.max_players}
        codeKind="loadout"
        roundId={id}
        onJoin={(code) => call(() => joinResult(supabase.rpc("loadout_join", { p_session: id, p_code: code })))}
        onLeave={(user) => call(() => supabase.rpc("loadout_leave", { p_session: id, p_user: user }))}
      />
    </div>
  )
}

const toSlot = (i: LootItem | null): SlotItem | null => (i ? { name: i.name, rarity: i.rarity, type: i.type, iconUrl: i.icon_url } : null)

function HostArea({
  session,
  isHost,
  busy,
  choosing,
  setChoosing,
  rolledCount,
  playerCount,
  players,
  onStart,
  onFinish,
}: {
  session: Session
  isHost: boolean
  busy: boolean
  choosing: boolean
  setChoosing: (v: boolean) => void
  rolledCount: number
  playerCount: number
  players: Player[]
  onStart: () => void
  onFinish: (winner: string | null) => void
}) {
  if (session.status === "beendet") {
    return (
      <div className="panel flex flex-col gap-2 text-center">
        <div className="font-display text-3xl text-accent">{session.winner_name ? `🏆 ${session.winner_name} gewinnt!` : "Runde beendet"}</div>
        <p className="text-sm text-muted">
          {session.winner_name ? "Das Ergebnis ist in den Stats eingetragen." : "Ohne Wertung beendet."}{" "}
          <Link href="/loadout?modus=mehrspieler" className="text-accent-2 underline">Neue Runde</Link>
        </p>
      </div>
    )
  }
  if (!isHost) {
    return (
      <div className="panel text-muted">
        {session.status === "offen" && "Würfelt eure Loadouts – der Host startet die Runde, danach sind die Loadouts fest."}
        {session.status === "laeuft" && "Die Runde läuft. Viel Erfolg mit eurem Loadout!"}
      </div>
    )
  }
  if (choosing) {
    return <WinnerPicker players={players} busy={busy} onFinish={onFinish} onBack={() => setChoosing(false)} />
  }
  return (
    <div className="panel flex flex-col items-center gap-3 text-center">
      {session.status === "offen" && (
        <>
          <p className="text-muted">
            {rolledCount} von {playerCount} Spielern haben gewürfelt. Sobald alle zufrieden sind: Start – danach kann niemand mehr neu würfeln.
          </p>
          <button
            className="btn-primary px-12 py-5 font-display text-3xl"
            onClick={() => (rolledCount === playerCount || confirm("Noch nicht alle haben gewürfelt. Trotzdem starten?")) && onStart()}
            disabled={busy}
          >
            ▶ START
          </button>
        </>
      )}
      <button className="btn-danger px-8 py-3 font-display text-2xl" onClick={() => setChoosing(true)} disabled={busy}>
        ⏹ ENDE
      </button>
    </div>
  )
}
