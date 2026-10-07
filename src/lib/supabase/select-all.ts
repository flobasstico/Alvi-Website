/**
 * Lädt alle Zeilen einer Abfrage seitenweise. Supabase liefert pro Anfrage höchstens 1000 Zeilen –
 * ohne das würden Stats und Zähler ab dieser Größe still falsch. Die Abfrage braucht eine feste Sortierung.
 */
type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

export async function selectAll<T>(query: (from: number, to: number) => Page<T>, pageSize = 1000): Promise<{ data: T[] }> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) return { data: rows }
  }
}
