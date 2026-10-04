// Platzhalter-Karte, solange kein echtes Map-Bild im Admin hinterlegt ist.
export function IslandMap({ imageUrl }: { imageUrl?: string | null }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt="Fortnite-Map" className="h-full w-full object-cover" draggable={false} />
  }
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
      <rect width="100" height="100" fill="#0c4a6e" />
      <path
        d="M18 12 C35 4 62 6 80 14 C94 22 96 44 90 60 C86 78 74 92 54 94 C34 96 16 88 9 70 C2 52 4 24 18 12 Z"
        fill="#3f7d3a"
        stroke="#e5d39b"
        strokeWidth="1.5"
      />
      <path d="M60 60 C70 58 82 66 84 76 C80 86 70 90 62 86 C56 80 54 66 60 60 Z" fill="#d6b56a" opacity=".85" />
      <path d="M70 26 C80 28 88 38 86 48 C80 50 72 44 68 36 Z" fill="#9ca3af" opacity=".8" />
      <ellipse cx="40" cy="35" rx="9" ry="6" fill="#0ea5e9" opacity=".9" />
      <path d="M10 50 C20 46 30 50 32 62 C24 66 14 62 10 50 Z" fill="#14532d" opacity=".8" />
    </svg>
  )
}
