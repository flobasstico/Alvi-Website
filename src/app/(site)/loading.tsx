// Wird sofort beim Seitenwechsel angezeigt, bis die neue Seite vom Server da ist
export default function Loading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Lädt">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-accent" />
    </div>
  )
}
