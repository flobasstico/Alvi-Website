import Link from "next/link"
import { CHANNELS, loadSiteSettings, safeUrl } from "@/lib/site"
import { createClient } from "@/lib/supabase/server"

export async function Footer() {
  const settings = await loadSiteSettings(await createClient())
  const channels = CHANNELS.flatMap((c) => {
    const url = safeUrl(settings.get(c.key))
    return url ? [{ ...c, url }] : []
  })
  return (
    <footer className="mt-auto border-t border-line bg-panel/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 py-6 sm:flex-row sm:justify-between">
        {channels.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-sm text-muted">Alvi auf</span>
            {channels.map((c) => (
              <a
                key={c.key}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`rounded-full px-3 py-1 text-sm font-bold transition hover:brightness-110 ${c.color}`}
              >
                {c.label}
              </a>
            ))}
          </div>
        )}
        <nav className="flex gap-4 text-sm text-muted">
          <Link href="/impressum" className="hover:text-white">Impressum</Link>
          <Link href="/datenschutz" className="hover:text-white">Datenschutz</Link>
        </nav>
      </div>
    </footer>
  )
}
