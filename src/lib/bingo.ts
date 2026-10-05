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
