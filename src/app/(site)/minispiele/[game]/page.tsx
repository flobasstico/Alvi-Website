import Link from "next/link"
import { notFound } from "next/navigation"
import { GameShell } from "@/components/minigames/game-shell"
import { PageTitle } from "@/components/page-title"
import { isMinigame, minigame } from "@/lib/minigames"
import { getViewer } from "@/lib/supabase/server"

export async function generateMetadata({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params
  return { title: isMinigame(game) ? minigame(game).title : "Minispiel" }
}

export default async function MinigamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params
  if (!isMinigame(game)) notFound()
  const info = minigame(game)
  const { supabase, user, isAdmin } = await getViewer()
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
        {isAdmin && (
          <span className="text-muted">
            OBS-Overlay (Tages-Highscore): <code className="select-all rounded bg-panel-2 px-1.5 py-0.5">/overlay/minispiel/{game}</code>
          </span>
        )}
      </div>
      <GameShell game={game} myId={user?.id ?? null} isAdmin={isAdmin} alviBest={alviBest ?? null} myBest={mine?.[0]?.score ?? null} />
    </>
  )
}
