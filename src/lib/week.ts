// ISO-Woche in Europe/Berlin – muss zu public.current_week() in der DB passen.
export function isoWeek(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  const d = new Date(Date.UTC(get("year"), get("month") - 1, get("day")))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day) // Donnerstag der Woche bestimmt das Jahr
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

export function previousWeek(week: string): string {
  const [y, w] = week.split("-W").map(Number)
  // Donnerstag der ISO-Woche, dann 7 Tage zurück
  const jan4 = new Date(Date.UTC(y, 0, 4))
  const thursday = new Date(jan4)
  thursday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (w - 1) * 7 + 3)
  thursday.setUTCDate(thursday.getUTCDate() - 7)
  return isoWeek(new Date(thursday.getTime() + 12 * 3600 * 1000))
}
