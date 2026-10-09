export const RARITIES = ["grau", "gruen", "blau", "lila", "gold", "mythisch"] as const
export type Rarity = (typeof RARITIES)[number]

export const RARITY_LABEL: Record<Rarity, string> = {
  grau: "Gewöhnlich",
  gruen: "Ungewöhnlich",
  blau: "Selten",
  lila: "Episch",
  gold: "Legendär",
  mythisch: "Mythisch",
}

export const RARITY_CLASS: Record<Rarity, string> = {
  grau: "from-zinc-500 to-zinc-700 border-zinc-400",
  gruen: "from-green-500 to-green-800 border-green-400",
  blau: "from-sky-500 to-blue-800 border-sky-400",
  lila: "from-fuchsia-500 to-purple-800 border-fuchsia-400",
  gold: "from-amber-400 to-orange-700 border-amber-300",
  mythisch: "from-yellow-300 to-amber-600 border-yellow-200",
}

export const ITEM_TYPES = ["waffe", "heilung", "utility"] as const
export const ITEM_TYPE_LABEL: Record<(typeof ITEM_TYPES)[number], string> = {
  waffe: "Waffe",
  heilung: "Heilung",
  utility: "Utility",
}

export const SOURCES = ["rad", "loadout", "drop", "bingo", "auktion", "eskalation", "winchallenge", "olympiade", "manuell"] as const
export type Source = (typeof SOURCES)[number]
export const SOURCE_LABEL: Record<Source, string> = {
  rad: "Glücksrad",
  loadout: "Loadout-Würfel",
  drop: "Drop-Spot",
  bingo: "Bingo",
  auktion: "Loot-Auktion",
  eskalation: "Regel-Eskalation",
  winchallenge: "Winchallenge",
  olympiade: "Olympiade",
  manuell: "Manuell",
}

export const STATUSES = ["geplant", "aktiv", "geschafft", "gescheitert"] as const
export type Status = (typeof STATUSES)[number]
export const STATUS_LABEL: Record<Status, string> = {
  geplant: "Geplant",
  aktiv: "Läuft",
  geschafft: "Geschafft",
  gescheitert: "Gescheitert",
}

export const NAV = [
  { href: "/entdecken", label: "Entdecken (alle Modi)" },
  { href: "/eskalation", label: "Eskalation" },
  { href: "/auktion", label: "Auktion" },
  { href: "/bingo", label: "Bingo" },
  { href: "/loadout", label: "Loadout" },
  { href: "/rad", label: "Glücksrad" },
  { href: "/drop", label: "Drop-Spot" },
  { href: "/winchallenge", label: "Winchallenge" },
  { href: "/olympiade", label: "Olympiade" },
  { href: "/minispiele", label: "Minispiele" },
  { href: "/liga", label: "Creator-Liga" },
  { href: "/stats", label: "Stats" },
  { href: "/ranglisten", label: "Ranglisten" },
  { href: "/vorschlaege", label: "Community-Vorschläge" },
] as const

/** Reiter oben in der Kopfleiste (wie die Lobby-Leiste in Fortnite), ab Desktop-Breite */
export const TOP_NAV = [
  { href: "/", label: "Lobby" },
  { href: "/entdecken", label: "Entdecken" },
  { href: "/liga", label: "Liga" },
  { href: "/stats", label: "Stats" },
  { href: "/ranglisten", label: "Ranglisten" },
  { href: "/minispiele", label: "Minispiele" },
] as const
