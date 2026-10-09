import Link from "next/link"

// Kanal-Links gibt es nur in der Lobby (Startseite)
export function Footer() {
  return (
    <footer className="mt-auto border-t-2 border-black/40 bg-[#061235]/80">
      <nav className="mx-auto flex w-full max-w-6xl justify-center gap-4 px-4 py-6 text-sm text-muted sm:justify-end">
        <Link href="/impressum" className="hover:text-white">Impressum</Link>
        <Link href="/datenschutz" className="hover:text-white">Datenschutz</Link>
      </nav>
    </footer>
  )
}
