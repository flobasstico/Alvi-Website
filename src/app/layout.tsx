import type { Metadata } from "next"
import { Inter, Luckiest_Guy } from "next/font/google"
import { TouchActive } from "@/components/touch-active"
import "./globals.css"

const body = Inter({ variable: "--font-body", subsets: ["latin"] })
const display = Luckiest_Guy({ variable: "--font-display", weight: "400", subsets: ["latin"] })

// Absolute Adresse der Seite – nötig, damit geteilte Links ihr Vorschaubild finden
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
const description = "Glücksrad, Loadout-Würfel, Drop-Spot, Bingo, Loot-Auktion, Regel-Eskalation, Creator-Liga, Minispiele und Stats für Alvis Fortnite-Challenges."

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Alvi Challenges", template: "%s · Alvi Challenges" },
  description,
  openGraph: {
    title: "Alvi Challenges",
    description,
    siteName: "Alvi Challenges",
    locale: "de_DE",
    type: "website",
    images: [{ url: "/og/start", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/og/start"] },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className={`${body.variable} ${display.variable} font-sans antialiased`}>
        <TouchActive />
        {children}
      </body>
    </html>
  )
}
