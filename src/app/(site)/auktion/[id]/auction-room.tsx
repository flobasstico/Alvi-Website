"use client"

import clsx from "clsx"
import { AnimatePresence, motion } from "framer-motion"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ItemIcon } from "@/components/item-icon"
import { LoadoutBar, type SlotItem } from "@/components/loadout-bar"
import {
  canBid,
  loadoutFor,
  needsItems,
  phaseOf,
  quickBids,
  secondsLeft,
  validateBid,
  type Auction,
  type Bid,
  type Player,
  type Round,
} from "@/lib/auction"
import { celebrate } from "@/lib/confetti"
import { ITEM_TYPE_LABEL, RARITY_CLASS, RARITY_LABEL, type Rarity } from "@/lib/constants"
import { createClient } from "@/lib/supabase/client"
import { saveAuctionChallenge } from "../actions"
import { ExportButtons } from "./export-buttons"

type State = { auction: Auction; players: Player[]; rounds: Round[]; bids: Bid[] }

const SEAT_COLORS = ["text-accent", "text-accent-2", "text-fuchsia-400", "text-emerald-400"]

const toSlot = (r: Round | null): SlotItem | null =>
  r && {
    name: r.item_name,
    rarity: r.item_rarity,
    type: r.item_type,
    iconUrl: r.item_icon_url,
    price: r.price,
    lottery: r.status === "zugelost",
  }

export function AuctionRoom({
  initial,
  serverNow,
  userId,
  isAdmin,
}: {
  initial: State
  serverNow: number
  userId: string | null
  isAdmin: boolean
}) {
  const [supabase] = useState(createClient)
  const [state, setState] = useState(initial)
  // Erster Render mit der Server-Zeit, damit Countdown/Phase beim Hydrieren identisch sind
  const [now, setNow] = useState(serverNow)
  const [error, setError] = useState<string | null>(null)
  const auctionId = initial.auction.id

  const refetch = useCallback(async () => {
    const [a, p, r, b] = await Promise.all([
      supabase.from("auctions").select("*").eq("id", auctionId).single(),
      supabase.from("auction_players").select("*").eq("auction_id", auctionId).order("seat"),
      supabase.from("auction_rounds").select("*").eq("auction_id", auctionId).order("round_no"),
      supabase.from("auction_bids").select("*").eq("auction_id", auctionId),
    ])
    if (a.data) setState({ auction: a.data, players: p.data ?? [], rounds: r.data ?? [], bids: b.data ?? [] })
  }, [supabase, auctionId])

  // Live-Sync: jede Änderung an der Auktion → kompletten (kleinen) Zustand neu laden
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(refetch, 120)
    }
    const filter = `auction_id=eq.${auctionId}`
    const channel = supabase
      .channel(`auction-${auctionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "auctions", filter: `id=eq.${auctionId}` }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_players", filter }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_rounds", filter }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_bids", filter }, schedule)
      .subscribe()
    // Fallback, falls ein Realtime-Event verloren geht
    const poll = setInterval(refetch, 15000)
    return () => {
      clearTimeout(timer)
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [supabase, auctionId, refetch])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  const { auction, players, rounds, bids } = state
  const phase = phaseOf(auction, rounds, now)
  const me = players.find((p) => p.user_id === userId) ?? null
  const isHost = auction.host_id === userId
  const seatName = (seat: number) => players.find((p) => p.seat === seat)?.display_name ?? `Sitz ${seat}`

  // Abgelaufene Bietzeit auswerten lassen (Server prüft die Zeit selbst, mehrfaches Aufrufen ist harmlos)
  const lastExpireCall = useRef(0)
  useEffect(() => {
    if (phase.kind !== "bidding" || !userId || !phase.round.deadline) return
    if (now < Date.parse(phase.round.deadline) || now - lastExpireCall.current < 2000) return
    lastExpireCall.current = now
    supabase.rpc("auction_resolve_expired", { p_round: phase.round.id }).then(() => refetch())
  }, [phase, now, userId, supabase, refetch])

  // Konfetti, wenn ich ein Item gewinne
  const celebrated = useRef<number | null>(null)
  useEffect(() => {
    if (phase.kind === "reveal" && me && phase.last.winner_seat === me.seat && celebrated.current !== phase.last.id) {
      celebrated.current = phase.last.id
      celebrate()
    }
  }, [phase, me])

  async function rpc<T>(call: PromiseLike<{ error: { message: string } | null; data?: T }>) {
    setError(null)
    const { error } = await call
    if (error) setError(error.message)
    await refetch()
    return !error
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/auktion" className="text-sm text-muted hover:text-white">← Auktionen</Link>
        <h1 className="font-display text-3xl text-accent sm:text-4xl">{auction.title ?? `Loot-Auktion #${auction.id}`}</h1>
        <span className="chip">{{ lobby: "Lobby", laeuft: "Läuft", beendet: "Beendet" }[auction.status]}</span>
        <span className="text-sm text-muted">
          {auction.start_gold} Gold · {auction.items_per_player} Items · {auction.bid_seconds ? `${auction.bid_seconds}s Bietzeit` : "ohne Zeitlimit"}
          {auction.no_duplicates && " · keine Duplikate"}
        </span>
      </div>
      {error && <p className="rounded-xl border border-fail bg-fail/10 px-3 py-2 text-sm text-fail">{error}</p>}

      {phase.kind === "lobby" && (
        <Lobby
          auction={auction}
          players={players}
          me={me}
          isHost={isHost}
          loggedIn={!!userId}
          onJoin={() => rpc(supabase.rpc("auction_join", { p_auction: auction.id }))}
          onLeave={(seat) => rpc(supabase.rpc("auction_leave", { p_auction: auction.id, p_seat: seat ?? null }))}
          onStart={() => rpc(supabase.rpc("auction_start", { p_auction: auction.id }))}
        />
      )}

      {phase.kind === "bidding" && (
        <BiddingStage
          key={phase.round.id}
          auction={auction}
          round={phase.round}
          players={players}
          me={me}
          myBid={me ? bids.find((b) => b.round_id === phase.round.id && b.seat === me.seat) ?? null : null}
          now={now}
          onBid={(amount) => rpc(supabase.rpc("auction_bid", { p_round: phase.round.id, p_amount: amount }))}
        />
      )}

      {phase.kind === "reveal" && (
        <Reveal
          round={phase.last}
          bids={bids.filter((b) => b.round_id === phase.last.id)}
          seatName={seatName}
          nextIn={phase.next ? secondsLeft(phase.next.opens_at, now) : null}
        />
      )}

      {phase.kind === "ended" && (
        <Finale auction={auction} players={players} rounds={rounds} isAdmin={isAdmin} />
      )}

      {phase.kind !== "ended" && phase.kind !== "lobby" && (
        <PlayerGrid
          auction={auction}
          players={players}
          rounds={rounds}
          me={me}
          currentRound={phase.kind === "bidding" ? phase.round : null}
        />
      )}

      {rounds.some((r) => r.status !== "bietet") && <History rounds={rounds} bids={bids} seatName={seatName} />}
    </div>
  )
}

// ---------------------------------------------------------------- Lobby

function Lobby({
  auction,
  players,
  me,
  isHost,
  loggedIn,
  onJoin,
  onLeave,
  onStart,
}: {
  auction: Auction
  players: Player[]
  me: Player | null
  isHost: boolean
  loggedIn: boolean
  onJoin: () => void
  onLeave: (seat?: number) => void
  onStart: () => void
}) {
  const [copied, setCopied] = useState(false)
  const seats = Array.from({ length: auction.max_players }, (_, i) => players.find((p) => p.seat === i + 1) ?? null)
  const free = seats.some((s) => !s)

  return (
    <section className="flex flex-col gap-4">
      <div className="panel flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <div className="font-display text-2xl">Lobby</div>
          <p className="text-sm text-muted">Link an die anderen Creator schicken – sie loggen sich mit Twitch ein und nehmen Platz.</p>
        </div>
        <button
          className="btn-secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(location.href)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
        >
          {copied ? "Link kopiert ✓" : "Einladungslink kopieren"}
        </button>
        {!me && loggedIn && free && <button className="btn-primary" onClick={onJoin}>Platz nehmen</button>}
        {!loggedIn && <span className="text-sm text-muted">Zum Mitspielen mit Twitch einloggen.</span>}
        {me && <button className="btn-secondary" onClick={() => onLeave()}>Platz verlassen</button>}
        {isHost && (
          <button className="btn-primary" onClick={onStart} disabled={players.length < 2}>
            Auktion starten ({players.length}/{auction.max_players})
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {seats.map((p, i) => (
          <div key={i} className={clsx("panel flex flex-col gap-3", !p && "border-dashed opacity-60")}>
            {p ? (
              <>
                <PlayerHeader player={p} isMe={p.user_id === me?.user_id} />
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-accent">🪙 {p.gold} Gold</span>
                  <span className="text-muted">0/{auction.items_per_player} Items</span>
                </div>
                <LoadoutBar items={Array(auction.items_per_player).fill(null)} />
                {isHost && p.user_id !== me?.user_id && (
                  <button className="btn-secondary self-start px-2 py-1 text-xs" onClick={() => onLeave(p.seat)}>Entfernen</button>
                )}
              </>
            ) : (
              <div className="flex h-full min-h-32 flex-col items-center justify-center text-muted">
                <div className="text-3xl">🪑</div>
                Freier Platz {i + 1}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function PlayerHeader({ player, isMe, status }: { player: Player; isMe: boolean; status?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {player.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={player.avatar_url} alt="" className="h-9 w-9 rounded-full border border-line" />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-panel-2 font-bold">{player.seat}</div>
      )}
      <div className="min-w-0 flex-1">
        <div className={clsx("truncate font-bold", SEAT_COLORS[player.seat - 1])}>{player.display_name}</div>
        {isMe && <div className="text-xs text-muted">Du</div>}
      </div>
      {status}
    </div>
  )
}

// ---------------------------------------------------------------- Bieten

function ItemShowcase({ round, children }: { round: Round; children?: React.ReactNode }) {
  const rarity = round.item_rarity as Rarity
  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0, rotateX: 25 }}
      animate={{ scale: 1, opacity: 1, rotateX: 0 }}
      transition={{ type: "spring", stiffness: 180, damping: 18 }}
      className={clsx("relative flex flex-col items-center gap-3 overflow-hidden rounded-3xl border-4 bg-gradient-to-b p-6 text-center shadow-2xl", RARITY_CLASS[rarity])}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,.35),transparent_60%)]" />
      <div className="relative text-xs font-black uppercase tracking-[0.3em] opacity-90">Item #{round.round_no}</div>
      <ItemIcon url={round.item_icon_url} type={round.item_type} name={round.item_name} className="relative h-36 w-36 text-8xl sm:h-44 sm:w-44" />
      <div className="relative font-display text-4xl drop-shadow-[0_3px_0_rgba(0,0,0,.5)] sm:text-5xl">{round.item_name}</div>
      <div className="relative text-sm font-bold uppercase tracking-wider">
        {RARITY_LABEL[rarity] ?? round.item_rarity} · {ITEM_TYPE_LABEL[round.item_type as keyof typeof ITEM_TYPE_LABEL] ?? round.item_type}
      </div>
      {children}
    </motion.div>
  )
}

function BiddingStage({
  auction,
  round,
  players,
  me,
  myBid,
  now,
  onBid,
}: {
  auction: Auction
  round: Round
  players: Player[]
  me: Player | null
  myBid: Bid | null
  now: number
  onBid: (amount: number | null) => Promise<boolean>
}) {
  const [amount, setAmount] = useState<number>(auction.bid_step)
  const [sending, setSending] = useState(false)
  const left = secondsLeft(round.deadline, now)
  const active = players.filter((p) => canBid(p, auction))
  const acted = active.filter((p) => p.acted_round >= round.round_no).length
  const myTurn = !!me && canBid(me, auction) && !myBid
  const invalid = me ? validateBid(amount, me.gold, auction.bid_step) : null

  async function submit(value: number | null) {
    setSending(true)
    await onBid(value)
    setSending(false)
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <ItemShowcase round={round}>
        <div className="relative mt-2 flex items-center gap-4 rounded-full bg-black/40 px-5 py-2 text-sm font-bold">
          <span>{acted}/{active.length} haben gehandelt</span>
          {left !== null && (
            <span className={clsx("font-display text-2xl tabular-nums", left <= 5 && "animate-pulse text-fail")}>⏱ {left}s</span>
          )}
        </div>
      </ItemShowcase>

      <div className="panel flex flex-col gap-4">
        {!me && <p className="text-muted">Du schaust zu. Gebote werden aufgedeckt, sobald alle gehandelt haben.</p>}
        {me && !needsItems(me, auction) && (
          <p className="text-lg font-bold text-win">Dein Loadout ist komplett ✓ – du schaust jetzt zu.</p>
        )}
        {me && needsItems(me, auction) && !canBid(me, auction) && (
          <div className="text-center">
            <div className="text-5xl">🎲</div>
            <p className="mt-2 text-lg font-bold">Kein Gold mehr</p>
            <p className="text-sm text-muted">
              Deine {auction.items_per_player - me.item_count} offenen Slots werden am Ende der Auktion zufällig zugelost.
            </p>
          </div>
        )}
        {me && myBid && (
          <div className="text-center">
            <div className="text-sm text-muted">Deine Aktion</div>
            <div className="font-display text-4xl text-accent">{myBid.amount === null ? "SKIP" : `${myBid.amount} Gold`}</div>
            <p className="mt-2 text-sm text-muted">Warte auf die anderen…</p>
          </div>
        )}
        {myTurn && (
          <>
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-2xl">Dein Gebot</h2>
              <span className="font-bold text-accent">🪙 {me.gold} verfügbar</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-secondary w-12 text-xl" onClick={() => setAmount((a) => Math.max(auction.bid_step, (a || 0) - auction.bid_step))}>−</button>
              <input
                type="number"
                min={auction.bid_step}
                max={me.gold}
                step={auction.bid_step}
                value={Number.isNaN(amount) ? "" : amount}
                onChange={(e) => setAmount(e.target.valueAsNumber)}
                className="input text-center font-display text-3xl"
                aria-label="Gebot in Gold"
              />
              <button className="btn-secondary w-12 text-xl" onClick={() => setAmount((a) => Math.min(me.gold, (a || 0) + auction.bid_step))}>+</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {quickBids(me.gold, auction.bid_step).map((v) => (
                <button key={v} className="btn-secondary px-3 py-1 text-sm" onClick={() => setAmount(v)}>
                  {v === me.gold ? `Alles (${v})` : v}
                </button>
              ))}
            </div>
            {invalid && <p className="text-sm text-fail">{invalid}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-primary py-3 font-display text-xl" disabled={!!invalid || sending} onClick={() => submit(amount)}>
                BIETEN
              </button>
              <button className="btn-secondary py-3 font-display text-xl" disabled={sending} onClick={() => submit(null)}>
                SKIP
              </button>
            </div>
            <p className="text-xs text-muted">
              Mindestgebot {auction.bid_step} Gold, in {auction.bid_step}er-Schritten. Bei Gleichstand entscheidet das Los. Wer kein Gold mehr hat,
              bekommt seine offenen Slots am Ende zugelost.
            </p>
          </>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- Auflösung

function Reveal({ round, bids, seatName, nextIn }: { round: Round; bids: Bid[]; seatName: (s: number) => string; nextIn: number | null }) {
  const sorted = [...bids].sort((a, b) => (b.amount ?? -1) - (a.amount ?? -1))
  const discarded = round.status === "verworfen"
  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <ItemShowcase round={round}>
        <AnimatePresence>
          <motion.div
            initial={{ scale: 2.5, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: -4 }}
            transition={{ delay: 0.3, type: "spring" }}
            className={clsx(
              "relative mt-2 rounded-xl border-4 px-6 py-2 font-display text-3xl shadow-xl",
              discarded ? "border-white/60 bg-black/60 text-white" : "border-black bg-accent text-black",
            )}
          >
            {discarded ? "VERWORFEN – alle haben geskippt" : `${seatName(round.winner_seat!)} • ${round.price} Gold`}
          </motion.div>
        </AnimatePresence>
      </ItemShowcase>
      <div className="panel flex flex-col gap-3">
        <h2 className="font-display text-2xl">Aufgedeckt</h2>
        <ul className="flex flex-col gap-2">
          {sorted.map((b, i) => (
            <motion.li
              key={b.seat}
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.15 * i }}
              className={clsx(
                "flex justify-between rounded-lg border px-3 py-2 font-bold",
                b.seat === round.winner_seat ? "border-accent bg-accent/15" : "border-line bg-bg/40",
              )}
            >
              <span className={SEAT_COLORS[b.seat - 1]}>{seatName(b.seat)}</span>
              <span className="tabular-nums">{b.amount === null ? "Skip" : `${b.amount} Gold`}</span>
            </motion.li>
          ))}
        </ul>
        {round.tie && <p className="text-sm text-accent-2">Gleichstand – das Los hat entschieden! 🎲</p>}
        {nextIn !== null && <p className="text-sm text-muted">Nächstes Item in {nextIn}s…</p>}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- Spieler-Übersicht

function PlayerGrid({
  auction,
  players,
  rounds,
  me,
  currentRound,
}: {
  auction: Auction
  players: Player[]
  rounds: Round[]
  me: Player | null
  currentRound: Round | null
}) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {players.map((p) => {
        const done = !needsItems(p, auction)
        const broke = !done && !canBid(p, auction)
        const acted = currentRound && p.acted_round >= currentRound.round_no
        const status = done ? (
          <span className="chip border-win text-win">Fertig</span>
        ) : broke ? (
          <span className="chip border-accent-2 text-accent-2" title="Offene Slots werden am Ende zugelost">🎲 Pleite</span>
        ) : currentRound ? (
          acted ? <span className="chip border-win text-win">✓ gehandelt</span> : <span className="chip animate-pulse">überlegt…</span>
        ) : null
        return (
          <div key={p.seat} className={clsx("panel flex flex-col gap-3", p.user_id === me?.user_id && "border-accent/60")}>
            <PlayerHeader player={p} isMe={p.user_id === me?.user_id} status={status} />
            <div className="flex justify-between text-sm">
              <span className="font-bold text-accent">🪙 {p.gold} Gold</span>
              <span className="text-muted">{p.item_count}/{auction.items_per_player} Items</span>
            </div>
            <LoadoutBar items={loadoutFor(p.seat, rounds, auction.items_per_player).map(toSlot)} />
          </div>
        )
      })}
    </section>
  )
}

function History({ rounds, bids, seatName }: { rounds: Round[]; bids: Bid[]; seatName: (s: number) => string }) {
  const done = rounds.filter((r) => r.status !== "bietet").sort((a, b) => b.round_no - a.round_no)
  const auctioned = done.filter((r) => r.status !== "zugelost").length
  return (
    <details className="panel">
      <summary className="cursor-pointer font-display text-xl">
        Verlauf ({auctioned} Items{done.length > auctioned && ` + ${done.length - auctioned} zugelost`})
      </summary>
      <ul className="mt-3 divide-y divide-line text-sm">
        {done.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="w-8 text-muted">#{r.round_no}</span>
            <span className="font-semibold">{r.item_name}</span>
            <span className="chip">{RARITY_LABEL[r.item_rarity as Rarity] ?? r.item_rarity}</span>
            <span className="ml-auto">
              {r.status === "verworfen" ? (
                <span className="text-muted">verworfen</span>
              ) : r.status === "zugelost" ? (
                <>
                  🎲 <b className={SEAT_COLORS[r.winner_seat! - 1]}>{seatName(r.winner_seat!)}</b> zugelost
                </>
              ) : (
                <>
                  <b className={SEAT_COLORS[r.winner_seat! - 1]}>{seatName(r.winner_seat!)}</b> für {r.price} Gold{r.tie && " (Los)"}
                </>
              )}
            </span>
            <span className="w-full text-xs text-muted">
              {bids
                .filter((b) => b.round_id === r.id)
                .sort((a, b) => a.seat - b.seat)
                .map((b) => `${seatName(b.seat)}: ${b.amount ?? "Skip"}`)
                .join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}

// ---------------------------------------------------------------- Abschluss

function Finale({ auction, players, rounds, isAdmin }: { auction: Auction; players: Player[]; rounds: Round[]; isAdmin: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [challengeId, setChallengeId] = useState(auction.challenge_id)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const lotteryCount = rounds.filter((r) => r.status === "zugelost").length
  const ranking = useMemo(
    () => [...players].sort((a, b) => b.gold - a.gold).map((p) => p.seat),
    [players],
  )

  useEffect(() => celebrate(), [])

  return (
    <section className="flex flex-col gap-4">
      <div ref={ref} className="rounded-3xl border border-line bg-bg p-6">
        <div className="mb-5 text-center">
          <div className="font-display text-4xl text-accent sm:text-5xl">{auction.title ?? "Loot-Auktion"}</div>
          <div className="text-sm text-muted">
            Die fertigen Loadouts
            {lotteryCount > 0 && ` · 🎲 ${lotteryCount} Items zugelost`}
            {auction.ended_reason === "pool_leer" && " · Lootpool war leer, Auktion vorzeitig beendet"}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {players.map((p) => {
            const items = loadoutFor(p.seat, rounds, auction.items_per_player)
            const spent = items.reduce((s, r) => s + (r?.price ?? 0), 0)
            return (
              <div key={p.seat} className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-panel p-4">
                <div className={clsx("font-display text-2xl", SEAT_COLORS[p.seat - 1])}>{p.display_name}</div>
                <div className="w-full">
                  <LoadoutBar items={items.map(toSlot)} />
                </div>
                <ul className="w-full text-xs">
                  {items.map((r, i) => (
                    <li key={i} className="flex justify-between border-b border-line/50 py-0.5">
                      <span>{r?.item_name ?? "—"}</span>
                      <span className="text-muted">{r ? (r.status === "zugelost" ? "🎲 zugelost" : `${r.price} 🪙`) : ""}</span>
                    </li>
                  ))}
                </ul>
                <div className="text-center">
                  <div className="font-display text-3xl text-accent">🪙 {p.gold}</div>
                  <div className="text-xs text-muted">
                    Restgold · {spent} ausgegeben{ranking[0] === p.seat && " · 👑 sparsamster Bieter"}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ExportButtons target={ref} filename={`loot-auktion-${auction.id}.png`} />
        {isAdmin &&
          (challengeId ? (
            <span className="text-sm text-win">Als Challenge #{challengeId} gespeichert – Ergebnis unter Admin eintragen.</span>
          ) : (
            <button
              className="btn-secondary"
              disabled={saving}
              onClick={async () => {
                setSaving(true)
                setSaveError(null)
                try {
                  setChallengeId(await saveAuctionChallenge(auction.id))
                } catch (e) {
                  setSaveError(e instanceof Error ? e.message : "Fehler")
                }
                setSaving(false)
              }}
            >
              Als Challenge speichern
            </button>
          ))}
        {saveError && <span className="text-sm text-fail">{saveError}</span>}
      </div>
    </section>
  )
}
