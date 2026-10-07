import Link from "next/link"
import { ShareButton } from "@/components/share-button"
import { notFound } from "next/navigation"
import { GameShell } from "@/components/minigames/game-shell"
import { PageTitle } from "@/components/page-title"
import { isMinigame, minigame } from "@/lib/minigames"
import { ogMeta } from "@/lib/og"
import { getViewer } from "@/lib/supabase/server"

export async function generateMetadata({ params, searchParams }: { params: Promise<{ game: string }>; searchParams: Promise<{ von?: string }> }) {
  const { game } = await params
  if (!isMinigame(game)) return { title: "Minispiel" }
  const info = minigame(game)
  // ?von=<twitch-name>: geteiltes Ergebnis – das Bild zeigt den echten Bestwert aus der Datenbank
  const von = (await searchParams).von?.toLowerCase()
  const valid = von && /^[a-z0-9_]{2,25}$/.test(von) ? von : null
  return ogMeta(
    valid ? `${info.title}: Schlägst du ${valid}?` : info.title,
    info.text,
    `/og/minispiel/${game}${valid ? `?von=${valid}` : ""}`,
  )
}

export default async function MinigamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params
  if (!isMinigame(game)) notFound()
  const info = minigame(game)
  const { supabase, user, profile, isAdmin } = await getViewer()
  const [{ data: alviBest }, { data: mine }] = await Promise.all([
    supabase.rpc("minigame_alvi_best", { p_game: game }),
    user
      ? supabase.from("minigame_runs").select("score").eq("user_id", user.id).eq("game", game).not("score", "is", null).order("score", { ascending: false }).limit(1)
      : Promise.resolve({ data: [] as { score: number | null }[] }),
  ])

  return (
    <>
      <PageTitle title={`${info.emoji} ${info.title}`} subtitle={info.text} />
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/minispiele" className="text-accent-2 underline">
          ← Alle Minispiele
        </Link>
        <ShareButton path={`/minispiele/${game}`} text={`${info.title} bei Alvi Challenges – schaffst du den Highscore?`} className="ml-auto" />
        {isAdmin && (
          <span className="text-muted">
            OBS-Overlay (Tages-Highscore): <code className="select-all rounded bg-panel-2 px-1.5 py-0.5">/overlay/minispiel/{game}</code>
          </span>
        )}
      </div>
      <GameShell game={game} myId={user?.id ?? null} myLogin={profile?.twitch_login ?? null} isAdmin={isAdmin} alviBest={alviBest ?? null} myBest={mine?.[0]?.score ?? null} />
    </>
  )
}
