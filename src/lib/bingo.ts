export const BINGO_SIZE = 3
export const BINGO_CELLS = BINGO_SIZE * BINGO_SIZE

const range = Array.from({ length: BINGO_SIZE }, (_, i) => i)

/** Gewinnlinien: alle Reihen, alle Spalten und die beiden Diagonalen (Feld-Indizes) */
export const BINGO_LINES: number[][] = [
  ...range.map((r) => range.map((c) => r * BINGO_SIZE + c)),
  ...range.map((c) => range.map((r) => r * BINGO_SIZE + c)),
  range.map((i) => i * BINGO_SIZE + i),
  range.map((i) => i * BINGO_SIZE + (BINGO_SIZE - 1 - i)),
]

/** Markierte Felder einer Karte (kein Freifeld). */
export function markedCells(cardTaskIds: readonly number[], markedTaskIds: ReadonlySet<number>): boolean[] {
  return cardTaskIds.map((id) => markedTaskIds.has(id))
}

/** Alle vollständigen Linien (Indizes in BINGO_LINES). */
export function completedLines(marked: readonly boolean[]): number[] {
  return BINGO_LINES.flatMap((line, i) => (line.every((c) => marked[c]) ? [i] : []))
}

export function hasBingo(marked: readonly boolean[]): boolean {
  return completedLines(marked).length > 0
}

export const POINTS_PER_FIELD = 1
export const POINTS_PER_BINGO = 3
/** Höchstpunktzahl: alle Felder + alle Linien */
export const MAX_POINTS = BINGO_CELLS * POINTS_PER_FIELD + BINGO_LINES.length * POINTS_PER_BINGO

export type BingoScore = { fields: number; bingos: number; points: number; full: boolean }

/** 1 Punkt pro erledigtem Feld, +3 pro voller Linie (Reihe, Spalte, Diagonale) */
export function bingoScore(marked: readonly boolean[]): BingoScore {
  const fields = marked.filter(Boolean).length
  const bingos = completedLines(marked).length
  return { fields, bingos, points: fields * POINTS_PER_FIELD + bingos * POINTS_PER_BINGO, full: marked.length > 0 && fields === marked.length }
}

export type RankEntry = { key: string; name: string; avatar: string | null; streamer: boolean; score: BingoScore; joinedAt: string }

/** Rangliste nach Punkten; bei Gleichstand zählt, wer seine Karte früher geholt hat */
export function rankEntries(entries: RankEntry[]): RankEntry[] {
  return [...entries].sort((a, b) => b.score.points - a.score.points || a.joinedAt.localeCompare(b.joinedAt))
}
