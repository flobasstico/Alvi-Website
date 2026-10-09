import Link from "next/link"
import { NAV, TOP_NAV } from "@/lib/constants"
import { getViewer } from "@/lib/supabase/server"
import { Suspense } from "react"
import { AuthButton } from "./auth-button"
import { LoginError } from "./login-error"
import { NavLinks } from "./nav-links"
import { TopTabs } from "./top-tabs"

export async function Header() {
  const { profile, isAdmin } = await getViewer()
  return (
    <header className="sticky top-0 z-40 border-b-2 border-black/40 bg-gradient-to-b from-[#0a1d52]/95 to-[#071640]/90 shadow-[0_4px_20px_#0006] backdrop-blur">
      {/* Wie die Fortnite-Lobby-Leiste: Menü + Logo links, Reiter in der Mitte (Desktop), Login rechts */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-2.5 sm:px-4 lg:grid-cols-[auto_1fr_auto]">
        <div className="flex items-center gap-2 justify-self-start">
          <NavLinks
            items={[
              ...NAV,
              ...(profile?.twitch_login ? [{ href: `/profil/${profile.twitch_login}`, label: "Mein Profil" }] : []),
              ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
            ]}
          />
          <Link href="/" className="hidden font-logo text-2xl text-accent drop-shadow lg:block">
            ALVI<span className="text-accent-2">.</span>
          </Link>
        </div>
        <Link href="/" className="font-logo text-2xl text-accent drop-shadow lg:hidden">
          ALVI<span className="text-accent-2">.</span>
        </Link>
        <div className="hidden justify-self-center lg:block">
          <TopTabs items={TOP_NAV} />
        </div>
        <div className="justify-self-end">
          <AuthButton name={profile?.display_name ?? null} avatar={profile?.avatar_url ?? null} login={profile?.twitch_login ?? null} />
        </div>
      </div>
      <Suspense fallback={null}>
        <LoginError />
      </Suspense>
      {profile?.banned && (
        <div className="bg-fail px-4 py-1.5 text-center text-sm font-bold text-white">
          Dein Account ist gesperrt – du kannst zuschauen, aber nichts erstellen oder mitspielen.
        </div>
      )}
    </header>
  )
}
