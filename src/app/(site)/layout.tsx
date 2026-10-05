import { Footer } from "@/components/footer"
import { Header } from "@/components/header"

// Normale Seiten mit Kopf- und Fußzeile; OBS-Overlays liegen außerhalb dieser Gruppe
export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6">{children}</main>
      <Footer />
    </div>
  )
}
