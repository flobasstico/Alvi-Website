import { createClient } from "@/lib/supabase/client"

/** Twitch-Login starten; danach geht es zurück auf die aktuelle Seite */
export function signInWithTwitch() {
  return createClient().auth.signInWithOAuth({
    provider: "twitch",
    options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(location.pathname)}` },
  })
}
