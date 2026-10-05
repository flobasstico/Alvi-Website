import { notFound } from "next/navigation"
import { AdminDeleteRound } from "@/components/admin-delete-round"
import { getViewer } from "@/lib/supabase/server"
import { AuctionRoom } from "./auction-room"

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auctionId = Number(id)
  if (!Number.isInteger(auctionId)) notFound()
  const { supabase, user, isAdmin } = await getViewer()
  const [{ data: auction }, { data: players }, { data: rounds }, { data: bids }] = await Promise.all([
    supabase.from("auctions").select("*").eq("id", auctionId).maybeSingle(),
    supabase.from("auction_players").select("*").eq("auction_id", auctionId).order("seat"),
    supabase.from("auction_rounds").select("*").eq("auction_id", auctionId).order("round_no"),
    supabase.from("auction_bids").select("*").eq("auction_id", auctionId),
  ])
  if (!auction) notFound()
  return (
    <>
      <AuctionRoom
        initial={{ auction, players: players ?? [], rounds: rounds ?? [], bids: bids ?? [] }}
        serverNow={Date.now()}
        userId={user?.id ?? null}
      />
      {isAdmin && <AdminDeleteRound kind="auktion" id={auctionId} name={auction.title ?? `Auktion #${auctionId}`} back="/auktion" className="mt-8" />}
    </>
  )
}
