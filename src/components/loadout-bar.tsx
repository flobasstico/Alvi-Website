import clsx from "clsx"
import { RARITY_LABEL, type Rarity } from "@/lib/constants"
import { ItemIcon } from "./item-icon"

export type SlotItem = {
  name: string
  rarity: string
  type: string
  iconUrl?: string | null
  price?: number | null
  /** Am Ende zugelost statt ersteigert */
  lottery?: boolean
}

// Fortnite-Hotbar: Raritäts-Hintergrund mit Lichtkegel, Icon mittig, farbige Leiste unten
const SLOT_BG: Record<Rarity, string> = {
  grau: "from-[#8a8f98] to-[#4b5058]",
  gruen: "from-[#69bb1e] to-[#2f6b0a]",
  blau: "from-[#3db6f2] to-[#145a9e]",
  lila: "from-[#c45dfa] to-[#5d1a96]",
  gold: "from-[#f6b13d] to-[#a14b10]",
  mythisch: "from-[#ffe57a] to-[#c28a00]",
}
const SLOT_BAR: Record<Rarity, string> = {
  grau: "bg-[#b5bac2]",
  gruen: "bg-[#8fe03a]",
  blau: "bg-[#6fd0ff]",
  lila: "bg-[#e08cff]",
  gold: "bg-[#ffcc66]",
  mythisch: "bg-[#fff2b0]",
}

type Size = "sm" | "md" | "lg" | "fluid"

export function LoadoutSlot({ item, index, size = "md" }: { item: SlotItem | null; index: number; size?: Size }) {
  const dims = { sm: "h-12 w-12", md: "h-16 w-16 sm:h-20 sm:w-20", lg: "h-20 w-20 sm:h-24 sm:w-24", fluid: "aspect-square w-full" }[size]
  const rarity = item?.rarity as Rarity | undefined
  return (
    <div
      className={clsx(
        "relative shrink-0 overflow-hidden rounded-md border-2",
        dims,
        item ? "border-white/70 shadow-lg" : "border-white/15 bg-black/40",
      )}
      title={item ? `${item.name} (${RARITY_LABEL[rarity!] ?? item.rarity})${item.lottery ? " – zugelost" : item.price != null ? ` – ${item.price} Gold` : ""}` : `Slot ${index + 1}`}
    >
      {item && (
        <>
          <div className={clsx("absolute inset-0 bg-gradient-to-b", SLOT_BG[rarity!] ?? SLOT_BG.grau)} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(255,255,255,.45),transparent_60%)]" />
          <ItemIcon url={item.iconUrl} type={item.type} name={item.name} className="absolute inset-[8%] h-[84%] w-[84%] text-2xl sm:text-3xl" />
          <div className={clsx("absolute inset-x-0 bottom-0 h-1.5", SLOT_BAR[rarity!] ?? SLOT_BAR.grau)} />
          {(item.lottery || item.price != null) && size !== "sm" && (
            <div className="absolute right-0.5 top-0.5 rounded bg-black/60 px-1 text-[10px] font-bold text-accent">
              {item.lottery ? "🎲" : item.price}
            </div>
          )}
        </>
      )}
      {!item && <span className="absolute left-1 top-0.5 text-[10px] font-bold text-white/30">{index + 1}</span>}
    </div>
  )
}

/** Hotbar; ohne size passt sie sich der Breite des Containers an. */
export function LoadoutBar({ items, size = "fluid" }: { items: (SlotItem | null)[]; size?: Size }) {
  if (size === "fluid") {
    return (
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item, i) => (
          <LoadoutSlot key={i} item={item} index={i} size="fluid" />
        ))}
      </div>
    )
  }
  return (
    <div className="flex gap-1.5">
      {items.map((item, i) => (
        <LoadoutSlot key={i} item={item} index={i} size={size} />
      ))}
    </div>
  )
}
