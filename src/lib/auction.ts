import type { Tables } from "./database.types"

export type Auction = Tables<"auctions">
export type Player = Tables<"auction_players">
export type Round = Tables<"auction_rounds">
export type Bid = Tables<"auction_bids">

/** Prüft ein Gebot wie die Datenbank (auction_bid) – für sofortiges Feedback im UI. */
export function validateBid(amount: number, gold: number, step: number): string | null {
  if (!Number.isInteger(amount)) return "Nur ganze Zahlen"
  if (amount < 0) return "Gebot darf nicht negativ sein"
  if (amount % step !== 0) return `Nur in ${step}er-Schritten`
  if (amount > gold) return "Nicht genug Gold"
  return null
}

/** Schnellgebote: sinnvolle, gültige Beträge bis zum verfügbaren Gold. */
export function quickBids(gold: number, step: number): number[] {
  const floorStep = (v: number) => Math.floor(v / step) * step
  const opts = [step, 5 * step, 10 * step, floorStep(gold / 2), floorStep(gold)]
  return [...new Set(opts.filter((v) => v > 0 && v <= gold))].sort((a, b) => a - b)
}

/** Gewonnene Items eines Sitzes in Gewinn-Reihenfolge, aufgefüllt mit null bis zur Slot-Anzahl. */
export function loadoutFor(seat: number, rounds: readonly Round[], slots: number): (Round | null)[] {
  const won = rounds
    .filter((r) => r.status === "entschieden" && r.winner_seat === seat)
    .sort((a, b) => a.round_no - b.round_no)
  return Array.from({ length: slots }, (_, i) => won[i] ?? null)
}

export function isActive(p: Player, a: Auction): boolean {
  return p.item_count < a.items_per_player
}

export type Phase =
  | { kind: "lobby" }
  | { kind: "reveal"; last: Round; next: Round | null }
  | { kind: "bidding"; round: Round }
  | { kind: "ended" }

/** Welche Ansicht gerade dran ist. Nach jeder Auswertung zeigt die Reveal-Phase das Ergebnis, bis das nächste Item freigegeben wird. */
export function phaseOf(a: Auction, rounds: readonly Round[], now: number): Phase {
  if (a.status === "lobby") return { kind: "lobby" }
  const sorted = [...rounds].sort((x, y) => x.round_no - y.round_no)
  const open = sorted.find((r) => r.status === "bietet") ?? null
  const lastResolved = [...sorted].reverse().find((r) => r.status !== "bietet") ?? null
  if (a.status === "beendet") {
    // Letztes Ergebnis noch kurz zeigen, bevor der Abschluss-Screen kommt
    if (lastResolved?.resolved_at && now - Date.parse(lastResolved.resolved_at) < 5000) {
      return { kind: "reveal", last: lastResolved, next: null }
    }
    return { kind: "ended" }
  }
  if (open && now < Date.parse(open.opens_at) && lastResolved) return { kind: "reveal", last: lastResolved, next: open }
  if (open) return { kind: "bidding", round: open }
  return { kind: "ended" }
}

export function secondsLeft(iso: string | null, now: number): number | null {
  if (!iso) return null
  return Math.max(0, Math.ceil((Date.parse(iso) - now) / 1000))
}
