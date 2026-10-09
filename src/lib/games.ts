/**
 * Alle „Modi“ der Seite – für die Lobby (ausgewählter Modus) und den Entdecken-Bildschirm.
 * `sky` sind die zwei Farben des gezeichneten Vorschaubilds (oben → unten).
 */

export type GameCategory = "challenge" | "minispiel" | "community"

export type Game = {
  slug: string
  href: string
  emoji: string
  title: string
  text: string
  players: string | null
  multiplayer: boolean
  category: GameCategory
  sky: [string, string]
}

export const GAMES: readonly Game[] = [
  {
    slug: "rad",
    href: "/rad",
    emoji: "🎡",
    title: "Challenge-Glücksrad",
    text: "Stellt euch eure individuellen Regeln mit dem Glücksrad zusammen!",
    players: "1+",
    multiplayer: false,
    category: "challenge",
    sky: ["#7c3aed", "#1e1b8f"],
  },
  {
    slug: "eskalation",
    href: "/eskalation",
    emoji: "🚨",
    title: "Regel-Eskalation",
    text: "1. Regel per Glücksrad, danach alle 4 Minuten per Zufall eine extra Regel!!",
    players: "1+",
    multiplayer: false,
    category: "challenge",
    sky: ["#ef4444", "#7f1d1d"],
  },
  {
    slug: "auktion",
    href: "/auktion",
    emoji: "🪙",
    title: "Loot-Auktion",
    text: "Bietet, um euer Loadout zusammenzustellen! Wer geht am schlausten mit seinem Gold um?",
    players: "2–8",
    multiplayer: true,
    category: "challenge",
    sky: ["#f59e0b", "#7c2d12"],
  },
  {
    slug: "bingo",
    href: "/bingo",
    emoji: "🔢",
    title: "Bingo",
    text: "Alle spielen dieselbe 3×3-Karte und haken für sich ab – mit eigenen Karten und Punkten.",
    players: "1–8",
    multiplayer: true,
    category: "challenge",
    sky: ["#22c55e", "#14532d"],
  },
  {
    slug: "loadout",
    href: "/loadout",
    emoji: "🎲",
    title: "Loadout-Würfel",
    text: "Stellt euer Loadout mit dem Zufallswürfel zusammen. Bis zu 3-mal neu würfeln – klug entscheiden, welche Items fix sein sollten!",
    players: "1–8",
    multiplayer: true,
    category: "challenge",
    sky: ["#ec4899", "#581c87"],
  },
  {
    slug: "drop",
    href: "/drop",
    emoji: "🪂",
    title: "Drop-Spot-Roulette",
    text: "Per Zufall wird euer Landingspot entschieden! Wer holt sich den Sieg? Extraregeln inklusive!",
    players: "1–8",
    multiplayer: true,
    category: "challenge",
    sky: ["#38bdf8", "#1e3a8a"],
  },
  {
    slug: "winchallenge",
    href: "/winchallenge",
    emoji: "🏆",
    title: "Winchallenge",
    text: "Stellt euch eure eigene Winchallenge zusammen oder spielt die der Jungs nach!",
    players: "1+",
    multiplayer: true,
    category: "challenge",
    sky: ["#facc15", "#a16207"],
  },
  {
    slug: "olympiade",
    href: "/olympiade",
    emoji: "🥇",
    title: "Olympiade",
    text: "Spiele aufs Glücksrad, drehen, extern spielen, Sieger markieren – jedes Spiel ist einen Punkt mehr wert.",
    players: "2+",
    multiplayer: true,
    category: "challenge",
    sky: ["#14b8a6", "#134e4a"],
  },
  {
    slug: "dropzone",
    href: "/minispiele/dropzone",
    emoji: "🪂",
    title: "Drop-Zone",
    text: "Spring aus dem Battle Bus und lande so genau wie möglich auf dem Ziel. Schlag Alvis Highscore!",
    players: "1",
    multiplayer: false,
    category: "minispiel",
    sky: ["#60a5fa", "#4338ca"],
  },
  {
    slug: "sturmlauf",
    href: "/minispiele/sturmlauf",
    emoji: "🌀",
    title: "Sturm-Lauf",
    text: "Der Sturm ist dir auf den Fersen! Spring über Hindernisse und sammle Loot.",
    players: "1",
    multiplayer: false,
    category: "minispiel",
    sky: ["#a855f7", "#3b0764"],
  },
  {
    slug: "liga",
    href: "/liga",
    emoji: "🏆",
    title: "Creator-Liga",
    text: "Die Challenges der Creator außerhalb der Website – mit Ligapunkten, Siegen, Videos und Kopf-an-Kopf-Duellen.",
    players: null,
    multiplayer: false,
    category: "community",
    sky: ["#fbbf24", "#9a3412"],
  },
  {
    slug: "stats",
    href: "/stats",
    emoji: "📊",
    title: "Stats",
    text: "Wer gewinnt am meisten? Alle Runden, Siege und Quoten von Creatorn, Alvi und Zuschauern.",
    players: null,
    multiplayer: false,
    category: "community",
    sky: ["#06b6d4", "#1e3a8a"],
  },
  {
    slug: "ranglisten",
    href: "/ranglisten",
    emoji: "📺",
    title: "Ranglisten",
    text: "Watchtime und Punkte aus Alvis Stream – und die Bestenlisten der Minispiele.",
    players: null,
    multiplayer: false,
    category: "community",
    sky: ["#9146ff", "#312e81"],
  },
  {
    slug: "vorschlaege",
    href: "/vorschlaege",
    emoji: "💡",
    title: "Community-Vorschläge",
    text: "Eure Ideen für neue Challenges – einreichen und abstimmen.",
    players: null,
    multiplayer: false,
    category: "community",
    sky: ["#84cc16", "#365314"],
  },
]

export const DEFAULT_GAME = "rad"
export const gameBySlug = (slug: string | null | undefined) => GAMES.find((g) => g.slug === slug)
export const thumbKey = (slug: string) => `thumb_${slug}`

/** Eigene Vorschaubilder aus den Seiteneinstellungen (nur gültige Adressen) */
export function gameThumbs(settings: ReadonlyMap<string, string>, safeUrl: (v: string | undefined) => string | null) {
  return Object.fromEntries(GAMES.map((g) => [g.slug, safeUrl(settings.get(thumbKey(g.slug)))]).filter(([, url]) => url)) as Record<string, string>
}
