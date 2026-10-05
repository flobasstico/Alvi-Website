import Link from "next/link"
import { channelsFromSettings, loadSiteSettings } from "@/lib/site"
import { createClient } from "@/lib/supabase/server"
import { ChannelLinks } from "./channel-links"

export async function Footer() {
  const channels = channelsFromSettings(await loadSiteSettings(await createClient()))
  return (
    <footer className="mt-auto border-t border-line bg-panel/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 py-6 sm:flex-row sm:justify-between">
        {channels.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-sm text-muted">Alvi auf</span>
            <ChannelLinks channels={channels} variant="pills" />
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
