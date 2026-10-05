import Link from "next/link"

// Kanal-Links gibt es nur in der großen Kachel auf der Startseite
export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-panel/60">
      <nav className="mx-auto flex w-full max-w-6xl justify-center gap-4 px-4 py-6 text-sm text-muted sm:justify-end">
        <Link href="/impressum" className="hover:text-white">Impressum</Link>
        <Link href="/datenschutz" className="hover:text-white">Datenschutz</Link>
      </nav>
    </footer>
  )
}
