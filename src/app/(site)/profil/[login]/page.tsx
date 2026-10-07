import clsx from "clsx"
import { ShareButton } from "@/components/share-button"
import Link from "next/link"
import { notFound } from "next/navigation"
import { MINIGAMES } from "@/lib/minigames"
import { ogMeta } from "@/lib/og"
import { PLAYER_GAME_LABEL } from "@/lib/player-stats"
import { loadPlayerStats } from "@/lib/player-stats-server"
import { badges, gameLines, totals } from "@/lib/profile"
import { formatWatchtime, seChannelId, seUser } from "@/lib/streamelements"
import { getViewer } from "@/lib/supabase/server"
import { VisibilityToggle } from "./visibility-toggle"

export async function generateMetadata({ params }: { params: Promise<{ login: string }> }) {
  const login = decodeURIComponent((await params).login).toLowerCase()
  return ogMeta(`Profil von ${login}`, `Runden, Siege, Minispiel-Rekorde und Abzeichen von ${login} bei Alvi Challenges.`, `/og/profil/${encodeURIComponent(login)}`)
}

export default async function ProfilPage({ params }: { params: Promise<{ login: string }> }) {
  const login = decodeURIComponent((await params).login).toLowerCase()
  if (!/^[a-z0-9_]{2,25}$/.test(login)) notFound()
  const { supabase, user } = await getViewer()
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, twitch_login, display_name, avatar_url, created_at, is_public, role")
    .ilike("twitch_login", login.replace(/[%_\\]/g, "\\$&"))
    .maybeSingle()
  if (!profile) notFound()

  const own = user?.id === profile.id
  const name = profile.display_name ?? profile.twitch_login ?? login

  if (!profile.is_public && !own) {
    return (
      <section className="panel mx-auto mt-6 max-w-md text-center">
        {/* Privat: kein Bild, kein Anzeigename – nur der Hinweis */}
        <div className="text-5xl">🔒</div>
        <p className="mt-3 text-muted">Dieses Profil ist privat.</p>
      </section>
    )
  }

  const { data: setting } = await supabase.from("site_settings").select("value").eq("key", "main_creator_login").maybeSingle()
  const [stats, { data: suggestions }, { count: cards }, se, { data: mini }] = await Promise.all([
    loadPlayerStats(supabase, profile.id),
    supabase.from("suggestions").select("id").eq("author_id", profile.id),
    supabase.from("bingo_card_templates").select("id", { count: "exact", head: true }).eq("author_id", profile.id).eq("approved", true),
    seChannelId(setting?.value?.trim() || "alvivb").then((id) => (id && profile.twitch_login ? seUser(id, profile.twitch_login) : null)),
    supabase.rpc("minigame_profile", { p_user: profile.id }),
  ])
  const ids = (suggestions ?? []).map((s) => s.id)
  const { data: votes } = ids.length ? await supabase.from("suggestion_votes").select("suggestion_id, value").in("suggestion_id", ids) : { data: [] }
  const likesPer = new Map<number, number>()
  for (const v of votes ?? []) if (v.value === 1) likesPer.set(v.suggestion_id, (likesPer.get(v.suggestion_id) ?? 0) + 1)
  const likes = [...likesPer.values()].reduce((s, n) => s + n, 0)

  const official = stats.parts.filter((p) => p.userId === profile.id)
  const viewer = stats.viewerParts.filter((p) => p.userId === profile.id)
  const all = [...official, ...viewer]
  const lines = gameLines(official, viewer)
  const o = totals(official)
  const v = totals(viewer)
  const list = badges({
    rounds: all.length,
    wins: all.filter((p) => p.won).length,
    games: new Set(all.map((p) => p.game)).size,
    bingoWins: all.filter((p) => p.game === "bingo" && p.won).length,
    olympiadeWins: all.filter((p) => p.game === "olympiade" && p.won).length,
    suggestions: ids.length,
    bestSuggestionLikes: Math.max(0, ...likesPer.values()),
    cards: cards ?? 0,
    watchMinutes: se?.watchtime ?? null,
    minigames: mini ?? [],
  })
  const earned = list.filter((b) => b.earned).length

  return (
    <>
      <section className="panel mb-6 flex flex-wrap items-center gap-4">
        <Avatar url={profile.avatar_url} size="h-20 w-20" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl text-accent">{name}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <a href={`https://www.twitch.tv/${profile.twitch_login}`} target="_blank" rel="noreferrer" className="hover:text-white hover:underline">
              @{profile.twitch_login}
            </a>
            <span>· dabei seit {new Date(profile.created_at).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "Europe/Berlin" })}</span>
            {profile.role === "admin" && <span className="chip">Admin</span>}
            {!profile.is_public && <span className="chip">🔒 Privat</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          {profile.is_public && (
            <ShareButton
              path={`/profil/${profile.twitch_login}`}
              text={own ? "Mein Profil bei Alvi Challenges – Runden, Siege und Abzeichen:" : `Das Profil von ${name} bei Alvi Challenges:`}
              label={own ? "Profil teilen" : "Teilen"}
            />
          )}
          {own && <VisibilityToggle isPublic={profile.is_public} />}
        </div>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Box title="🏆 Offizielle Runden" hint="mit Admin gespielt">
          <Numbers items={[["Runden", o.rounds], ["Siege", o.wins], ["Quote", o.rounds ? `${Math.round((o.wins / o.rounds) * 100)} %` : "–"]]} />
        </Box>
        <Box title="🧑‍🤝‍🧑 Zuschauer-Runden" hint="ohne Admin gespielt">
          <Numbers items={[["Runden", v.rounds], ["Siege", v.wins], ["Quote", v.rounds ? `${Math.round((v.wins / v.rounds) * 100)} %` : "–"]]} />
        </Box>
        <Box title="📺 Im Stream" hint="Werte von StreamElements">
          {se ? (
            <div className="flex flex-col gap-2">
              <div className="rounded-lg bg-panel-2 px-2 py-2 text-center">
                <div className="font-display text-lg leading-tight text-accent">{formatWatchtime(se.watchtime)}</div>
                <div className="text-[11px] text-muted">Watchtime</div>
              </div>
              <Numbers items={[["Punkte", se.points.toLocaleString("de-DE")], ["Punkte-Rang", se.rank ? `#${se.rank}` : "–"]]} />
            </div>
          ) : (
            <p className="text-sm text-muted">Keine Daten gefunden.</p>
          )}
        </Box>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="panel">
          <h2 className="mb-3 font-display text-2xl">Nach Spiel</h2>
          {lines.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase text-muted">
                  <th className="py-2">Spiel</th>
                  <th className="py-2 text-right">Offiziell</th>
                  <th className="py-2 text-right">Zuschauer</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.game} className="border-b border-line/50">
                    <td className="py-2 font-semibold">{PLAYER_GAME_LABEL[l.game]}</td>
                    <td className="py-2 text-right tabular-nums">{l.rounds ? `${l.wins} / ${l.rounds}` : "–"}</td>
                    <td className="py-2 text-right tabular-nums">{l.viewerRounds ? `${l.viewerWins} / ${l.viewerRounds}` : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted">Noch keine Runden gespielt.</p>
          )}
          {lines.length > 0 && <p className="mt-2 text-xs text-muted">Siege / Runden</p>}
        </section>

        <section className="panel">
          <h2 className="mb-3 font-display text-2xl">Community</h2>
          <Numbers
            items={[
              ["Vorschläge", ids.length],
              ["Likes erhalten", likes],
              ["Bingo-Karten", cards ?? 0],
            ]}
          />
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Link href="/vorschlaege" className="text-accent-2 underline">
              Zu den Vorschlägen →
            </Link>
            <Link href="/bingo/karten" className="text-accent-2 underline">
              Zu den Bingo-Karten →
            </Link>
          </div>
        </section>
      </div>

      <section className="panel mb-6">
        <h2 className="mb-3 font-display text-2xl">Minispiele</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {MINIGAMES.map((g) => {
            const m = (mini ?? []).find((x) => x.game === g.key)
            return (
              <Link key={g.key} href={`/minispiele/${g.key}`} className="rounded-xl border border-line bg-bg/40 p-3 hover:border-accent">
                <div className="font-bold">
                  {g.emoji} {g.title}
                </div>
                {m ? (
                  <Numbers
                    items={[
                      ["Bestwert", m.best.toLocaleString("de-DE")],
                      ["Rang", profile.is_public ? `#${m.rank_alltime}` : "–"],
                      ["Runden", m.plays],
                    ]}
                  />
                ) : (
                  <p className="text-sm text-muted">Noch nicht gespielt.</p>
                )}
              </Link>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <h2 className="mb-3 font-display text-2xl">
          Abzeichen <span className="text-base text-muted">({earned} von {list.length})</span>
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((b) => (
            <li
              key={b.key}
              className={clsx("rounded-xl border p-3 text-center", b.earned ? "border-accent/60 bg-accent/10" : "border-line opacity-40 grayscale")}
              title={b.earned ? "Freigeschaltet" : "Noch nicht freigeschaltet"}
            >
              <div className="text-3xl">{b.emoji}</div>
              <div className="mt-1 font-bold">{b.title}</div>
              <div className="text-xs text-muted">{b.text}</div>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function Avatar({ url, size, className }: { url: string | null; size: string; className?: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={clsx(size, "rounded-full border-2 border-accent object-cover", className)} />
  ) : (
    <span className={clsx(size, "flex items-center justify-center rounded-full bg-line text-3xl", className)}>👤</span>
  )
}

function Box({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <h2 className="font-display text-xl">{title}</h2>
      <p className="mb-3 text-xs text-muted">{hint}</p>
      {children}
    </section>
  )
}

function Numbers({ items }: { items: [string, string | number][] }) {
  return (
    <div className={clsx("grid gap-2 text-center", items.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
      {items.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-panel-2 px-1 py-2">
          <div className="font-display text-xl leading-tight text-accent">{value}</div>
          <div className="text-[11px] text-muted">{label}</div>
        </div>
      ))}
    </div>
  )
}
