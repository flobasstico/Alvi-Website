/* eslint-disable @next/next/no-img-element */
// Kleine Bild-Icons für die Kacheln der Startseite (statt Emojis)

const BOX = "h-12 w-12 shrink-0"

/** Glücksrad: bunte Segmente, Nabe, Zeiger oben */
export function WheelIcon() {
  const colors = ["#7c3aed", "#0ea5e9", "#f59e0b", "#ec4899", "#22c55e", "#ef4444", "#6366f1", "#14b8a6"]
  const r = 21
  const seg = (i: number) => {
    const a0 = ((i * 45 - 90) * Math.PI) / 180
    const a1 = (((i + 1) * 45 - 90) * Math.PI) / 180
    return `M24 26 L${24 + r * Math.cos(a0)} ${26 + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${24 + r * Math.cos(a1)} ${26 + r * Math.sin(a1)} Z`
  }
  return (
    <svg viewBox="0 0 48 48" className={BOX} aria-hidden>
      <circle cx="24" cy="26" r="22.5" fill="#0b0a1f" stroke="#ffd60a" strokeWidth="2" />
      {colors.map((c, i) => (
        <path key={i} d={seg(i)} fill={c} stroke="#0b0a1f" strokeWidth="1" />
      ))}
      <circle cx="24" cy="26" r="4" fill="#ffd60a" stroke="#0b0a1f" strokeWidth="1.5" />
      <path d="M19 1 H29 L24 9 Z" fill="#ffd60a" stroke="#0b0a1f" strokeWidth="1" />
    </svg>
  )
}

/** Mini-Bingokarte 3×3 mit einer abgehakten Diagonale */
export function BingoIcon() {
  const marked = [0, 4, 8, 5]
  return (
    <svg viewBox="0 0 48 48" className={BOX} aria-hidden>
      <rect x="1" y="1" width="46" height="46" rx="7" fill="#0b0a1f" stroke="#ffd60a" strokeWidth="2" />
      {Array.from({ length: 9 }, (_, i) => {
        const x = 5 + (i % 3) * 13.3
        const y = 5 + Math.floor(i / 3) * 13.3
        const on = marked.includes(i)
        return (
          <g key={i}>
            <rect x={x} y={y} width="11.3" height="11.3" rx="2.5" fill={on ? "#22c55e" : "#2a2650"} />
            {on && <path d={`M${x + 2.8} ${y + 5.8} l2.4 2.6 l4.4 -5`} fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
          </g>
        )
      })}
      <line x1="8" y1="8" x2="40" y2="40" stroke="#ffd60a" strokeWidth="2" strokeLinecap="round" opacity=".85" />
    </svg>
  )
}

/** Goldbarren-Stapel */
export function GoldBarsIcon() {
  const bar = (x: number, y: number, key: number) => (
    <g key={key}>
      <path d={`M${x + 3} ${y} H${x + 17} L${x + 20} ${y + 9} H${x} Z`} fill="url(#gold)" stroke="#8a5a00" strokeWidth="1" />
      <path d={`M${x + 4} ${y + 1.5} H${x + 16}`} stroke="#fff6c2" strokeWidth="1.2" opacity=".9" />
    </g>
  )
  return (
    <svg viewBox="0 0 48 48" className={BOX} aria-hidden>
      <defs>
        <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe680" />
          <stop offset=".55" stopColor="#f5b301" />
          <stop offset="1" stopColor="#c27c00" />
        </linearGradient>
      </defs>
      {[bar(3, 35, 0), bar(25, 35, 1), bar(14, 25, 2), bar(14, 14.5, 3)]}
      <path d="M38 8 l1.2 2.6 2.6 1.2 -2.6 1.2 -1.2 2.6 -1.2 -2.6 -2.6 -1.2 2.6 -1.2 Z" fill="#fff6c2" />
    </svg>
  )
}

/** Kleine Version der hochgeladenen Karte mit Landekreis; ohne Karte ein Fallschirm */
export function MapIcon({ url }: { url: string | null | undefined }) {
  if (!url) return <div className="text-4xl">🪂</div>
  return (
    <div className={`${BOX} relative overflow-hidden rounded-lg border-2 border-white/70 shadow-lg`}>
      <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
      <span className="absolute left-[55%] top-[40%] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-accent/30" />
    </div>
  )
}

/** Creator-Liga: kleiner Pokal vor einem Kuchendiagramm */
export function LeagueIcon() {
  return (
    <svg viewBox="0 0 48 48" className={BOX} aria-hidden>
      <circle cx="30" cy="20" r="16" fill="#2a2650" />
      <path d="M30 20 L30 4 A16 16 0 0 1 45.2 25 Z" fill="#facc15" />
      <path d="M30 20 L45.2 25 A16 16 0 0 1 22 33.9 Z" fill="#22d3ee" />
      <path d="M30 20 L22 33.9 A16 16 0 0 1 30 4 Z" fill="#f472b6" />
      <circle cx="30" cy="20" r="6" fill="#0b0a1f" />
      <path d="M6 20 H22 V25 A8 8 0 0 1 6 25 Z" fill="url(#cup)" stroke="#8a5a00" strokeWidth="1" />
      <path d="M6 22 H3 A3 3 0 0 0 6 28 M22 22 H25 A3 3 0 0 1 22 28" fill="none" stroke="#f5b301" strokeWidth="1.6" />
      <rect x="12.5" y="32" width="3" height="6" fill="#c27c00" />
      <rect x="8" y="38" width="12" height="4" rx="1" fill="#f5b301" stroke="#8a5a00" strokeWidth="1" />
      <defs>
        <linearGradient id="cup" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe680" />
          <stop offset="1" stopColor="#c27c00" />
        </linearGradient>
      </defs>
    </svg>
  )
}
