export type Finished = { status: string; played_at: string | null; created_at: string }

export function successRate(won: number, finished: number): number {
  return finished === 0 ? 0 : Math.round((won / finished) * 100)
}

/** Streaks über abgeschlossene Challenges (chronologisch). */
export function streaks(challenges: readonly Finished[]) {
  const done = challenges
    .filter((c) => c.status === "geschafft" || c.status === "gescheitert")
    .sort((a, b) => (a.played_at ?? a.created_at).localeCompare(b.played_at ?? b.created_at))
  let bestWin = 0
  let bestFail = 0
  let run = 0
  let prev: string | null = null
  for (const c of done) {
    run = c.status === prev ? run + 1 : 1
    prev = c.status
    if (c.status === "geschafft") bestWin = Math.max(bestWin, run)
    else bestFail = Math.max(bestFail, run)
  }
  return { current: prev ? { status: prev, count: run } : null, bestWin, bestFail }
}

/** Running Gag je nach Quote. */
export function rateQuip(rate: number, finished: number): string {
  if (finished === 0) return "Noch keine Challenge abgeschlossen. Die Ruhe vor dem Sturm."
  if (rate < 15) return "Statistisch gesehen eher ein Sturm-Opfer als ein Sturm-Überlebender."
  if (rate < 35) return "Es läuft… irgendwie. Chat glaubt trotzdem an ihn. Meistens."
  if (rate < 60) return "Münzwurf-Niveau. Spannung garantiert."
  if (rate < 85) return "Verdächtig gut. Sind die Challenges zu leicht?"
  return "Unaufhaltsam. Chat, macht die Challenges härter!"
}
