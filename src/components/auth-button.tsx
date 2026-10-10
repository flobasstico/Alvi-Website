"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { signInWithTwitch } from "@/lib/twitch-login"

export function AuthButton({ name, avatar, login }: { name: string | null; avatar: string | null; login?: string | null }) {
  const router = useRouter()
  const supabase = createClient()

  if (!name) {
    return (
      <button
        className="btn bg-[#9146ff] text-white hover:brightness-110"
        onClick={() => signInWithTwitch()}
      >
        Mit Twitch einloggen
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {/* Bild und Name führen zum eigenen Profil */}
      <Link href={login ? `/profil/${login}` : "/"} className="flex items-center gap-2 hover:text-accent" title="Mein Profil">
        {avatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-8 w-8 rounded-full border border-line" />
        )}
        <span className="hidden text-sm font-semibold sm:inline">{name}</span>
      </Link>
      <button
        className="btn-secondary px-3 py-1 text-sm"
        onClick={async () => {
          await supabase.auth.signOut()
          router.refresh()
        }}
      >
        Logout
      </button>
    </div>
  )
}
