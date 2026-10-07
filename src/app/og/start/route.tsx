import { ogImage } from "@/lib/og"

export const revalidate = 86400

/** Standard-Vorschaubild der Seite */
export async function GET() {
  return ogImage({
    kicker: "Fortnite-Challenges",
    title: "ALVI CHALLENGES",
    subtitle: "Glücksrad, Bingo, Loot-Auktion, Creator-Liga, Minispiele und mehr – wer ist der Beste?",
    footer: "Challenges zusammenstellen, mitspielen, Bestenlisten knacken",
  })
}
