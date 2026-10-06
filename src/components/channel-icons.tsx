"use client"

import { useState } from "react"

// Vereinfachte Plattform-Icons (eigene, schlichte Nachbauten – keine Original-Logos)
export function PlatformIcon({ platform, className, src }: { platform: string; className?: string; src?: string | null }) {
  const [broken, setBroken] = useState(false)
  if (src && !broken) {
    // Hochgeladenes Logo: weißer Untergrund, damit auch dunkle Logos auf dem dunklen Hintergrund sichtbar sind.
    // Lädt das Bild nicht, erscheint das eingebaute Icon.
    return (
      <span className={`${className ?? ""} inline-flex items-center justify-center overflow-hidden rounded-md bg-white p-0.5 shadow`} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-contain" onError={() => setBroken(true)} />
      </span>
    )
  }
  return <BuiltInIcon platform={platform} className={className} />
}

function BuiltInIcon({ platform, className }: { platform: string; className?: string }) {
  switch (platform) {
    case "link_youtube":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <rect x="1.5" y="4.5" width="21" height="15" rx="4.5" fill="#ff0033" />
          <path d="M10 8.8v6.4l5.6-3.2z" fill="#fff" />
        </svg>
      )
    case "link_twitch":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <path d="M4.5 2.5 3 6.3v14h4.6v2.2h2.6l2.2-2.2h3.5l4.6-4.6V2.5z" fill="#9146ff" />
          <path d="M6.3 4.3h13v10.2l-2.8 2.8h-4.4l-2.2 2.2v-2.2H6.3z" fill="#fff" />
          <path d="M11 7.5h1.8v5H11zm4.6 0h1.8v5h-1.8z" fill="#9146ff" />
        </svg>
      )
    case "link_instagram":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <defs>
            <linearGradient id="ig" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#feda75" />
              <stop offset=".35" stopColor="#fa7e1e" />
              <stop offset=".6" stopColor="#d62976" />
              <stop offset="1" stopColor="#4f5bd5" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#ig)" />
          <rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="#fff" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="2.9" fill="none" stroke="#fff" strokeWidth="1.8" />
          <circle cx="16.4" cy="7.6" r="1.1" fill="#fff" />
        </svg>
      )
    case "link_tiktok":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="#000" />
          <path d="M13.2 5.5h2.4c.3 1.7 1.4 2.8 3 3v2.4a6 6 0 0 1-3-.9v4.8a4.3 4.3 0 1 1-4.3-4.3h.4v2.5a1.9 1.9 0 1 0 1.5 1.8z" fill="#25f4ee" transform="translate(-.6 -.4)" />
          <path d="M13.2 5.5h2.4c.3 1.7 1.4 2.8 3 3v2.4a6 6 0 0 1-3-.9v4.8a4.3 4.3 0 1 1-4.3-4.3h.4v2.5a1.9 1.9 0 1 0 1.5 1.8z" fill="#fe2c55" transform="translate(.6 .4)" />
          <path d="M13.2 5.5h2.4c.3 1.7 1.4 2.8 3 3v2.4a6 6 0 0 1-3-.9v4.8a4.3 4.3 0 1 1-4.3-4.3h.4v2.5a1.9 1.9 0 1 0 1.5 1.8z" fill="#fff" />
        </svg>
      )
    case "link_x":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="#000" stroke="#fff" strokeOpacity=".25" />
          <path d="M6.5 6.5h3.2l8 11h-3.2z" fill="#fff" />
          <path d="M17.2 6.5 12.9 11.3m-1.8 2-4.3 4.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case "link_discord":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="#5865f2" />
          <path d="M7 8.2c1.5-.9 3-1.2 3-1.2l.3.6a11 11 0 0 1 3.4 0l.3-.6s1.5.3 3 1.2c1.2 2 1.6 4.3 1.5 6.7a8 8 0 0 1-2.9 1.5l-.6-1c.5-.2 1-.4 1.4-.7-2.5 1.2-5.3 1.2-7.8 0 .4.3.9.5 1.4.7l-.6 1a8 8 0 0 1-2.9-1.5C5.4 12.5 5.8 10.2 7 8.2z" fill="#fff" />
          <circle cx="9.8" cy="12.3" r="1.1" fill="#5865f2" />
          <circle cx="14.2" cy="12.3" r="1.1" fill="#5865f2" />
        </svg>
      )
    case "link_epic":
      // Epic-Games-Schild mit Schriftzug
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="#121212" stroke="#fff" strokeOpacity=".25" />
          <path d="M6.8 3.8h10.4c.7 0 1.2.5 1.2 1.2v11.4L12 20.3l-6.4-3.9V5c0-.7.5-1.2 1.2-1.2z" fill="#121212" stroke="#fff" strokeWidth="1.1" />
          <text x="12" y="11.3" textAnchor="middle" fill="#fff" fontSize="4.6" fontWeight="900" fontFamily="Arial, Helvetica, sans-serif" letterSpacing="-.2">
            EPIC
          </text>
          <text x="12" y="14.6" textAnchor="middle" fill="#fff" fontSize="2.4" fontWeight="800" fontFamily="Arial, Helvetica, sans-serif" letterSpacing=".2">
            GAMES
          </text>
        </svg>
      )
    case "link_merch":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="#ffd60a" />
          <path d="M7 9h10l-.8 9.2a1 1 0 0 1-1 .8H8.8a1 1 0 0 1-1-.8z" fill="#111" />
          <path d="M9.5 10.5V8a2.5 2.5 0 0 1 5 0v2.5" fill="none" stroke="#111" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    default:
      return null
  }
}
