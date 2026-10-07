import clsx from "clsx"
import Link from "next/link"
import { PageTitle } from "@/components/page-title"
import { selectAll } from "@/lib/supabase/select-all"
import { getViewer } from "@/lib/supabase/server"
import { SuggestionForm, SuggestionItem } from "./suggestions"

export const metadata = { title: "Community-Vorschläge" }

const DAILY_LIMIT = 5

export default async function VorschlaegePage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const sort = (await searchParams).sort === "neu" ? "neu" : "beliebt"
  const { supabase, user, isAdmin } = await getViewer()
  const [{ data: suggestions }, { data: votes }] = await Promise.all([
    supabase.from("suggestions").select("*").order("created_at", { ascending: false }).limit(500),
    selectAll((a, b) => supabase.from("suggestion_votes").select("*").order("suggestion_id").order("user_id").range(a, b)),
  ])
  const authorIds = [...new Set((suggestions ?? []).map((s) => s.author_id))]
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, display_name, twitch_login, avatar_url").in("id", authorIds)
    : { data: [] }
  const authorOf = new Map((authors ?? []).map((a) => [a.id, a]))

  const votesBy = new Map<number, typeof votes>()
  for (const v of votes) votesBy.set(v.suggestion_id, [...(votesBy.get(v.suggestion_id) ?? []), v])
  const rows = (suggestions ?? []).map((s) => {
    const own = votesBy.get(s.id) ?? []
    const likes = own.filter((v) => v.value === 1).length
    const dislikes = own.filter((v) => v.value === -1).length
    const author = authorOf.get(s.author_id)
    return {
      ...s,
      likes,
      dislikes,
      myVote: own.find((v) => v.user_id === user?.id)?.value ?? 0,
      authorName: author?.display_name ?? author?.twitch_login ?? "Unbekannt",
      authorAvatar: author?.avatar_url ?? null,
    }
  })
  if (sort === "beliebt") rows.sort((a, b) => b.likes - b.dislikes - (a.likes - a.dislikes) || b.likes - a.likes || b.id - a.id)

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000
  const usedToday = rows.filter((r) => r.author_id === user?.id && new Date(r.created_at).getTime() > dayAgo).length

  return (
    <>
      <PageTitle title="Community-Vorschläge" subtitle="Eure Ideen für neue Challenges, Spiele und die Website – stimmt ab, was als Nächstes kommt!" />

      <section className="panel mb-6">
        {user ? (
          <SuggestionForm left={isAdmin ? null : Math.max(0, DAILY_LIMIT - usedToday)} />
        ) : (
          <p className="text-muted">Mit Twitch einloggen, um Vorschläge einzusenden und abzustimmen.</p>
        )}
      </section>

      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="text-muted">Sortieren:</span>
        {(["beliebt", "neu"] as const).map((k) => (
          <Link
            key={k}
            href={k === "beliebt" ? "/vorschlaege" : "/vorschlaege?sort=neu"}
            className={clsx("chip", sort === k && "border-accent bg-accent/15 text-accent")}
          >
            {k === "beliebt" ? "👍 Beliebt" : "🕒 Neu"}
          </Link>
        ))}
        <span className="ml-auto text-muted">{rows.length} Vorschläge</span>
      </div>

      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <SuggestionItem key={r.id} s={r} loggedIn={!!user} canDelete={isAdmin || r.author_id === user?.id} />
        ))}
        {!rows.length && <li className="panel text-muted">Noch keine Vorschläge – sei der Erste!</li>}
      </ul>
    </>
  )
}
