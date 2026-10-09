// Wird sofort beim Seitenwechsel angezeigt, bis die neue Seite vom Server da ist.
// Neutrale Platzhalter statt eines farbigen Lade-Kreises, damit nichts aufblitzt.
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Lädt">
      <div className="h-10 w-64 max-w-full animate-pulse rounded-md bg-panel-2/60" />
      <div className="h-40 animate-pulse rounded-md border border-line bg-panel/50" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-32 animate-pulse rounded-md border border-line bg-panel/50" />
        <div className="h-32 animate-pulse rounded-md border border-line bg-panel/50" />
      </div>
    </div>
  )
}
