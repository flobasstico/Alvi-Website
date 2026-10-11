import type { NextConfig } from "next"

// Grundlegende Sicherheits-Header für alle Seiten (OBS lädt Overlays direkt, nicht in einem Frame)
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
]

const nextConfig: NextConfig = {
  // Vorschaubilder von YouTube laufen über den eigenen Server (Besucher laden nichts direkt von Google)
  images: { remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" }] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
