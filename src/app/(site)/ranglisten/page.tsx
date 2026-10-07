import clsx from "clsx"
import Link from "next/link"
import { Leaderboard } from "@/components/minigames/leaderboard"
import { PageTitle } from "@/components/page-title"
import { isMinigame, MINIGAMES } from "@/lib/minigames"
import {
  formatWatchtime,
  PAGE_SIZE,
  rankEntries,
  seChannelId,
  seLeaderboard,
  seUser,
  type SeBoard,
  type SeUser,
} from "@/lib/streamelements"
import { getViewer } from "@/lib/supabase/server"

export const metadata = { title: "Community-Ranglisten" }

const BOARDS: { key: SeBoard; label: string; unit: string }[] = [
  { key: "watchtime", label: "⏱️ Watchtime", unit: "Zuschauzeit" },
  { key: "punkte", label: "💰 Punkte", unit: "Aktuelle Punkte" },
  { key: "gesamt", label: "🏦 Punkte gesamt", unit: "Je verdiente Punkte" },
]

type Params = { tab?: string; seite?: string; suche?: string }

export default async function RanglistenPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams
  // Minispiel-Bestenlisten laufen über die eigene Datenbank, der Rest über StreamElements
  const mini = isMinigame(params.tab) ? params.tab : null
  const board = BOARDS.find((b) => b.key === params.tab) ?? BOARDS[0]
  const page = Math.min(Math.max(1, Number(params.seite) || 1), 1000)
  const search = (params.suche ?? "").trim().slice(0, 30)

  const { supabase, user, profile, isAdmin } = await getViewer()
  const { data: setting } = await supabase.from("site_settings").select("value").eq("key", "main_creator_login").maybeSingle()
  const channel = setting?.value?.trim() || "alvivb"
  const channelId = await seChannelId(channel)

  const [list, first, me, found] = channelId
    ? await Promise.all([
        mini ? null : seLeaderboard(channelId, board.key, page),
        !mini && page > 1 ? seLeaderboard(channelId, board.key, 1) : null,
        profile?.twitch_login ? seUser(channelId, profile.twitch_login) : null,
        search ? seUser(channelId, search) : null,
      ])
    : [null, null, null, null]
  const rows = list ? rankEntries(list.entries, page, first?.entries ?? []) : []

  const value = (v: number) => (board.key === "watchtime" ? formatWatchtime(v) : v.toLocaleString("de-DE"))
  const pages = list ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : 1
  const link = (next: Params) => {
    const p = new URLSearchParams()
    const merged: Params = {
      tab: mini ?? (board.key === "watchtime" ? undefined : board.key),
      seite: undefined,
      suche: search || undefined,
      ...next,
    }
    for (const k of ["tab", "seite", "suche"] as const) if (merged[k]) p.set(k, merged[k]!)
    const q = p.toString()
    return q ? `/ranglisten?${q}` : "/ranglisten"
  }
  const myLogin = profile?.twitch_login?.toLowerCase()

  return (
    <>
      <PageTitle
        title="Community-Ranglisten"
        subtitle="Wer schaut am meisten zu? Watchtime und Kanalpunkte aus Alvis Stream – dieselben Werte wie bei !watchtime und !points im Chat – und die Bestenlisten der Minispiele."
      />

      {channelId && (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          {me && <UserCard title="Deine Werte" user={me} />}
          <section className={clsx("panel", !me && "md:col-span-2")}>
            <h2 className="mb-2 font-display text-xl">Zuschauer suchen</h2>
            <form action="/ranglisten" className="flex gap-2">
              {(mini || board.key !== "watchtime") && <input type="hidden" name="tab" value={mini ?? board.key} />}
              <input name="suche" defaultValue={search} className="input" placeholder="Twitch-Name" aria-label="Twitch-Name suchen" maxLength={30} />
              <button className="btn-primary px-4">Suchen</button>
            </form>
            {search &&
              (found ? <UserCard user={found} compact /> : <p className="mt-3 text-sm text-muted">„{search}“ wurde nicht gefunden.</p>)}
          </section>
        </div>
      )}

      <nav className="mb-3 flex flex-wrap gap-2">
        {BOARDS.map((b) => (
          <Link
            key={b.key}
            href={link({ tab: b.key === "watchtime" ? undefined : b.key })}
            className={clsx("btn px-4 py-2", !mini && board.key === b.key ? "bg-accent text-black" : "btn-secondary")}
          >
            {b.label}
          </Link>
        ))}
        {MINIGAMES.map((g) => (
          <Link
            key={g.key}
            href={link({ tab: g.key })}
            className={clsx("btn px-4 py-2", mini === g.key ? "bg-accent text-black" : "btn-secondary")}
          >
            {g.emoji} {g.title}
          </Link>
        ))}
      </nav>

      {mini ? (
        <section className="panel">
          <Leaderboard key={mini} game={mini} myId={user?.id ?? null} isAdmin={isAdmin} initialPeriod="ewig" />
          <Link href={`/minispiele/${mini}`} className="btn-primary mt-4">
            ▶ Selbst spielen
          </Link>
        </section>
      ) : (
        <>
          <section className="panel">
            {!channelId ? (
              <p className="text-muted">Die Ranglisten sind gerade nicht erreichbar. Bitte später nochmal versuchen.</p>
            ) : list ? (
              <>
                <ol className="divide-y divide-line/50">
                  {rows.map(({ rank, ...e }) => {
                    return (
                      <li
                        key={e.username}
                        className={clsx(
                          "-mx-2 flex items-center gap-3 rounded-lg px-2 py-2",
                          rank <= 3 && "sm:text-lg",
                          e.username.toLowerCase() === myLogin && "bg-accent/10",
                        )}
                      >
                        <span className="w-10 shrink-0 font-display tabular-nums text-muted sm:w-12">
                          {["🥇", "🥈", "🥉"][rank - 1] ?? `${rank}.`}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-semibold">{e.username}</span>
                        <span className="shrink-0 font-bold tabular-nums text-accent">{value(e.value)}</span>
                      </li>
                    )
                  })}
                </ol>
                {!rows.length && <p className="text-muted">Keine Einträge.</p>}
                <div className="mt-4 flex items-center justify-between text-sm">
                  {page > 1 ? (
                    <Link href={link({ seite: String(page - 1) })} className="btn-secondary px-3 py-1.5">
                      ← Zurück
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span className="text-muted">
                    Seite {page} von {pages.toLocaleString("de-DE")} · {list.total.toLocaleString("de-DE")} Zuschauer
                  </span>
                  {page < pages ? (
                    <Link href={link({ seite: String(page + 1) })} className="btn-secondary px-3 py-1.5">
                      Weiter →
                    </Link>
                  ) : (
                    <span />
                  )}
                </div>
              </>
            ) : (
              <p className="text-muted">Die Rangliste ist gerade nicht erreichbar. Bitte später nochmal versuchen.</p>
            )}
          </section>
          <p className="mt-3 text-xs text-muted">Daten von StreamElements, alle 15 Minuten aktualisiert. Bots werden ausgeblendet.</p>
        </>
      )}
    </>
  )
}

function UserCard({ title, user, compact }: { title?: string; user: SeUser; compact?: boolean }) {
  return (
    <section className={clsx(compact ? "mt-3 rounded-xl border border-line bg-bg/40 p-3" : "panel")}>
      {title && <h2 className="mb-2 font-display text-xl">{title}</h2>}
      <div className="mb-2 font-bold">{user.username}</div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="col-span-2">
          <Stat label="Watchtime" value={formatWatchtime(user.watchtime)} />
        </div>
        <Stat label="Punkte" value={user.points.toLocaleString("de-DE")} />
        <Stat label="Punkte-Rang" value={user.rank ? `#${user.rank.toLocaleString("de-DE")}` : "–"} />
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-panel-2 px-2 py-2">
      <div className="text-[11px] font-bold uppercase text-muted">{label}</div>
      <div className="font-display text-lg leading-tight text-accent">{value}</div>
    </div>
  )
}
