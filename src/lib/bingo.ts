export const BINGO_SIZE = 5
export const FREE_INDEX = 12

export const BINGO_LINES: number[][] = (() => {
  const lines: number[][] = []
  for (let r = 0; r < 5; r++) lines.push([0, 1, 2, 3, 4].map((c) => r * 5 + c))
  for (let c = 0; c < 5; c++) lines.push([0, 1, 2, 3, 4].map((r) => r * 5 + c))
  lines.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20])
  return lines
})()

/** Markierte Felder einer Karte (Mitte immer frei). */
export function markedCells(cardTaskIds: readonly number[], markedTaskIds: ReadonlySet<number>): boolean[] {
  return cardTaskIds.map((id, i) => i === FREE_INDEX || markedTaskIds.has(id))
}

/** Alle vollständigen Linien (Indizes in BINGO_LINES). */
export function completedLines(marked: readonly boolean[]): number[] {
  return BINGO_LINES.flatMap((line, i) => (line.every((c) => marked[c]) ? [i] : []))
}

export function hasBingo(marked: readonly boolean[]): boolean {
  return completedLines(marked).length > 0
}
