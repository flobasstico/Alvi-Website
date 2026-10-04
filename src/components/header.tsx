import Link from "next/link"
import { NAV } from "@/lib/constants"
import { getViewer } from "@/lib/supabase/server"
import { AuthButton } from "./auth-button"
import { NavLinks } from "./nav-links"

export async function Header() {
  const { profile, isAdmin } = await getViewer()
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="font-display text-2xl text-accent drop-shadow">
          ALVI<span className="text-accent-2">.</span>
        </Link>
        <NavLinks items={[...NAV, ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : [])]} />
        <div className="ml-auto">
          <AuthButton name={profile?.display_name ?? null} avatar={profile?.avatar_url ?? null} />
        </div>
      </div>
    </header>
  )
}
