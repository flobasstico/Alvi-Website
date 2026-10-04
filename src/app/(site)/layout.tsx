import { Header } from "@/components/header"

// Normale Seiten mit Kopfzeile; OBS-Overlays liegen außerhalb dieser Gruppe
export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6">{children}</main>
    </>
  )
}
