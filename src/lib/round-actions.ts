"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/supabase/server"

export type RoundKind = "eskalation" | "loadout" | "auktion" | "bingo" | "winchallenge" | "challenge"
const KINDS: RoundKind[] = ["eskalation", "loadout", "auktion", "bingo", "winchallenge", "challenge"]

/** Runde samt Eintrag in Alvis Statistik löschen (nur Admins) und optional zur Übersicht zurück */
export async function deleteRound(kind: RoundKind, id: number, back?: string) {
  const supabase = await requireAdmin()
  if (!KINDS.includes(kind)) throw new Error("Unbekannte Spielart")
  const { error } = await supabase.rpc("admin_delete_round", { p_kind: kind, p_id: id })
  if (error) throw new Error(error.message)
  revalidatePath("/", "layout")
  if (back) redirect(back)
}
