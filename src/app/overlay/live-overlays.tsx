"use client"

import clsx from "clsx"
import { motion } from "framer-motion"
import { useLiveOverlay } from "@/components/live-overlay/use-live-overlay"
import { LoadoutSlot } from "@/components/loadout-bar"
import type { DropOverlay, LoadoutOverlay } from "@/lib/live-overlay"

const shadow = { textShadow: "0 2px 3px rgba(0,0,0,.9)" }

function Waiting({ text }: { text: string }) {
  return <div className="m-2 inline-block rounded-2xl bg-black/70 px-4 py-2 font-display text-xl text-white">{text}</div>
}

export function LoadoutOverlayView({ userId, initial }: { userId: string; initial: LoadoutOverlay | null }) {
  const { data, stamp } = useLiveOverlay<LoadoutOverlay>(userId, "loadout", initial)
  if (!data?.items?.some(Boolean)) return <Waiting text="🎲 Loadout wird gewürfelt…" />
  return (
    <motion.div
      key={stamp}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="m-2 inline-flex gap-2 rounded-2xl border-2 border-white/15 bg-[#0b0a1f]/80 p-2"
    >
      {data.items.map((item, i) => (
        <div key={i} className="flex w-24 flex-col items-center gap-1">
          <LoadoutSlot item={item && { name: item.name, rarity: item.rarity, type: item.type, iconUrl: item.icon_url }} index={i} size="lg" />
          <span className="line-clamp-2 w-full text-center text-[11px] font-bold leading-tight text-white" style={shadow}>
            {item?.name ?? "–"}
          </span>
        </div>
      ))}
    </motion.div>
  )
}

export function DropOverlayView({ userId, initial }: { userId: string; initial: DropOverlay | null }) {
  const { data, stamp } = useLiveOverlay<DropOverlay>(userId, "drop", initial)
  if (!data?.circles?.length) return <Waiting text="🪂 Der Bus fliegt gleich…" />
  const multi = data.circles.length > 1
  return (
    <motion.div
      key={stamp}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="m-2 inline-flex min-w-[260px] max-w-[440px] flex-col overflow-hidden rounded-2xl border-2 border-white/15 bg-[#0b0a1f]/85 text-white"
    >
      <div className="bg-gradient-to-r from-[#0ea5e9] to-[#7c3aed] px-4 py-1.5 font-display text-xl tracking-wide drop-shadow">🪂 LANDESPOT</div>
      <ul className="flex flex-col gap-1 px-4 py-2">
        {data.circles.map((c, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: c.color }} />
            {multi && (
              <span className="font-bold" style={{ ...shadow, color: c.color }}>
                {c.player}:
              </span>
            )}
            <span className={clsx("font-display leading-tight", multi ? "text-xl" : "text-3xl")} style={shadow}>
              {c.spot}
            </span>
          </li>
        ))}
      </ul>
      {data.rule && (
        <div className="border-t border-white/10 bg-white/5 px-4 py-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/70">Zusatzregel</div>
          <div className="text-lg font-extrabold leading-snug" style={shadow}>
            {data.rule}
          </div>
        </div>
      )}
    </motion.div>
  )
}
