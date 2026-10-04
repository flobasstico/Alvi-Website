import type { Metadata } from "next"
import { Inter, Luckiest_Guy } from "next/font/google"
import { Header } from "@/components/header"
import "./globals.css"

const body = Inter({ variable: "--font-body", subsets: ["latin"] })
const display = Luckiest_Guy({ variable: "--font-display", weight: "400", subsets: ["latin"] })

export const metadata: Metadata = {
  title: { default: "Alvi Challenges", template: "%s · Alvi Challenges" },
  description: "Glücksrad, Loadout-Würfel, Voting, Versus, Bingo und Stats für Alvis Fortnite-Challenges.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className={`${body.variable} ${display.variable} font-sans antialiased`}>
        <Header />
        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6">{children}</main>
      </body>
    </html>
  )
}
