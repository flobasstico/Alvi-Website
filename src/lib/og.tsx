/**
 * Vorschaubilder (Open Graph, 1200×630) für geteilte Links in Discord, WhatsApp, X & Co.
 * Ohne Emojis und mit lokal eingebundener Schrift, damit beim Erzeugen nichts nachgeladen werden muss.
 */
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"
import { createClient as createAnonClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

export const OG_SIZE = { width: 1200, height: 630 }

/** Supabase ohne Cookies (Bild-Routen werden von Bots abgerufen, nicht von eingeloggten Personen) */
export const ogSupabase = () => createAnonClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

// Schriften liegen im Projekt (Luckiest Guy: Apache-2.0, Noto Sans: OFL)
let fonts: Promise<[Buffer, Buffer]> | null = null
const loadFonts = () =>
  (fonts ??= Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/LuckiestGuy-Regular.ttf")),
    readFile(join(process.cwd(), "src/assets/fonts/NotoSans-Regular.ttf")),
  ]))

/** Bild als data-URL laden (max. 2 s); bei Fehlern ohne Bild weitermachen */
export async function imageData(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https:\/\//.test(url)) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
    const type = res.headers.get("content-type") ?? ""
    if (!res.ok || !type.startsWith("image/") || type.includes("svg")) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return buf.length > 2_000_000 ? null : `data:${type};base64,${buf.toString("base64")}`
  } catch {
    return null
  }
}

export type OgStat = { label: string; value: string }

/** Einheitliches Layout: Marke oben, großer Titel, Untertitel, optional Bild links und bis zu 3 Kennzahlen */
export async function ogImage({
  kicker,
  title,
  subtitle,
  avatar,
  stats = [],
  footer = "Alvi Challenges",
}: {
  kicker: string
  title: string
  subtitle?: string
  avatar?: string | null
  stats?: OgStat[]
  footer?: string
}) {
  const [display, body] = await loadFonts()
  const titleSize = title.length > 22 ? 64 : title.length > 14 ? 80 : 96
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "56px 64px",
          color: "#fff",
          background: "linear-gradient(135deg, #0b0a1f 0%, #1e1b4b 55%, #0c4a6e 100%)",
          fontFamily: "Noto Sans",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontFamily: "Luckiest Guy", fontSize: 40, color: "#ffd60a" }}>
            ALVI<span style={{ color: "#22d3ee" }}>.</span>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#c4b5fd", textTransform: "uppercase", letterSpacing: 2 }}>{kicker}</div>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 48 }}>
          {avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} width={220} height={220} alt="" style={{ borderRadius: 999, border: "8px solid #ffd60a", objectFit: "cover" }} />
          )}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontFamily: "Luckiest Guy", fontSize: titleSize, lineHeight: 1.05, color: "#ffd60a" }}>{title}</div>
            {subtitle && <div style={{ display: "flex", marginTop: 16, fontSize: 34, color: "#e5e7eb" }}>{subtitle}</div>}
          </div>
        </div>

        {stats.length > 0 && (
          <div style={{ display: "flex", gap: 24, marginBottom: 28 }}>
            {stats.slice(0, 3).map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  padding: "18px 24px",
                  borderRadius: 24,
                  background: "rgba(255,255,255,0.08)",
                  border: "2px solid rgba(255,255,255,0.15)",
                }}
              >
                <div style={{ display: "flex", fontSize: 22, color: "#c4b5fd", textTransform: "uppercase" }}>{s.label}</div>
                <div style={{ display: "flex", fontFamily: "Luckiest Guy", fontSize: 52, color: "#ffd60a" }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", fontSize: 24, color: "#a5b4fc" }}>{footer}</div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Luckiest Guy", data: display, style: "normal", weight: 400 },
        { name: "Noto Sans", data: body, style: "normal", weight: 400 },
      ],
    },
  )
}

/** Gemeinsame Metadaten für eine Seite mit eigenem Vorschaubild */
export function ogMeta(title: string, description: string, image: string) {
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, ...OG_SIZE }], type: "website" as const, locale: "de_DE", siteName: "Alvi Challenges" },
    twitter: { card: "summary_large_image" as const, title, description, images: [image] },
  }
}
