// Vereinfachte Plattform-Icons (eigene, schlichte Nachbauten – keine Original-Logos)
export function PlatformIcon({ platform, className, src }: { platform: string; className?: string; src?: string | null }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={`${className ?? ""} rounded-md object-contain`} aria-hidden />
  }
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
