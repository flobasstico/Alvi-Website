"use client"

import { signInWithTwitch } from "@/lib/twitch-login"

/** Freier Platz in der Party: Klick startet den Twitch-Login */
export function LoginSlot({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={() => signInWithTwitch()} className={className} title="Mit Twitch einloggen, um mitzuspielen">
      {children}
    </button>
  )
}
