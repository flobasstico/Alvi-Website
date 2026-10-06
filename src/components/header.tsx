import Link from "next/link"
import { NAV } from "@/lib/constants"
import { getViewer } from "@/lib/supabase/server"
import { AuthButton } from "./auth-button"
import { NavLinks } from "./nav-links"

export async function Header() {
  const { profile, isAdmin } = await getViewer()
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/80 backdrop-blur">
      {/* Menü ganz links, Logo in der Mitte, Login rechts */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-3 sm:px-4">
        <div className="justify-self-start">
          <NavLinks
            items={[
              ...NAV,
              ...(profile?.twitch_login ? [{ href: `/profil/${profile.twitch_login}`, label: "Mein Profil" }] : []),
              ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
            ]}
          />
        </div>
        <Link href="/" className="font-display text-2xl text-accent drop-shadow">
          ALVI<span className="text-accent-2">.</span>
        </Link>
        <div className="justify-self-end">
          <AuthButton name={profile?.display_name ?? null} avatar={profile?.avatar_url ?? null} login={profile?.twitch_login ?? null} />
        </div>
      </div>
      {profile?.banned && (
        <div className="bg-fail px-4 py-1.5 text-center text-sm font-bold text-white">
          Dein Account ist gesperrt – du kannst zuschauen, aber nichts erstellen oder mitspielen.
        </div>
      )}
    </header>
  )
}
