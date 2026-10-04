import type { Rarity } from "./constants"

export type ItemType = "waffe" | "heilung" | "utility"
export type ParsedItem = { name: string; rarity: Rarity | null; type: ItemType }

const RARITY_WORDS: Record<string, Rarity> = {
  common: "grau",
  "gewöhnlich": "grau",
  grau: "grau",
  uncommon: "gruen",
  "ungewöhnlich": "gruen",
  "grün": "gruen",
  gruen: "gruen",
  rare: "blau",
  selten: "blau",
  blau: "blau",
  epic: "lila",
  episch: "lila",
  lila: "lila",
  legendary: "gold",
  "legendär": "gold",
  gold: "gold",
  mythic: "mythisch",
  mythisch: "mythisch",
  exotic: "mythisch",
}

const BULLET = /^\s*(?:[•\-*–·]|\d+[.)])\s*/

function typeFromHeader(line: string): ItemType | null {
  const l = line.toLowerCase()
  if (/heal|heil|consum|verbrauch|food|snack/.test(l)) return "heilung"
  if (/mobil|utility|item|gadget|werkzeug/.test(l)) return "utility"
  if (/waffe|weapon|rifle|shotgun|smg|pistol|sniper|melee|nahkampf|spezial|launcher/.test(l)) return "waffe"
  return null
}

/**
 * Liest eine eingefügte Lootpool-Liste. Zeilen mit Aufzählungszeichen sind Items,
 * „Name (Rarity)“ setzt die Seltenheit (englisch oder deutsch). Überschriften ohne
 * Aufzählungszeichen setzen den Typ für die folgenden Items. Gibt es gar keine
 * Aufzählungszeichen, ist jede Zeile ein Item.
 */
export function parseLootList(text: string, defaultType: ItemType = "waffe"): ParsedItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\t/g, " ").trimEnd()).filter((l) => l.trim())
  const hasBullets = lines.some((l) => BULLET.test(l))
  const items: ParsedItem[] = []
  let type = defaultType

  for (const raw of lines) {
    const isItem = !hasBullets || BULLET.test(raw)
    if (!isItem) {
      type = typeFromHeader(raw) ?? type
      continue
    }
    let name = raw.replace(BULLET, "").trim()
    let rarity: Rarity | null = null
    const m = name.match(/\s*\(([^)]+)\)\s*$/)
    if (m) {
      const r = RARITY_WORDS[m[1].trim().toLowerCase()]
      if (r) {
        rarity = r
        name = name.slice(0, m.index).trim()
      }
    }
    name = name.replace(/[’`´]/g, "'").replace(/\s+/g, " ")
    if (name) items.push({ name: name.slice(0, 80), rarity, type })
  }
  return items
}
