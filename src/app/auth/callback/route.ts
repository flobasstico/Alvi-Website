import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/"

  let failure: string | null = null
  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    failure = error?.message ?? null
    if (!error) {
      const res = NextResponse.redirect(`${origin}${safeNext}`)
      // Chat-Schreibrechte für die Chat-Brücke der Regel-Eskalation (Twitch-Token gilt ca. 4 Stunden)
      const token = data.session?.provider_token
      const meta = data.session?.user.user_metadata ?? {}
      const login = String(meta.slug ?? meta.name ?? meta.preferred_username ?? "").toLowerCase()
      if (searchParams.get("chat") === "1" && token && /^[a-z0-9_]{3,25}$/.test(login)) {
        const opts = { path: "/", maxAge: 4 * 3600, sameSite: "lax" as const, secure: origin.startsWith("https") }
        res.cookies.set("twitch_chat_token", token, opts)
        res.cookies.set("twitch_chat_login", login, opts)
      }
      return res
    }
  }
  // Login fehlgeschlagen (z. B. Twitch lehnt die App ab): zurück zur Seite, dort erscheint ein Hinweis
  const reason = searchParams.get("error_description") ?? searchParams.get("error") ?? failure ?? "unbekannt"
  const back = new URL(`${origin}${safeNext}`)
  back.searchParams.set("login", "fehler")
  back.searchParams.set("grund", reason.slice(0, 200))
  return NextResponse.redirect(back)
}
